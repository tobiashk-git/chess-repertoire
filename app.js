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

  // the line on the board as its own dashed column while it has unsaved moves
  const unsaved = line.some((_, i) => !isSaved(i));
  if (unsaved) {
    const moves = line.map(m => ({ san: m.san, uci: m.uci, key: R.keyOf(m.fen) }));
    let branch = 0;
    while (line[branch] && isSaved(branch)) branch++;
    cols.unshift({ moves, branch, label: 'Unsaved', unsaved: true });
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
  let h = '<table class="lt"><thead><tr><th class="no" rowspan="2">#</th>';
  for (const c of shown) {
    h += `<th class="lname${c === active ? ' act' : ''}${c.unsaved ? ' unsaved' : ''}" colspan="2">${c.label}</th>`;
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

// Tap a cell: load that column's whole line onto the board, positioned after that move.
$('lines').addEventListener('click', e => {
  const td = e.target.closest('td[data-c]');
  if (!td) return;
  const col = tableCols[+td.dataset.c];
  const chess = new Chess();
  line = col.moves.map(m => {
    const mv = chess.move(m.san);
    return { san: mv.san, from: mv.from, to: mv.to, uci: m.uci || mv.from + mv.to + (mv.promotion || ''), fen: chess.fen() };
  });
  cur = +td.dataset.p + 1;
  render();
});

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
  $('train-go').disabled = !s.due;
  $('train-here').hidden = !(cur > 0 && inRep && s.due);
}

function startTraining(fromHere) {
  const opts = fromHere ? { prefixKey: R.keyOf(fenAt(cur)), prefixLen: cur } : {};
  const s = new T.Session(rep, { ...opts, ui: { show: showTrain }, save: persist });
  if (!s.dueCount()) { toast(fromHere ? 'Nothing due in the lines from here.' : 'Nothing due — all caught up.'); return; }
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

  const { tested, firstTry, lines } = st.stats;
  $('t-progress').textContent = st.phase === 'done' ? `${lines} line${lines === 1 ? '' : 's'} played`
    : `${st.due} due · ${firstTry}/${tested} first try`;
  $('t-prompt').textContent = {
    yourMove: 'Your move', opponent: 'Opponent to move…', lineDone: 'Line complete ✓', done: 'Session complete',
  }[st.phase];

  const fb = $('t-feedback');
  if (st.phase === 'done') {
    const pct = tested ? Math.round(firstTry / tested * 100) : 100;
    fb.className = 't-feedback ok';
    fb.textContent = tested ? `${firstTry} of ${tested} found first time (${pct}%). Misses came back until you got them, and will come round sooner.` : 'Nothing left to review.';
  } else {
    fb.className = 't-feedback' + (st.feedback ? (st.feedback.alt ? ' alt' : st.feedback.ok ? ' ok' : ' bad') : '');
    fb.textContent = st.feedback?.text || (st.phase === 'yourMove' ? 'What do you play here?' : '');
  }
  $('t-note').textContent = st.phase === 'done' ? '' : st.note;
  $('t-hint').hidden = st.phase !== 'yourMove' || !!st.answer;
  $('t-stop').textContent = st.phase === 'done' ? 'Back to builder' : 'Stop';
}

$('train-go').onclick = () => startTraining(false);
$('train-here').onclick = () => startTraining(true);
$('t-stop').onclick = stopTraining;
$('t-hint').onclick = () => session?.hint();

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
