/* Spaced-repetition training.

   A card is a position where it is your turn and the repertoire has your move — the thing
   you must remember. Its schedule lives in rep.train[key] = { due, iv, ease, reps, lapses }
   (due in ms, iv in days). A card with no record is new, and new cards count as due.

   A session drills whole lines rather than isolated positions: pick the line with the most
   due cards, play it from the start (the app plays the opponent), and test every one of
   your moves along it. Only the first attempt at each move counts. A missed card becomes due
   again straight away, so it comes back later in the same session.                        */

import { Chess, DEFAULT_POSITION } from './vendor/chess.js';
import * as R from './repertoire.js';

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
  constructor(rep, { prefixKey = null, prefixLen = 0, ui, save }) {
    this.rep = rep;
    this.ui = ui;
    this.save = save;
    this.prefixLen = prefixLen;
    this.lines = buildLines(rep, prefixKey, prefixLen);
    this.stats = { tested: 0, firstTry: 0, lines: 0 };
    this.lastLine = null;
    this.timer = null;
    this.done = false;
  }

  dueCount() {
    const keys = new Set();
    for (const l of this.lines) for (const s of l) if (s.mine && s.ply >= this.prefixLen && isDue(this.rep, R.keyOf(s.before))) keys.add(R.keyOf(s.before));
    return keys.size;
  }

  start() { this.nextLine(); }

  stop() { clearTimeout(this.timer); this.done = true; }

  nextLine() {
    clearTimeout(this.timer);
    const score = l => l.filter(s => s.mine && s.ply >= this.prefixLen && isDue(this.rep, R.keyOf(s.before))).length;
    let best = [], top = 0;
    for (const l of this.lines) {
      const n = score(l);
      if (!n) continue;
      if (n > top) { top = n; best = [l]; } else if (n === top) best.push(l);
    }
    if (!best.length) { this.done = true; this.show({ phase: 'done' }); return; }
    // avoid replaying the line just finished when there is any other choice
    const pool = best.length > 1 ? best.filter(l => l !== this.lastLine) : best;
    this.line = pool[Math.floor(Math.random() * pool.length)];
    this.lastLine = this.line;
    this.p = this.prefixLen;            // moves before the scope point are just shown, not tested
    this.missed = false;
    this.feedback = null;
    this.advance();
  }

  get step() { return this.line[this.p]; }
  get fen() { return this.p === 0 ? DEFAULT_POSITION : this.line[this.p - 1].after; }

  // Play opponent moves until it is your turn, or the line ends.
  advance() {
    if (this.done) return;
    if (this.p >= this.line.length) {
      this.stats.lines++;
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

  // Called with the board move; returns nothing — the UI is updated through show().
  userMove(mv) {
    if (this.done || !this.step?.mine) return;
    const chess = new Chess(this.fen);
    let m;
    try { m = chess.move(mv); } catch { return; }
    const key = R.keyOf(this.fen);
    const due = isDue(this.rep, key);

    if (m.san === this.step.san) {
      if (!this.missed) {
        this.stats.tested++; this.stats.firstTry++;
        if (due) { grade(this.rep, key, true); this.save(); }
      }
      this.feedback = this.missed ? null : { ok: true, text: `✓ ${m.san}` };
      this.p++;
      this.advance();
      return;
    }
    if (R.hasMove(this.rep, key, m.san)) {
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
      this.stats.tested++;
      grade(this.rep, R.keyOf(this.fen), false);   // forgotten: even a card that wasn't due goes back
      this.save();
    }
    this.feedback = { ok: false, text };
    this.show({ phase: 'yourMove' });
  }

  show(extra) {
    const last = this.p > 0 && this.line ? this.line[this.p - 1] : null;
    this.ui.show({
      ...extra,
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
