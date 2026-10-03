/* Spaced-repetition training.

   A card is a position where it is your turn and the repertoire has your move — the thing
   you must remember. Its schedule lives in rep.train[key] = { due, iv, ease, reps, lapses }
   (due in ms, iv in days). A card with no record is new, and new cards count as due.

   A session drills whole lines rather than isolated positions; the app plays the opponent and
   tests every one of your moves. Three modes:
     due       pick the line with the most due cards, again and again, until nothing is due.
               First attempts grade the cards; a miss is due again at once (back this session).
     practice  every line in scope once, shuffled; lines with a miss are replayed at the end.
     game      10 games: the opponent picks among your prepared replies weighted by how often
               masters play them; any of your stored moves is accepted.
   In practice and game a miss still grades the card down (it comes back sooner), but a right
   answer never pushes a review further out, so practising cannot hide a weakness.           */

import { Chess, DEFAULT_POSITION } from './vendor/chess.js';
import * as R from './repertoire.js';
import { gamesAt, nextMoves, meta } from './games.js';

const DAY = 86400000;

/* ---------- scheduling ---------- */

export function cardKeys(rep) {
  return Object.keys(rep.pos).filter(k => k.split(' ')[1] === rep.side && rep.pos[k].moves.length);
}

export function isDue(rep, key, now = Date.now()) {
  const c = rep.train?.[key];
  return !c || c.due <= now;
}

export function dueSummary(rep, now = Date.now()) {
  const keys = cardKeys(rep);
  const fresh = keys.filter(k => !rep.train?.[k]).length;
  const due = keys.filter(k => isDue(rep, k, now)).length;
  const upcoming = keys.map(k => rep.train?.[k]?.due).filter(d => d > now);
  return { total: keys.length, due, fresh, next: upcoming.length ? Math.min(...upcoming) : null };
}

function grade(rep, key, ok, now = Date.now()) {
  rep.train ||= {};
  const c = rep.train[key] ||= { due: now, iv: 0, ease: 2.5, reps: 0, lapses: 0 };
  if (ok) {
    c.reps++;
    c.iv = c.reps === 1 ? 1 : c.reps === 2 ? 3 : Math.round(c.iv * c.ease);
    c.ease = Math.min(3, c.ease + 0.05);
    c.due = now + c.iv * DAY;
  } else {
    c.lapses++;
    c.reps = 0;
    c.iv = 0;
    c.ease = Math.max(1.3, c.ease - 0.2);
    c.due = now;   // due again now: comes back later this session
  }
}

/* ---------- session ---------- */

function makeStep(before, san, ply, mine) {
  const chess = new Chess(before);
  const mv = chess.move(san);
  return { san: mv.san, uci: mv.from + mv.to + (mv.promotion || ''), from: mv.from, to: mv.to, before, after: chess.fen(), mine, ply };
}

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* Lines as step lists: [{ san, uci, before, after, mine, ply }]. `before`/`after` are FENs. */
function buildLines(rep, prefixKey, prefixLen) {
  const chess = new Chess();
  const mineParity = rep.side === 'w' ? 0 : 1;
  return R.enumerateLines(rep, 5000)
    .filter(l => prefixLen === 0 || l[prefixLen - 1]?.key === prefixKey)
    .map(l => {
      chess.load(DEFAULT_POSITION);
      return l.map((m, ply) => {
        const before = chess.fen();
        const mv = chess.move(m.san);
        return { san: mv.san, uci: m.uci, from: mv.from, to: mv.to, before, after: chess.fen(), mine: ply % 2 === mineParity, ply };
      });
    })
    .filter(steps => steps.some(s => s.mine && s.ply >= prefixLen));   // must test something
}

export class Session {
  /* ui: { show(state) } — called whenever something visible changes.
     save(): persist after every grade so stopping midway loses nothing. */
  constructor(rep, { prefixKey = null, prefixLen = 0, mode = 'due', games = 10, ui, save }) {
    this.rep = rep;
    this.ui = ui;
    this.save = save;
    this.mode = mode;
    this.prefixLen = prefixLen;
    this.lines = buildLines(rep, prefixKey, prefixLen);
    this.queue = mode === 'practice' ? shuffle([...this.lines]) : null;
    this.retried = new Set();
    this.gamesTotal = games;
    this.stats = { tested: 0, firstTry: 0, lines: 0, total: mode === 'practice' ? this.lines.length : mode === 'game' ? games : 0 };
    this.lastLine = null;
    this.timer = null;
    this.done = false;
  }

  dueCount() {
    const keys = new Set();
    for (const l of this.lines) for (const s of l) if (s.mine && s.ply >= this.prefixLen && isDue(this.rep, R.keyOf(s.before))) keys.add(R.keyOf(s.before));
    return keys.size;
  }

  // Is there anything to train in this mode and scope?
  available() { return this.mode === 'due' ? this.dueCount() : this.lines.length; }

  start() { this.nextLine(); }

  stop() { clearTimeout(this.timer); this.done = true; }

  finish() { this.done = true; this.show({ phase: 'done' }); }

  nextLine() {
    clearTimeout(this.timer);
    this.lineMissed = false;
    this.missed = false;
    this.feedback = null;
    this.p = this.prefixLen;            // moves before the scope point are just shown, not tested

    if (this.mode === 'practice') {
      const next = this.queue.shift();
      if (!next) return this.finish();
      this.line = next;
    } else if (this.mode === 'game') {
      if (this.stats.lines >= this.gamesTotal) return this.finish();
      // the scope's opening moves, then the game grows move by move in advance()
      this.line = (this.lines[0] || []).slice(0, this.prefixLen);
    } else {
      const score = l => l.filter(s => s.mine && s.ply >= this.prefixLen && isDue(this.rep, R.keyOf(s.before))).length;
      let best = [], top = 0;
      for (const l of this.lines) {
        const n = score(l);
        if (!n) continue;
        if (n > top) { top = n; best = [l]; } else if (n === top) best.push(l);
      }
      if (!best.length) return this.finish();
      // avoid replaying the line just finished when there is any other choice
      const pool = best.length > 1 ? best.filter(l => l !== this.lastLine) : best;
      this.line = pool[Math.floor(Math.random() * pool.length)];
    }
    this.lastLine = this.line;
    this.advance();
  }

  get step() { return this.line[this.p]; }
  get fen() { return this.p === 0 ? DEFAULT_POSITION : this.line[this.p - 1].after; }

  // Play opponent moves until it is your turn, or the line ends.
  advance() {
    if (this.done) return;
    if (this.mode === 'game' && this.p >= this.line.length) {
      const fen = this.fen;
      const ms = R.movesAt(this.rep, R.keyOf(fen));
      if (ms.length) {
        if (new Chess(fen).turn() === this.rep.side) {
          this.line.push(makeStep(fen, ms[0].san, this.p, true));      // expected: your main move
        } else {
          this.show({ phase: 'opponent' });
          const line = this.line, p = this.p;
          this.pickReply(fen, p, ms).then(san => {
            if (this.done || this.line !== line || this.p !== p) return;
            line.push(makeStep(fen, san, p, false));
            this.timer = setTimeout(() => { this.p++; this.advance(); }, 450);
          });
          return;
        }
      }
    }
    if (this.p >= this.line.length) {
      this.stats.lines++;
      if (this.mode === 'practice' && this.lineMissed && !this.retried.has(this.line)) {
        this.retried.add(this.line);
        this.queue.push(this.line);               // one more go at a line you slipped on
        this.stats.total++;
      }
      this.show({ phase: 'lineDone' });
      this.timer = setTimeout(() => this.nextLine(), 1100);
      return;
    }
    if (!this.step.mine) {
      this.show({ phase: 'opponent' });
      this.timer = setTimeout(() => { this.p++; this.advance(); }, 550);
      return;
    }
    this.missed = false;
    this.show({ phase: 'yourMove' });
  }

  // Real-game mode: choose among your prepared replies, weighted by master games.
  async pickReply(fen, ply, ms) {
    let w = ms.map(() => 1);
    try {
      // the start position isn't in the games index; its counts come with the collection's meta
      const counts = ply === 0
        ? new Map(Object.entries((await meta()).firstMoves || {}))
        : new Map(nextMoves((await gamesAt(fen, ply)).games).map(x => [x.san, x.n]));
      if (counts.size) w = ms.map(m => (counts.get(m.san) || 0) + 0.5);   // rare replies still turn up now and then
    } catch {}
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < ms.length; i++) { r -= w[i]; if (r <= 0) return ms[i].san; }
    return ms[ms.length - 1].san;
  }

  // Called with the board move; the UI is updated through show().
  userMove(mv) {
    if (this.done || !this.step?.mine) return;
    const chess = new Chess(this.fen);
    let m;
    try { m = chess.move(mv); } catch { return; }
    const key = R.keyOf(this.fen);
    const known = R.hasMove(this.rep, key, m.san);

    // in a real game any of your prepared moves is right, and the game follows it
    if (this.mode === 'game' && known && m.san !== this.step.san) {
      this.line[this.p] = makeStep(this.fen, m.san, this.p, true);
    }
    if (m.san === this.step.san) {
      if (!this.missed) {
        this.stats.tested++; this.stats.firstTry++;
        if (this.mode === 'due' && isDue(this.rep, key)) { grade(this.rep, key, true); this.save(); }
      }
      this.feedback = this.missed ? null : { ok: true, text: `✓ ${m.san}` };
      this.p++;
      this.advance();
      return;
    }
    if (known) {
      this.feedback = { alt: true, text: `${m.san} is in your repertoire too — this line goes on with the other move. Find it.` };
      this.show({ phase: 'yourMove' });
      return;
    }
    this.fail(`${m.san} isn't your move here. Play the arrow.`);
  }

  hint() {
    if (this.step?.mine) this.fail(`Your move here is ${this.step.san}.`);
  }

  fail(text) {
    if (!this.missed) {
      this.missed = true;
      this.lineMissed = true;
      this.stats.tested++;
      grade(this.rep, R.keyOf(this.fen), false);   // forgotten: even a card that wasn't due comes back
      this.save();
    }
    this.feedback = { ok: false, text };
    this.show({ phase: 'yourMove' });
  }

  show(extra) {
    const last = this.p > 0 && this.line ? this.line[this.p - 1] : null;
    this.ui.show({
      ...extra,
      mode: this.mode,
      fen: this.line ? this.fen : DEFAULT_POSITION,
      lastMove: last && { from: last.from, to: last.to },
      answer: this.missed && this.step?.mine ? this.step : null,
      feedback: this.feedback,
      note: last ? this.rep.pos[R.keyOf(last.after)]?.note || '' : '',
      due: this.dueCount(),
      stats: this.stats,
    });
  }
}
