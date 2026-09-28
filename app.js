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

const $ = id => document.getElementById(id);
const MINE = '#15803d', THEIRS = '#2563eb';

const data = R.load();
let rep = data.reps[data.active];
let line = [];      // [{ san, from, to, uci, fen }] — fen is the position AFTER the move
let cur = 0;

const board = new Board($('board'), { onMove: playMove });
board.setOrientation(rep.side);

const fenAt = i => (i === 0 ? DEFAULT_POSITION : line[i - 1].fen);
const isSaved = i => R.hasMove(rep, R.keyOf(fenAt(i)), line[i].san);
const persist = () => R.save(data);

/* ---------- moves ---------- */

function playMove(mv) {
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
  line.forEach((m, i) => R.addMove(rep, R.keyOf(fenAt(i)), m.san, m.uci));
  persist();
  render();
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
  persist();
  render();
}

/* ---------- render ---------- */

function render() {
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

  // stats
  const positions = Object.keys(rep.pos).length;
  const total = positions ? countAll() : 0;
  $('stats').textContent = positions
    ? `${rep.side === 'w' ? 'White' : 'Black'} repertoire · ${total} line${total === 1 ? '' : 's'} · ${positions} positions`
    : `${rep.side === 'w' ? 'White' : 'Black'} repertoire is empty`;
}

function countAll() {
  const counter = R.lineCounter(rep);
  return R.movesAt(rep, R.START_KEY).reduce((s, m) => s + counter(DEFAULT_POSITION, m.san), 0);
}

/* ---------- wiring ---------- */

$('nav-first').onclick = () => go(0);
$('nav-prev').onclick = () => go(cur - 1);
$('nav-next').onclick = next;
$('nav-last').onclick = () => go(line.length);
$('nav-flip').onclick = () => board.setOrientation(board.orientation === 'w' ? 'b' : 'w');
$('save-line').onclick = saveLine;
for (const b of document.querySelectorAll('.seg button')) b.onclick = () => switchSide(b.dataset.side);

$('note').addEventListener('input', e => {
  R.setNote(rep, R.keyOf(fenAt(cur)), e.target.value);
  persist();
});

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || !$('sheet').hidden) return;
  if (e.key === 'ArrowLeft') go(cur - 1);
  else if (e.key === 'ArrowRight') next();
  else if (e.key === 'ArrowUp' || e.key === 'Home') go(0);
  else if (e.key === 'ArrowDown' || e.key === 'End') go(line.length);
  else return;
  e.preventDefault();
});

/* ---------- PGN sheet: import / export ---------- */

let pending = null;        // parsed games awaiting the Import button
let undoSnapshot = null;   // reps as they were before the last import

const clone = x => JSON.parse(JSON.stringify(x));
const sideName = s => (s === 'w' ? 'White' : 'Black');

function openSheet() { resetImport(); $('toast').hidden = true; $('sheet').hidden = false; }
function closeSheet() { $('sheet').hidden = true; resetImport(); }

function resetImport() {
  pending = null;
  $('import-start').hidden = false;
  $('import-review').hidden = true;
  $('paste-box').hidden = true;
  $('pgn-text').value = '';
  $('pgn-file').value = '';
}

// A backup file tags every game with [Repertoire "w"|"b"]; those go back to their own side.
const isBackup = games => games.every(g => g.headers.Repertoire === 'w' || g.headers.Repertoire === 'b');

function readPgn(text) {
  const games = PGN.parse(text).filter(g => g.root.children.length);
  if (!games.length) { toast('No moves found in that PGN.'); return; }
  pending = games;
  const backup = isBackup(games);
  const names = [...new Set(games.map(g => g.headers.Event).filter(e => e && e !== '?'))].slice(0, 3);
  $('imp-summary').textContent = backup
    ? `Repertoire backup: ${[...new Set(games.map(g => sideName(g.headers.Repertoire)))].join(' + ')}.`
    : `${games.length} game${games.length === 1 ? '' : 's'}${names.length ? ' — ' + names.join(', ') : ''}.`;
  $('imp-options').hidden = backup;
  $('imp-side').value = data.active;
  $('imp-depth').value = games.length > 1 && !games.some(g => hasVariations(g.root)) ? '24' : '0';
  $('import-start').hidden = true;
  $('import-review').hidden = false;
  updatePreview();
}

function hasVariations(node) {
  return node.children.length > 1 || node.children.some(hasVariations);
}

// Runs the import against copies of the repertoires; returns the copies and the counts.
function simulate() {
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
  data.reps = reps;
  rep = data.reps[data.active];
  line = []; cur = 0;
  persist();
  closeSheet();
  render();
  toast(`Imported ${total.added} new move${total.added === 1 ? '' : 's'}.`, true);
}

function undoImport() {
  if (!undoSnapshot) return;
  data.reps = undoSnapshot;
  undoSnapshot = null;
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

const backupText = () => ['w', 'b'].map(s => PGN.exportRep(data.reps[s])).join('\n');

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
$('exp-all').onclick = () => deliver(backupText(), `chess-repertoire-backup-${today()}.pgn`);
$('exp-copy').onclick = async () => {
  try { await navigator.clipboard.writeText(PGN.exportRep(rep)); toast(`${sideName(rep.side)} repertoire copied as PGN.`); }
  catch { toast('Copy failed — use Export instead.'); }
};

render();

if ('serviceWorker' in navigator && location.hostname !== '127.0.0.1' && location.hostname !== 'localhost') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
