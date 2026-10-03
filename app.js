/* Phase 1: build a repertoire on the board.
   - `line` is the sequence of moves you are looking at; `cur` is how far along it you are.
   - Moves already in the repertoire are solid; moves you have just tried are dashed until
     you press "Save line", so you can explore freely without polluting the repertoire.
   - The panel lists every stored continuation from the current position: your move(s) in
     green, the opponent replies you have prepared for in blue (also drawn as arrows). */

import { Chess, DEFAULT_POSITION } from './vendor/chess.js';
import { Board } from './board.js';
import * as R from './repertoire.js';
import * as PGN from './pgn.js';
import * as T from './train.js';
import * as G from './games.js';
import * as TH from './theory.js';
import * as O from './openings.js';
import * as S from './sync.js';

const $ = id => document.getElementById(id);
const MINE = '#15803d', THEIRS = '#2563eb';

const data = R.load();
let rep = data.reps[data.active];
let line = [];      // [{ san, from, to, uci, fen }] — fen is the position AFTER the move
let cur = 0;

const board = new Board($('board'), { onMove: playMove });
board.setOrientation(rep.side);
const mini = new Board($('mini-board'));
mini.interactive = false;
mini.setOrientation(rep.side);
let scope = localStorage.getItem('chessrep.scope') || 'here';   // line table: 'here' | 'all'

const fenAt = i => (i === 0 ? DEFAULT_POSITION : line[i - 1].fen);
const isSaved = i => R.hasMove(rep, R.keyOf(fenAt(i)), line[i].san);
const persist = () => R.save(data);

/* ---------- moves ---------- */

function playMove(mv) {
  if (session) { session.userMove(mv); return; }
  const chess = new Chess(fenAt(cur));
  let m;
  try { m = chess.move(mv); } catch { render(); return; }
  if (line[cur]?.san === m.san) { cur++; render(); return; }   // same as the line ahead: just step
  line = line.slice(0, cur);
  line.push({ san: m.san, from: m.from, to: m.to, uci: m.from + m.to + (m.promotion || ''), fen: chess.fen() });
  cur++;
  render();
}

function saveLine() {
  const n = line.filter((_, i) => !isSaved(i)).length;
  line.forEach((m, i) => R.addMove(rep, R.keyOf(fenAt(i)), m.san, m.uci));
  persist();
  render();
  toast(`Line saved — ${n} new move${n === 1 ? '' : 's'}.`);
}

function deleteMove(san) {
  const fen = fenAt(cur);
  const n = R.lineCounter(rep)(fen, san);
  const msg = n > 1 ? `Delete ${san} and the ${n} lines under it?` : `Delete ${san}?`;
  if (!confirm(msg)) return;
  R.removeMove(rep, R.keyOf(fen), san);
  persist();
  render();
}

function makeMain(san) {
  R.makeMain(rep, R.keyOf(fenAt(cur)), san);
  persist();
  render();
}

/* ---------- navigation ---------- */

function go(i) { cur = Math.max(0, Math.min(line.length, i)); render(); }

function next() {
  if (cur < line.length) return go(cur + 1);
  const first = R.movesAt(rep, R.keyOf(fenAt(cur)))[0];   // at the end: follow the main stored move
  if (first) playMove(first.san);
}

function switchSide(side) {
  if (side === data.active) return;
  data.active = side;
  rep = data.reps[side];
  line = []; cur = 0;
  board.setOrientation(side);
  mini.setOrientation(side);
  persist();
  render();
}

/* ---------- render ---------- */

function render() {
  if (viewer) { showViewer(); return; }
  const fen = fenAt(cur);
  const key = R.keyOf(fen);
  const chess = new Chess(fen);
  const myTurn = chess.turn() === rep.side;
  const stored = R.movesAt(rep, key);

  // board + arrows for every stored continuation
  const arrows = stored.map((m, i) => ({
    from: m.uci.slice(0, 2), to: m.uci.slice(2, 4),
    color: myTurn ? MINE : THEIRS,
    opacity: myTurn && i > 0 ? 0.45 : 0.85,
  }));
  const last = cur > 0 ? line[cur - 1] : null;
  board.set(chess, { lastMove: last && { from: last.from, to: last.to }, arrows });
  mini.set(chess, { lastMove: last && { from: last.from, to: last.to } });

  // side toggle
  $('exp-side-name').textContent = rep.side === 'w' ? 'White' : 'Black';
  for (const b of document.querySelectorAll('.seg button')) b.classList.toggle('on', b.dataset.side === rep.side);

  // path
  const path = $('path');
  path.innerHTML = '';
  if (!line.length) path.innerHTML = '<span class="empty">Starting position — play a move on the board.</span>';
  line.forEach((m, i) => {
    if (i % 2 === 0) path.insertAdjacentHTML('beforeend', `<span class="num">${i / 2 + 1}.</span>`);
    const b = document.createElement('button');
    b.className = 'mv' + (isSaved(i) ? '' : ' unsaved') + (i === cur - 1 ? ' cur' : '');
    b.textContent = m.san;
    b.onclick = () => go(i + 1);
    path.appendChild(b);
  });
  const unsaved = line.some((_, i) => !isSaved(i));
  $('save-line').hidden = !unsaved;

  // candidate list
  $('moves-title').textContent = myTurn ? 'Your move' : 'Their replies';
  $('moves-hint').textContent = chess.isGameOver() ? '' :
    myTurn ? (stored.length ? '' : 'None yet — play your move') : (stored.length ? '' : 'None yet — add replies to prepare for');
  // how to branch: the answer to "how do I add another line?"
  const unsavedHere = line.some((_, i) => !isSaved(i));
  $('moves-tip').innerHTML = chess.isGameOver() ? '' :
    unsavedHere ? 'Dashed moves are not saved yet — carry on with the line, then press <b>Save line</b>.' :
    !stored.length ? '' :
    myTurn ? 'To add an alternative for you, play a different move on the board.'
           : 'To prepare for another reply, play it on the board — then continue the line and <b>Save line</b>.';

  const list = $('moves');
  list.innerHTML = '';
  const counter = R.lineCounter(rep);
  stored.forEach((m, i) => {
    const li = document.createElement('li');
    const n = counter(fen, m.san);
    const tag = myTurn && stored.length > 1 && i === 0 ? '<span class="tag">main</span>' : '';
    li.innerHTML = `
      <button class="play"><span class="dot" style="background:${myTurn ? MINE : THEIRS}"></span>
        <span class="san">${m.san}</span>${tag}<span class="count">${n} line${n === 1 ? '' : 's'}</span></button>
      ${myTurn && i > 0 ? '<button class="act main" title="Make main move">★</button>' : ''}
      <button class="act del" title="Delete">✕</button>`;
    li.querySelector('.play').onclick = () => playMove(m.san);
    li.querySelector('.del').onclick = () => deleteMove(m.san);
    li.querySelector('.main')?.addEventListener('click', () => makeMain(m.san));
    list.appendChild(li);
  });

  // note — only for positions that are part of the repertoire
  const inRep = line.slice(0, cur).every((_, i) => isSaved(i));
  $('note').hidden = !inRep;
  $('note-off').hidden = inRep;
  if (document.activeElement !== $('note')) $('note').value = R.node(rep, key)?.note || '';

  renderLines(key);
  renderDue(inRep);
  scheduleStudy(inRep);

  // the opening on the board
  const here = O.nameOf(line.slice(0, cur).map(m => R.keyOf(m.fen)));
  $('opening-name').textContent = here ? `${here.eco} · ${here.name}` : '';

  // stats
  const positions = Object.keys(rep.pos).length;
  const total = positions ? countAll() : 0;
  $('stats').textContent = positions
    ? `${rep.side === 'w' ? 'White' : 'Black'} repertoire · ${total} line${total === 1 ? '' : 's'} · ${positions} positions`
    : `${rep.side === 'w' ? 'White' : 'Black'} repertoire is empty`;
}

/* ---------- line table ---------- */

const plyLabel = (p, san) => `${Math.floor(p / 2) + 1}${p % 2 ? '…' : '.'}${san}`;
let tableCols = [];   // columns currently drawn, for the tap handler

function renderLines(key) {
  const all = R.enumerateLines(rep);
  // label each column by where it leaves the column before it (in full depth-first order)
  const cols = all.map((moves, i) => {
    let branch = -1;
    if (i > 0) { branch = 0; while (all[i - 1][branch]?.san === moves[branch].san) branch++; }
    return { moves, branch, label: i === 0 ? 'Main line' : plyLabel(branch, moves[branch].san) };
  });
  for (const c of cols) c.name = O.nameOf(c.moves.map(m => m.key));
  renderJump(cols);

  // the line on the board as its own dashed column while it has unsaved moves
  const unsaved = line.some((_, i) => !isSaved(i));
  if (unsaved) {
    const moves = line.map(m => ({ san: m.san, uci: m.uci, key: R.keyOf(m.fen) }));
    let branch = 0;
    while (line[branch] && isSaved(branch)) branch++;
    cols.unshift({ moves, branch, label: 'Unsaved', unsaved: true, name: O.nameOf(moves.map(m => m.key)) });
  }

  // "From here": only columns passing through the current position
  const shown = scope === 'all' || cur === 0 ? cols : cols.filter(c => c.moves[cur - 1]?.key === key);

  // the column you are on: the unsaved one, or the first whose moves start with the board line
  const matches = c => line.every((m, i) => c.moves[i]?.san === m.san);
  const active = shown.find(c => c.unsaved) || shown.find(matches);

  for (const b of $('lines-scope').children) b.classList.toggle('on', b.dataset.scope === scope);
  tableCols = shown;
  const wrap = $('lines');
  if (!shown.length) {
    wrap.innerHTML = `<p class="lines-empty">${all.length ? 'No saved lines pass through this position.' : 'Lines appear here as you save them.'}</p>`;
    $('lines-foot').textContent = '';
    return;
  }

  const plies = Math.max(...shown.map(c => c.moves.length));
  const mineParity = rep.side === 'w' ? 0 : 1;
  const fam = c => c.name?.family || (O.ready() ? 'Unnamed' : '');
  let h = '<table class="lt"><thead><tr><th class="no" rowspan="3">#</th>';
  // row 1: opening families spanning their consecutive columns
  for (let i = 0; i < shown.length;) {
    let j = i;
    while (j + 1 < shown.length && fam(shown[j + 1]) === fam(shown[i])) j++;
    const isAct = shown.slice(i, j + 1).includes(active);
    h += `<th class="fam${isAct ? ' act' : ''}" colspan="${2 * (j - i + 1)}"><span>${esc(fam(shown[i]))}</span></th>`;
    i = j + 1;
  }
  h += '</tr><tr>';
  // row 2: the variation (ECO + name), and where the column branches off
  for (const c of shown) {
    const v = c.name ? `${c.name.eco} ${c.name.variation || ''}`.trim() : '';
    h += `<th class="lname${c === active ? ' act' : ''}${c.unsaved ? ' unsaved' : ''}" colspan="2">` +
      `<span class="vn">${esc(v)}</span><span class="bl">${esc(c.label)}</span></th>`;
  }
  h += '</tr><tr>';
  for (const _ of shown) h += '<th class="wb">W</th><th class="wb pb">B</th>';
  h += '</tr></thead><tbody>';
  for (let r = 0; r < Math.ceil(plies / 2); r++) {
    h += `<tr><td class="no">${r + 1}</td>`;
    shown.forEach((c, ci) => {
      for (const p of [2 * r, 2 * r + 1]) {
        const m = c.moves[p];
        const cls = ['c'];
        if (p % 2) cls.push('pb');
        if (m) {
          if (p % 2 === mineParity) cls.push('mine');
          if (p < c.branch) cls.push('rep');
          if (p === c.branch) cls.push('branch');
          if (c === active) cls.push('actcol');
          if (c === active && p === cur - 1) cls.push('cur');
          if (c.unsaved && p >= c.branch) cls.push('unsaved');
          if (!c.unsaved && rep.pos[m.key]?.note) cls.push('note');
        }
        h += `<td class="${cls.join(' ')}"${m ? ` data-c="${ci}" data-p="${p}"` : ''}>${m ? m.san : ''}</td>`;
      }
    });
    h += '</tr>';
  }
  wrap.innerHTML = h + '</tbody></table>';

  const n = shown.filter(c => !c.unsaved).length;
  const capped = all.length >= 300 ? ' (showing the first 300)' : '';
  $('lines-foot').textContent = (scope === 'all' || cur === 0
    ? `${n} line${n === 1 ? '' : 's'}`
    : `${n} of ${all.length} line${all.length === 1 ? '' : 's'} pass through this position`) + capped;

  // keep the active column in view horizontally (never scroll the page vertically)
  const th = wrap.querySelector('.lname.act');
  if (th) {
    const left = th.offsetLeft - 30, right = th.offsetLeft + th.offsetWidth;
    if (left < wrap.scrollLeft) wrap.scrollLeft = left;
    else if (right > wrap.scrollLeft + wrap.clientWidth) wrap.scrollLeft = right - wrap.clientWidth;
  }
}

// Load a column's whole line onto the board, positioned after move index p.
function loadColumn(col, p) {
  const chess = new Chess();
  line = col.moves.map(m => {
    const mv = chess.move(m.san);
    return { san: mv.san, from: mv.from, to: mv.to, uci: m.uci || mv.from + mv.to + (mv.promotion || ''), fen: chess.fen() };
  });
  cur = p + 1;
}

// Tap a cell: load that line, positioned after that move.
$('lines').addEventListener('click', e => {
  const td = e.target.closest('td[data-c]');
  if (!td) return;
  loadColumn(tableCols[+td.dataset.c], +td.dataset.p);
  render();
});

/* "Jump to opening": every family in the repertoire, with its variations. Picking one puts the
   board where that opening starts, narrows the table to it and brings the table into view. */
let jumpTargets = [];

function renderJump(cols) {
  const sel = $('lines-jump');
  if (!O.ready() || !cols.length) { sel.hidden = true; return; }
  const fams = new Map();
  for (const c of cols) {
    if (!c.name) continue;
    const keys = c.moves.map(m => m.key);
    const f = fams.get(c.name.family) || { n: 0, col: c, ply: O.familyStart(keys, c.name.family), vars: new Map() };
    f.n++;
    fams.set(c.name.family, f);
    if (c.name.variation) {
      // group by the main variation ("Najdorf Variation"), not its sub-lines ("..., English Attack")
      const label = c.name.variation.split(',')[0].trim();
      const name = `${c.name.family}: ${label}`;
      let v = f.vars.get(name);
      if (!v) {
        const start = O.nameStart(keys, name);
        v = { n: 0, col: c, ply: start ? start.ply : c.name.ply, label, eco: start ? start.eco : c.name.eco };
        f.vars.set(name, v);
      }
      v.n++;
    }
  }
  jumpTargets = [];
  const opt = (label, target) => { jumpTargets.push(target); return `<option value="${jumpTargets.length - 1}">${esc(label)}</option>`; };
  let h = '<option value="">Jump to opening…</option>';
  for (const [family, f] of [...fams].sort((a, b) => a[0].localeCompare(b[0]))) {
    h += `<optgroup label="${esc(family)}">` + opt(`${family} — all ${f.n} line${f.n === 1 ? '' : 's'}`, f);
    for (const v of [...f.vars.values()].sort((a, b) => a.label.localeCompare(b.label)))
      h += opt(`${v.eco} ${v.label}${v.n > 1 ? ` (${v.n})` : ''}`, v);
    h += '</optgroup>';
  }
  if (sel.dataset.html !== h) { sel.innerHTML = h; sel.dataset.html = h; }
  sel.value = '';
  sel.hidden = false;
}

$('lines-jump').addEventListener('change', e => {
  const t = jumpTargets[+e.target.value];
  e.target.value = '';
  if (!t || t.ply < 0) return;
  loadColumn(t.col, t.ply);
  scope = 'here';
  try { localStorage.setItem('chessrep.scope', scope); } catch {}
  render();
  $('lines-jump').closest('.panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

O.load().then(() => { if (!session) render(); }).catch(() => {});

for (const b of $('lines-scope').children) b.onclick = () => {
  scope = b.dataset.scope;
  try { localStorage.setItem('chessrep.scope', scope); } catch {}
  render();
};

// Mini board: on a phone, once the main board scrolls out of view, show the position in a corner.
new IntersectionObserver(([entry]) => {
  $('mini').hidden = entry.intersectionRatio > 0.35 || window.innerWidth >= 900;
}, { threshold: [0, 0.35, 1] }).observe($('board'));
$('mini').onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });

/* ---------- training ---------- */

let session = null;

const ago = ms => {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${Math.max(1, m)} min`;
  const h = Math.round(m / 60);
  return h < 36 ? `${h} h` : `${Math.round(h / 24)} days`;
};

function renderDue(inRep) {
  const s = T.dueSummary(rep);
  $('due-count').textContent = !s.total ? 'Nothing to train yet'
    : s.due ? `${s.due} to review` : 'All caught up';
  $('due-sub').textContent = !s.total ? 'Save some lines first'
    : s.due ? (s.fresh ? `${s.fresh} new` : `of ${s.total} positions`)
    : s.next ? `Next review in ${ago(s.next - Date.now())}` : '';
  $('train-go').disabled = !s.total;
  trainInRep = inRep;
  if (!$('train-start').hidden) renderTrainStart();
}

/* Training chooser: scope (all lines / from the board position) and mode. */
let tsScope = 'all', trainInRep = false;
const hereOK = () => cur > 0 && trainInRep;
const scopeOpts = () => (tsScope === 'here' && hereOK() ? { prefixKey: R.keyOf(fenAt(cur)), prefixLen: cur } : {});
const newSession = mode => new T.Session(rep, { ...scopeOpts(), mode, ui: { show: showTrain }, save: persist });

function renderTrainStart() {
  if (!hereOK()) tsScope = 'all';
  for (const b of $('ts-scope').children) {
    b.classList.toggle('on', b.dataset.scope === tsScope);
    b.disabled = b.dataset.scope === 'here' && !hereOK();
  }
  const moves = line.slice(0, cur).map((m, i) => (i % 2 ? '' : `${i / 2 + 1}.`) + m.san).join(' ');
  const here = O.nameOf(line.slice(0, cur).map(m => R.keyOf(m.fen)));
  const probe = newSession('practice');
  const n = probe.lines.length, due = probe.dueCount();
  $('ts-scope-name').textContent = tsScope === 'here'
    ? `Lines from ${moves}${here ? ` — ${here.name}` : ''}`
    : hereOK() ? `Every line of your ${sideName(rep.side)} repertoire. "From here" uses the position on the board.`
      : `Every line of your ${sideName(rep.side)} repertoire. To train one opening, go to it on the board (e.g. Jump to opening) first.`;
  $('ts-due').textContent = due ? `${due} position${due === 1 ? '' : 's'} due — spaced repetition` : 'Nothing due here — all caught up';
  $('ts-practice').textContent = `All ${n} line${n === 1 ? '' : 's'} once, in random order — ignores the schedule`;
  $('ts-game').textContent = '10 games — the opponent plays your prepared replies as often as masters do';
  document.querySelector('.ts-mode[data-mode="due"]').disabled = !due;
  document.querySelector('.ts-mode[data-mode="practice"]').disabled = !n;
  document.querySelector('.ts-mode[data-mode="game"]').disabled = !n;
}

function openTrainStart() {
  tsScope = hereOK() ? 'here' : 'all';
  $('train-start').hidden = false;
  document.querySelector('.train-bar').hidden = true;
  renderTrainStart();
}

function closeTrainStart() {
  $('train-start').hidden = true;
  document.querySelector('.train-bar').hidden = false;
}

function startTraining(mode) {
  const s = newSession(mode);
  if (!s.available()) { toast('Nothing to train there.'); return; }
  closeTrainStart();
  session = s;
  document.body.classList.add('training');
  board.setOrientation(rep.side);
  mini.setOrientation(rep.side);
  window.scrollTo({ top: 0 });
  session.start();
}

function stopTraining() {
  session?.stop();
  session = null;
  board.interactive = true;
  document.body.classList.remove('training');
  render();
}

function showTrain(st) {
  const chess = new Chess(st.fen);
  const arrows = st.answer ? [{ from: st.answer.from, to: st.answer.to, color: MINE }] : [];
  board.interactive = st.phase === 'yourMove';
  board.set(chess, { lastMove: st.lastMove, arrows });
  mini.set(chess, { lastMove: st.lastMove, arrows });

  const { tested, firstTry, lines, total } = st.stats;
  const unit = st.mode === 'game' ? 'Game' : 'Line';
  $('t-progress').textContent = st.phase === 'done' ? `${lines} ${unit.toLowerCase()}${lines === 1 ? '' : 's'} played`
    : st.mode === 'due' ? `${st.due} due · ${firstTry}/${tested} first try`
    : `${unit} ${Math.min(lines + (st.phase === 'lineDone' ? 0 : 1), total)} of ${total} · ${firstTry}/${tested} first try`;
  $('t-prompt').textContent = {
    yourMove: 'Your move', opponent: 'Opponent to move…',
    lineDone: st.mode === 'game' ? 'End of your preparation ✓' : 'Line complete ✓', done: 'Session complete',
  }[st.phase];

  const fb = $('t-feedback');
  if (st.phase === 'done') {
    const pct = tested ? Math.round(firstTry / tested * 100) : 100;
    fb.className = 't-feedback ok';
    fb.textContent = !tested ? 'Nothing left to review.'
      : `${firstTry} of ${tested} found first time (${pct}%). ` + (st.mode === 'due'
        ? 'Misses came back until you got them, and will come round sooner.'
        : 'Your review schedule only changed for the misses — they will come round sooner.');
  } else {
    fb.className = 't-feedback' + (st.feedback ? (st.feedback.alt ? ' alt' : st.feedback.ok ? ' ok' : ' bad') : '');
    fb.textContent = st.feedback?.text || (st.phase === 'yourMove' ? 'What do you play here?' : '');
  }
  $('t-note').textContent = st.phase === 'done' ? '' : st.note;
  $('t-hint').hidden = st.phase !== 'yourMove' || !!st.answer;
  $('t-next').hidden = st.phase !== 'lineDone';
  // at the end of a line you can write (or edit) the note for the final position
  trainEndKey = st.phase === 'lineDone' ? st.keys[st.keys.length - 1] : null;
  $('t-note-btn').hidden = !trainEndKey;
  $('t-note-btn').textContent = st.note ? 'Edit note' : 'Note this position';
  if (!trainEndKey) $('t-note-edit').hidden = true;
  $('t-next').textContent = st.mode === 'game' ? 'Next game' : 'Next line';
  if (st.phase === 'lineDone') {
    // the end position is worth a look: name the opening and leave the board as it is
    const name = O.nameOf(st.keys);
    fb.className = 't-feedback ok';
    fb.textContent = (st.feedback?.ok ? st.feedback.text + ' · ' : '') + (name ? `${name.eco} · ${name.name}` : '');
  }
  $('t-stop').textContent = st.phase === 'done' ? 'Back to builder' : 'Stop';
}

$('train-go').onclick = openTrainStart;
$('ts-close').onclick = closeTrainStart;
for (const b of $('ts-scope').children) b.onclick = () => { tsScope = b.dataset.scope; renderTrainStart(); };
for (const b of document.querySelectorAll('.ts-mode')) b.onclick = () => startTraining(b.dataset.mode);
$('t-stop').onclick = stopTraining;
$('t-hint').onclick = () => session?.hint();
$('t-next').onclick = () => session?.next();
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'TEXTAREA') return;
  if (session && !$('t-next').hidden && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight')) { e.preventDefault(); session.next(); }
});

let trainEndKey = null;
$('t-note-btn').onclick = () => {
  $('t-note-text').value = R.node(rep, trainEndKey)?.note || '';
  $('t-note-edit').hidden = false;
  $('t-note-btn').hidden = true;
  $('t-note-text').focus();
};
$('t-note-cancel').onclick = () => { $('t-note-edit').hidden = true; $('t-note-btn').hidden = !trainEndKey; };
$('t-note-save').onclick = () => {
  if (!trainEndKey) return;
  const text = $('t-note-text').value.trim();
  R.setNote(rep, trainEndKey, text);
  persist();
  $('t-note').textContent = text;
  $('t-note-edit').hidden = true;
  $('t-note-btn').hidden = false;
  $('t-note-btn').textContent = text ? 'Edit note' : 'Note this position';
  toast(text ? 'Note saved.' : 'Note removed.');
};

/* ---------- study: master games + theory ---------- */

let studyTab = localStorage.getItem('chessrep.study') || 'games';
let studyToken = 0, studyTimer = null, studyKey = null, studyAll = false, studyInRep = false;

const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function scheduleStudy(inRep) {
  studyInRep = inRep;
  for (const b of $('study-tabs').children) b.classList.toggle('on', b.dataset.tab === studyTab);
  $('study-games').hidden = studyTab !== 'games';
  $('study-theory').hidden = studyTab !== 'theory';
  const pos = line.slice(0, cur).map(m => m.san).join(' ');
  const key = studyTab + '|' + pos;
  if (key === studyKey) return;          // same position and tab: keep what is shown
  if (studyKey && studyKey.split('|')[1] !== pos) studyAll = false;
  studyKey = key;
  clearTimeout(studyTimer);
  studyTimer = setTimeout(studyTab === 'games' ? loadGames : loadTheory, 180);
}

async function loadGames() {
  const token = ++studyToken;
  const el = $('study-games');
  const fen = fenAt(cur), key = R.keyOf(fen);
  if (cur === 0) {
    const m = await G.meta().catch(() => null);
    if (token === studyToken) el.innerHTML = `<p class="hint">Play or pick a first move to see the master games${m ? ` — ${m.games.toLocaleString()} classical games by ${m.players.length} of the all-time greats` : ''}.</p>`;
    return;
  }
  let res;
  try { res = await G.gamesAt(fen, cur); }
  catch { if (token === studyToken) el.innerHTML = '<p class="hint">Could not load the games collection — are you offline?</p>'; return; }
  if (token !== studyToken) return;

  if (res.beyond) {
    el.innerHTML = '<p class="hint">Master games are indexed for the first 15 moves. Step back to see the games that reached this line.</p>';
    return;
  }
  const { games } = res;
  if (!games.length) {
    el.innerHTML = `<p class="hint">None of the ${res.total.toLocaleString()} master games in the collection reach this position.</p>`;
    return;
  }
  const next = G.nextMoves(games).slice(0, 6);
  const shown = studyAll ? games : games.slice(0, 8);
  el.innerHTML = `
    <p class="g-sum">${games.length}${games.length >= 40 ? '+' : ''} master game${games.length === 1 ? '' : 's'} reach this position${next.length ? ' — played here:' : ''}</p>
    ${next.length ? `<div class="chips">${next.map(m => `<span class="chip${R.hasMove(rep, key, m.san) ? ' mine' : ''}">${esc(m.san)}<small>${m.n}</small></span>`).join('')}</div>` : ''}
    <ul class="glist">${shown.map((g, i) => `
      <li><button data-i="${i}">
        <span class="who">${esc(g.white)} – ${esc(g.black)}</span>
        <span class="res${g.result === '1-0' || g.result === '0-1' ? ' w' : ''}">${esc(g.result.replace('1/2-1/2', '½-½'))}</span>
        <span class="meta">${esc([g.event, g.year || ''].filter(Boolean).join(' · '))}${g.eco ? ' · ' + esc(g.eco) : ''}</span>
      </button></li>`).join('')}</ul>
    ${games.length > shown.length ? `<button class="btn more" id="g-more">Show all ${games.length}</button>` : ''}`;
  el.querySelectorAll('.glist button').forEach(b => b.onclick = () => openGame(shown[+b.dataset.i]));
  $('g-more')?.addEventListener('click', () => { studyAll = true; studyKey = null; scheduleStudy(studyInRep); });
}

async function loadTheory() {
  const token = ++studyToken;
  const el = $('study-theory');
  const sans = line.slice(0, cur).map(m => m.san);
  el.innerHTML = '<p class="hint">Loading…</p>';
  let t;
  try { t = await TH.theoryFor(sans); }
  catch { if (token === studyToken) el.innerHTML = '<p class="hint">Could not reach Wikibooks — are you offline?</p>'; return; }
  if (token !== studyToken) return;
  if (t.missing || !t.blocks.length) {
    el.innerHTML = '<div class="theory"><p class="hint">Wikibooks has no article for this exact move order yet.</p></div>';
    return;
  }
  const link = `<a href="${esc(TH.pageUrl(t.title))}" target="_blank" rel="noopener">`;
  const box = document.createElement('div');
  box.className = 'theory';
  const body = document.createElement('div');
  let list = null;
  for (const b of t.blocks.slice(0, 40)) {
    if (b.tag === 'li') {
      if (!list) { list = document.createElement('ul'); body.appendChild(list); }
      const li = document.createElement('li'); li.textContent = b.text; list.appendChild(li);
      continue;
    }
    list = null;
    const n = document.createElement(b.tag === 'h' ? 'h3' : 'p');
    n.textContent = b.text;
    body.appendChild(n);
  }
  if (t.blocks.length > 8) body.className = 'clip';
  box.appendChild(body);
  box.insertAdjacentHTML('beforeend', `<p class="src">${t.blocks.length > 8 ? `${link}Read the full article</a> · ` : ''}From Wikibooks <i>${esc(t.title)}</i> (${link}CC BY-SA</a>)</p>`);
  el.replaceChildren(box);
}

for (const b of $('study-tabs').children) b.onclick = () => {
  studyTab = b.dataset.tab;
  try { localStorage.setItem('chessrep.study', studyTab); } catch {}
  scheduleStudy(studyInRep);
};

/* ---------- game viewer ---------- */

let viewer = null;   // { g, ply, leave, noteKey }

function openGame(g, ply = g.at) {
  // the first move of the game that is not in the repertoire
  const chess = new Chess();
  let leave = 0;
  while (leave < g.moves.length && R.hasMove(rep, R.keyOf(chess.fen()), g.moves[leave])) chess.move(g.moves[leave++]);
  const noteKey = viewer ? viewer.noteKey : studyInRep ? R.keyOf(fenAt(cur)) : null;
  viewer = { g, ply, leave, noteKey };
  document.body.classList.add('viewing');
  board.interactive = false;
  window.scrollTo({ top: 0 });
  showViewer();
}

function closeGame() {
  viewer = null;
  board.interactive = true;
  document.body.classList.remove('viewing');
  studyKey = null;                       // refresh chips: the repertoire may have grown
  render();
}

function viewerGo(p) {
  viewer.ply = Math.max(0, Math.min(viewer.g.moves.length, p));
  showViewer();
}

function showViewer() {
  const { g, ply, leave } = viewer;
  const chess = new Chess();
  let last = null;
  for (let i = 0; i < ply; i++) last = chess.move(g.moves[i]);
  const lastMove = last && { from: last.from, to: last.to };
  board.set(chess, { lastMove });
  mini.set(chess, { lastMove });

  const elo = n => (n ? ` (${n})` : '');
  $('v-players').textContent = `${g.white}${elo(g.wElo)} – ${g.black}${elo(g.bElo)}`;
  $('v-event').textContent = [g.event, g.site, g.year || '', g.result.replace('1/2-1/2', '½-½')].filter(Boolean).join(' · ');
  const label = p => `${Math.floor(p / 2) + 1}${p % 2 ? '…' : '.'}${g.moves[p]}`;
  $('v-status').innerHTML = (leave === 0 ? 'Leaves your repertoire at the first move.'
    : leave >= g.moves.length ? 'Follows your repertoire all the way.'
    : `Follows your repertoire until <b>${esc(label(leave))}</b>.`) + ` Move ${Math.ceil(ply / 2)} of ${Math.ceil(g.moves.length / 2)}.`;

  const list = $('v-moves');
  list.innerHTML = g.moves.map((san, i) =>
    (i % 2 ? '' : `<span class="num">${i / 2 + 1}.</span>`) +
    `<button data-p="${i + 1}" class="${i < leave ? 'in' : ''}${i === ply - 1 ? ' cur' : ''}">${esc(san)}</button>`).join(' ');
  list.querySelectorAll('button').forEach(b => b.onclick = () => viewerGo(+b.dataset.p));
  const curBtn = list.querySelector('.cur');
  if (curBtn) {
    const top = curBtn.offsetTop - list.offsetTop;
    if (top < list.scrollTop || top > list.scrollTop + list.clientHeight - 30) list.scrollTop = top - 60;
  }
  $('v-save').disabled = ply === 0;
  $('v-note').hidden = !viewer.noteKey;
}

$('v-close').onclick = closeGame;
$('v-first').onclick = () => viewerGo(0);
$('v-prev').onclick = () => viewerGo(viewer.ply - 1);
$('v-next').onclick = () => viewerGo(viewer.ply + 1);
$('v-last').onclick = () => viewerGo(Infinity);
$('v-save').onclick = () => {
  const chess = new Chess();
  let added = 0;
  for (const san of viewer.g.moves.slice(0, viewer.ply)) {
    const key = R.keyOf(chess.fen());
    const m = chess.move(san);
    if (!R.hasMove(rep, key, m.san)) { R.addMove(rep, key, m.san, m.from + m.to + (m.promotion || '')); added++; }
  }
  persist();
  toast(added ? `Added ${added} new move${added === 1 ? '' : 's'} to your repertoire.` : 'Those moves are already in your repertoire.');
  openGame(viewer.g, viewer.ply);       // recompute where it now leaves the repertoire
};
$('v-note').onclick = () => {
  const g = viewer.g;
  const ref = `Model game: ${g.white} – ${g.black}, ${[g.event, g.year].filter(Boolean).join(' ')} (${g.result})`;
  const n = R.node(rep, viewer.noteKey);
  if (n?.note?.includes(ref)) { toast('Already in the note.'); return; }
  R.setNote(rep, viewer.noteKey, n?.note ? n.note + '\n' + ref : ref);
  persist();
  toast('Added to the note for this position.');
};
$('v-copy').onclick = async () => {
  try { await navigator.clipboard.writeText(G.pgnOf(viewer.g)); toast('Game copied as PGN.'); }
  catch { toast('Copy failed.'); }
};

function countAll() {
  const counter = R.lineCounter(rep);
  return R.movesAt(rep, R.START_KEY).reduce((s, m) => s + counter(DEFAULT_POSITION, m.san), 0);
}

/* ---------- wiring ---------- */

$('nav-first').onclick = () => go(0);
$('nav-prev').onclick = () => go(cur - 1);
$('nav-next').onclick = next;
$('nav-last').onclick = () => go(line.length);
$('nav-flip').onclick = () => {
  const o = board.orientation === 'w' ? 'b' : 'w';
  board.setOrientation(o);
  mini.setOrientation(o);
};
$('save-line').onclick = saveLine;
for (const b of document.querySelectorAll('.seg button')) b.onclick = () => switchSide(b.dataset.side);

$('note').addEventListener('input', e => {
  R.setNote(rep, R.keyOf(fenAt(cur)), e.target.value);
  persist();
});

document.addEventListener('keydown', e => {
  if (viewer && !['TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
    const k = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -999, Home: -999, ArrowDown: 999, End: 999 }[e.key];
    if (k) { viewerGo(viewer.ply + k); e.preventDefault(); }
    return;
  }
  if (session || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || !$('sheet').hidden) return;
  if (e.key === 'ArrowLeft') go(cur - 1);
  else if (e.key === 'ArrowRight') next();
  else if (e.key === 'ArrowUp' || e.key === 'Home') go(0);
  else if (e.key === 'ArrowDown' || e.key === 'End') go(line.length);
  else return;
  e.preventDefault();
});

/* ---------- PGN sheet: import / export ---------- */

let pending = null;        // parsed games awaiting the Import button
let undoSnapshot = null;   // reps as they were before the last import / master update
let undoSync = null;       // data.sync as it was, when the undo is for a master update

const clone = x => JSON.parse(JSON.stringify(x));
const sideName = s => (s === 'w' ? 'White' : 'Black');

function openSheet() { resetImport(); renderSync(); loadFollowList(); $('toast').hidden = true; $('sheet').hidden = false; }
function closeSheet() { $('sheet').hidden = true; resetImport(); }

function rememberLink(link, side) {
  const games = pending || [];
  const name = games.find(g => g.headers.StudyName)?.headers.StudyName
    || (games[0] ? `${games[0].headers.White || '?'} – ${games[0].headers.Black || '?'}` : link.url);
  const chapter = link.kind === 'chapter' ? games[0]?.headers.ChapterName : '';
  data.links = (data.links || []).filter(l => l.url !== link.url);
  data.links.unshift({ url: link.url, kind: link.kind, name: chapter ? `${name}: ${chapter}` : name, side, imported: new Date().toISOString() });
  data.links = data.links.slice(0, 12);
}

function renderLinks() {
  const links = data.links || [];
  $('links').hidden = !links.length;
  $('links-list').innerHTML = links.map((l, i) => `
    <li><span>${esc(l.name)}<small>${l.kind} · ${sideName(l.side)} · imported ${when(l.imported)}</small></span>
      <button class="linkbtn" data-reimport="${i}">Re-import</button>
      <button class="linkbtn" data-forget="${i}" aria-label="Forget">✕</button></li>`).join('');
}

$('links-list').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  const links = data.links || [];
  if (b.dataset.reimport) { const l = links[+b.dataset.reimport]; importFromLink(l.url, l.side); }
  if (b.dataset.forget) { links.splice(+b.dataset.forget, 1); persist(); renderLinks(); }
});

$('clip-go').onclick = async () => {
  let text = '';
  try { text = await navigator.clipboard.readText(); }
  catch { toast('Could not read the clipboard — use "Type or paste" instead.'); return; }
  if (!text.trim()) { toast('The clipboard is empty.'); return; }
  readPgn(text);
};

function resetImport() {
  pending = null;
  pendingLink = null;
  renderLinks();
  $('import-start').hidden = false;
  $('import-review').hidden = true;
  $('paste-box').hidden = true;
  $('pgn-text').value = '';
  $('pgn-file').value = '';
}

// A backup file tags every game with [Repertoire "w"|"b"]; those go back to their own side.
const isBackup = games => games.every(g => g.headers.Repertoire === 'w' || g.headers.Repertoire === 'b');

let pendingBackup = null;  // a full JSON backup awaiting Restore
let pendingLink = null;    // the Lichess link a pending import was fetched from

/* Lichess links the app can fetch directly (their PGN exports are open to other sites).
   -> { api, kind } or null */
function lichessLink(text) {
  const m = text.trim().match(/^(?:https?:\/\/)?(?:www\.)?lichess\.org\/(.+)$/i);
  if (!m) return null;
  const path = m[1].split(/[?#]/)[0].replace(/\/+$/, '');
  let x;
  if ((x = path.match(/^study\/([A-Za-z0-9]{8})\/([A-Za-z0-9]{8})$/))) return { kind: 'chapter', api: `https://lichess.org/api/study/${x[1]}/${x[2]}.pgn?clocks=false&orientation=true` };
  if ((x = path.match(/^study\/([A-Za-z0-9]{8})$/))) return { kind: 'study', api: `https://lichess.org/api/study/${x[1]}.pgn?clocks=false&orientation=true` };
  if ((x = path.match(/^(?:game\/export\/)?([A-Za-z0-9]{8})(?:[A-Za-z0-9]{4})?(?:\/(?:white|black))?$/))) return { kind: 'game', api: `https://lichess.org/game/export/${x[1]}?clocks=false&evals=false` };
  return null;
}

async function importFromLink(url, side = null) {
  const link = lichessLink(url);
  if (!link) { toast('That is not a Lichess study, chapter or game link.'); return; }
  $('import-start').hidden = true;
  $('import-review').hidden = false;
  $('imp-summary').textContent = 'Fetching from Lichess…';
  $('imp-options').hidden = true;
  $('imp-preview').textContent = '';
  $('imp-go').disabled = true;
  let text;
  try {
    const r = await fetch(link.api, { headers: { Accept: 'application/x-chess-pgn' }, cache: 'no-store' });
    if (r.status === 404 || r.status === 403) throw new Error(link.kind === 'game' ? 'Lichess could not find that game.' : 'Lichess could not find that study — is it set to Public or Unlisted?');
    if (!r.ok) throw new Error(`Lichess said ${r.status}.`);
    text = await r.text();
  } catch (e) {
    resetImport();
    toast(e.message.startsWith('Lichess') ? e.message : 'Could not reach Lichess — are you offline?');
    return;
  }
  readPgn(text, { url: url.trim(), kind: link.kind, side });
}

function readPgn(text, link = null) {
  pendingBackup = null;
  pendingLink = link;
  if (!link && lichessLink(text)) { importFromLink(text); return; }
  if (text.trim().startsWith('{')) {
    let b = null;
    try { b = JSON.parse(text); } catch {}
    if (b?.kind !== 'chess-repertoire-backup' || !b.reps?.w || !b.reps?.b) { toast('That file is not a repertoire backup.'); return; }
    pendingBackup = b;
    pending = [];
    $('imp-summary').textContent = `Full backup from ${new Date(b.saved).toLocaleString()}.`;
    $('imp-options').hidden = true;
    $('imp-preview').textContent = 'Restoring replaces both repertoires on this device — moves, notes and training progress.';
    $('imp-go').disabled = false;
    $('imp-go').textContent = 'Restore';
    $('import-start').hidden = true;
    $('import-review').hidden = false;
    return;
  }
  $('imp-go').textContent = 'Import';
  const games = PGN.parse(text).filter(g => g.root.children.length);
  if (!games.length) { toast('No moves found in that PGN.'); return; }
  pending = games;
  const backup = isBackup(games);
  const names = [...new Set(games.map(g => g.headers.Event).filter(e => e && e !== '?'))].slice(0, 3);
  $('imp-summary').textContent = backup
    ? `Repertoire backup: ${[...new Set(games.map(g => sideName(g.headers.Repertoire)))].join(' + ')}.`
    : `${games.length} game${games.length === 1 ? '' : 's'}${names.length ? ' — ' + names.join(', ') : ''}.`;
  $('imp-options').hidden = backup;
  $('imp-side').value = guessSide(games, link);
  $('imp-depth').value = link?.kind === 'game' ? '24' : link ? '0' : games.length > 1 && !games.some(g => hasVariations(g.root)) ? '24' : '0';
  if (link) {
    const study = games.find(g => g.headers.StudyName)?.headers.StudyName;
    $('imp-summary').textContent = `From Lichess: ${study || games[0].headers.Event || 'game'}` +
      (link.kind === 'study' ? ` (${games.length} chapter${games.length === 1 ? '' : 's'})` : '') + '.';
  }
  $('import-start').hidden = true;
  $('import-review').hidden = false;
  updatePreview();
}

/* Which repertoire an import belongs in: where this link went last time; else a Lichess chapter
   flipped to Black's side (the export says [Orientation "black"]); else the repertoire that
   already shares the most of these moves; else the one on screen. */
function guessSide(games, link) {
  if (link?.side) return link.side;
  const orient = games.map(g => g.headers.Orientation).filter(Boolean);
  if (orient.length && orient.every(o => o === 'black')) return 'b';
  if (orient.length && orient.some(o => o === 'black')) return data.active;   // mixed study: let the user pick
  const overlap = side => { const r = PGN.importGames(clone(data.reps[side]), games); return r.moves - r.added; };
  const w = overlap('w'), b = overlap('b');
  if (w !== b) return w > b ? 'w' : 'b';
  return orient.length ? 'w' : data.active;
}

function hasVariations(node) {
  return node.children.length > 1 || node.children.some(hasVariations);
}

// Runs the import against copies of the repertoires; returns the copies and the counts.
function simulate() {
  if (pendingBackup) {
    const reps = clone(pendingBackup.reps);
    return { reps, total: { games: 0, moves: 0, added: 0, skipped: 0, bad: 0 } };
  }
  const reps = clone(data.reps);
  const total = { games: 0, moves: 0, added: 0, skipped: 0, bad: 0 };
  const add = r => { for (const k in total) total[k] += r[k]; };
  if (isBackup(pending)) {
    for (const side of ['w', 'b']) add(PGN.importGames(reps[side], pending.filter(g => g.headers.Repertoire === side)));
  } else {
    add(PGN.importGames(reps[$('imp-side').value], pending, { maxPly: +$('imp-depth').value }));
  }
  return { reps, total };
}

function updatePreview() {
  const { total: t } = simulate();
  let msg = t.added
    ? `${t.added} new move${t.added === 1 ? '' : 's'} will be added (${t.moves} read).`
    : `Nothing new — all ${t.moves} moves are already in the repertoire.`;
  if (t.skipped) msg += ` ${t.skipped} game${t.skipped === 1 ? '' : 's'} skipped (start from a custom position).`;
  if (t.bad) msg += ` ${t.bad} move${t.bad === 1 ? '' : 's'} could not be read and were left out.`;
  $('imp-preview').textContent = msg;
  $('imp-go').disabled = !t.added;
}

function doImport() {
  const { reps, total } = simulate();
  undoSnapshot = clone(data.reps);
  undoSync = null;
  data.reps = reps;
  if (pendingLink && !pendingBackup) rememberLink(pendingLink, $('imp-side').value);
  rep = data.reps[data.active];
  line = []; cur = 0;
  persist();
  closeSheet();
  render();
  toast(pendingBackup ? 'Backup restored.' : `Imported ${total.added} new move${total.added === 1 ? '' : 's'}.`, true);
}

function undoImport() {
  if (!undoSnapshot) return;
  data.reps = undoSnapshot;
  undoSnapshot = null;
  if (undoSync) { data.sync = undoSync; undoSync = null; renderSync(); }
  rep = data.reps[data.active];
  line = []; cur = 0;
  persist();
  render();
  toast('Import undone.');
}

let toastTimer;
function toast(text, withUndo = false) {
  $('toast-text').textContent = text;
  $('toast-undo').hidden = !withUndo;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, withUndo ? 8000 : 3000);
}

const today = () => new Date().toISOString().slice(0, 10);

async function deliver(text, filename) {
  const file = new File([text], filename, { type: 'text/plain' });
  // On iPhone the share sheet is the way to save a file (Save to Files, AirDrop, Mail…)
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const backupText = () => JSON.stringify({ kind: 'chess-repertoire-backup', version: 1, saved: new Date().toISOString(), reps: data.reps });

$('menu-btn').onclick = openSheet;
$('sheet-close').onclick = closeSheet;
$('sheet').addEventListener('click', e => { if (e.target === $('sheet')) closeSheet(); });
$('pgn-file').onchange = async e => { const f = e.target.files[0]; if (f) readPgn(await f.text()); };
$('paste-toggle').onclick = () => { $('paste-box').hidden = false; $('pgn-text').focus(); };
$('paste-go').onclick = () => readPgn($('pgn-text').value);
$('imp-side').onchange = updatePreview;
$('imp-depth').onchange = updatePreview;
$('imp-go').onclick = doImport;
$('imp-cancel').onclick = resetImport;
$('toast-undo').onclick = undoImport;
$('exp-side').onclick = () => deliver(PGN.exportRep(rep), `repertoire-${sideName(rep.side).toLowerCase()}-${today()}.pgn`);
$('exp-all').onclick = () => deliver(backupText(), `chess-repertoire-backup-${today()}.json`);
$('exp-copy').onclick = async () => {
  try { await navigator.clipboard.writeText(PGN.exportRep(rep)); toast(`${sideName(rep.side)} repertoire copied as PGN.`); }
  catch { toast('Copy failed — use Export instead.'); }
};

/* ---------- master copy sync ---------- */

data.sync ||= { role: '', name: '', follow: '', applied: null, base: null, publishedAt: null, publishedSig: null };
const TOKEN = 'chessrep.ghtoken';
const getToken = () => { try { return localStorage.getItem(TOKEN) || ''; } catch { return ''; } };
const when = iso => iso ? new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
const sig = c => String(G.fnv1a(JSON.stringify(c)));
let latestMaster = null, lastCheck = 0;

// What this device changed since the master it last applied. Before any master has been
// applied, compare with the master itself and count only what this device has extra.
function localChanges(m = latestMaster) {
  const cur = S.content(data.reps);
  if (data.sync.base) return S.diff(data.sync.base, cur);
  return m ? { ...S.diff(m.reps, cur), removed: [] } : S.diff(null, cur);
}

function setStatus(id, text, kind = '') {
  $(id).textContent = text;
  $(id).className = 'hint' + (kind ? ' status-' + kind : '');
}

function renderSync() {
  const sy = data.sync;
  $('sync-role').value = sy.role;
  $('sync-publish').hidden = sy.role !== 'publish';
  $('sync-follow').hidden = sy.role !== 'follow';
  if (document.activeElement !== $('sync-name')) $('sync-name').value = sy.name || '';
  const hasToken = !!getToken();
  $('sync-token-row').hidden = hasToken;
  $('sync-token-ok').hidden = !hasToken;

  if (sy.role === 'publish') {
    const dirty = sy.publishedSig !== sig(S.content(data.reps));
    setStatus('sync-pub-status', !sy.publishedAt ? 'Not published yet.'
      : `Last published ${when(sy.publishedAt)} — ${dirty ? 'changes since then are not published yet.' : 'up to date.'}`, sy.publishedAt && !dirty ? 'ok' : '');
  }
  if (sy.role === 'follow') {
    const n = S.changeCount(localChanges());
    const who = $('sync-who').selectedOptions[0]?.textContent || sy.follow;
    setStatus('sync-fol-status', !sy.follow ? 'Choose whose master to follow.'
      : `${sy.applied ? `On ${who}'s master from ${when(sy.applied)}.` : `Not updated from ${who}'s master yet.`}` +
        (n ? ` ${n} change${n === 1 ? '' : 's'} made on this device.` : ''));
    $('sync-send').disabled = !n;
  }
}

async function loadFollowList() {
  if (data.sync.role !== 'follow') return;
  const sel = $('sync-who');
  try {
    const list = await S.fetchIndex();
    sel.innerHTML = '<option value="">Choose…</option>' + list.map(e => `<option value="${esc(e.slug)}">${esc(e.name)}</option>`).join('');
    if (data.sync.follow && !list.some(e => e.slug === data.sync.follow)) sel.insertAdjacentHTML('beforeend', `<option value="${esc(data.sync.follow)}">${esc(data.sync.follow)}</option>`);
    sel.value = data.sync.follow || '';
    if (!list.length) setStatus('sync-fol-status', 'Nobody has published a master yet.');
    else renderSync();
  } catch { setStatus('sync-fol-status', 'Could not reach GitHub — are you offline?', 'bad'); }
}

// Ask whether the followed master is newer than the one applied; show the banner if so.
async function checkMaster(manual) {
  const sy = data.sync;
  if (sy.role !== 'follow' || !sy.follow) return;
  lastCheck = Date.now();
  if (manual) setStatus('sync-fol-status', 'Checking…');
  let m;
  try { m = await S.fetchMaster(sy.follow); }
  catch { if (manual) setStatus('sync-fol-status', 'Could not reach GitHub — are you offline?', 'bad'); return; }
  if (!m) { if (manual) setStatus('sync-fol-status', 'That master has not been published yet.'); return; }
  latestMaster = m;
  if (m.published === sy.applied) {
    $('sync-banner').hidden = true;
    if (manual) { renderSync(); toast('Already on the latest master.'); }
    return;
  }
  const n = S.changeCount(localChanges());
  $('sync-banner-text').textContent = `${m.name}'s master was updated ${when(m.published)}.` +
    (n ? ` This device has ${n === 1 ? '1 change' : `${n} changes`} of its own — updating replaces ${n === 1 ? 'it' : 'them'}, so send ${n === 1 ? 'it' : 'them'} first if you want to keep ${n === 1 ? 'it' : 'them'}.` : '');
  $('sb-send').hidden = !n;
  $('sync-banner').hidden = false;
  if (manual) { closeSheet(); renderSync(); }
}

function updateFromMaster() {
  const m = latestMaster;
  if (!m) return;
  undoSnapshot = clone(data.reps);
  undoSync = clone(data.sync);
  data.reps = S.applyMaster(data.reps, m);
  data.sync.applied = m.published;
  data.sync.base = m.reps;
  rep = data.reps[data.active];
  line = []; cur = 0;
  persist();
  $('sync-banner').hidden = true;
  render();
  renderSync();
  toast(`Updated to ${m.name}'s master.`, true);
}

function sendChanges() {
  const d = localChanges();
  const reps = S.changesReps(data.reps, d);
  const games = ['w', 'b'].filter(s => Object.keys(reps[s].pos).length)
    .map(s => PGN.exportRep(reps[s], { Event: `${sideName(s)} repertoire — changes` }));
  if (!games.length) { toast(d.removed.length ? 'Only deletions here — redo those on the PC.' : 'No changes to send.'); return; }
  deliver(games.join('\n'), `repertoire-changes-${today()}.pgn`);
  if (d.removed.length) setTimeout(() => toast(`${d.removed.length} deletion${d.removed.length === 1 ? '' : 's'} can't travel in a PGN — repeat ${d.removed.length === 1 ? 'it' : 'them'} on the PC.`), 600);
}

async function publishMaster() {
  const token = getToken();
  if (!data.sync.name?.trim()) { setStatus('sync-pub-status', 'Enter your name first.', 'bad'); return; }
  if (!token) { setStatus('sync-pub-status', 'Paste your GitHub token first.', 'bad'); return; }
  $('sync-publish-go').disabled = true;
  setStatus('sync-pub-status', 'Publishing…');
  try {
    const r = await S.publish(data.reps, data.sync.name, token);
    data.sync.publishedAt = r.published;
    data.sync.publishedSig = sig(r.content);
    persist();
    renderSync();
    setStatus('sync-pub-status', `Published ${when(r.published)}. Devices following you will offer the update next time they open.`, 'ok');
  } catch (e) {
    setStatus('sync-pub-status', `Not published: ${e.message}.`, 'bad');
  } finally {
    $('sync-publish-go').disabled = false;
  }
}

$('sync-role').onchange = e => {
  data.sync.role = e.target.value;
  persist();
  renderSync();
  loadFollowList();
};
$('sync-name').onchange = e => { data.sync.name = e.target.value.trim(); persist(); renderSync(); };
$('sync-token').onchange = e => {
  const t = e.target.value.trim();
  e.target.value = '';
  if (t) { try { localStorage.setItem(TOKEN, t); } catch {} }
  renderSync();
};
$('sync-token-clear').onclick = () => { try { localStorage.removeItem(TOKEN); } catch {} renderSync(); };
$('sync-publish-go').onclick = publishMaster;
$('sync-who').onchange = e => {
  data.sync.follow = e.target.value;
  data.sync.applied = null;              // a different master: offer it fresh
  persist();
  renderSync();
  checkMaster(true);
};
$('sync-check').onclick = () => checkMaster(true);
$('sync-send').onclick = sendChanges;
$('sb-update').onclick = updateFromMaster;
$('sb-send').onclick = sendChanges;
$('sb-later').onclick = () => { $('sync-banner').hidden = true; };
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - lastCheck > 5 * 60000) checkMaster(false);
});

// The header is sticky; things that stick or scroll beneath it need its height.
new ResizeObserver(([e]) => document.documentElement.style.setProperty('--head-h', `${e.target.offsetHeight}px`))
  .observe(document.querySelector('.top'));

render();
renderSync();
checkMaster(false);

if ('serviceWorker' in navigator && location.hostname !== '127.0.0.1' && location.hostname !== 'localhost') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
