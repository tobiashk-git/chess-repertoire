/* Repertoire model. A repertoire is a graph of positions, not a tree of move strings:
   each position (FEN minus the move clocks) stores the moves that leave it and a note.
   Keying by position means transpositions merge for free — reach the same position by two
   move orders and you see the same continuations.

   Shape saved to localStorage:
     { version: 1, active: 'w', reps: { w: Rep, b: Rep } }
     Rep = { side: 'w'|'b', pos: { [key]: { moves: [{ san, uci }], note: '' } } }        */

import { Chess, DEFAULT_POSITION } from './vendor/chess.js';

const STORE = 'chessrep.v1';

export const keyOf = fen => fen.split(' ').slice(0, 4).join(' ');
export const START_KEY = keyOf(DEFAULT_POSITION);

const emptyRep = side => ({ side, pos: {} });

export function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORE));
    if (data?.version === 1) return data;
  } catch {}
  return { version: 1, active: 'w', reps: { w: emptyRep('w'), b: emptyRep('b') } };
}

export function save(data) {
  try { localStorage.setItem(STORE, JSON.stringify(data)); } catch (e) { console.warn('save failed', e); }
}

export function node(rep, key) { return rep.pos[key]; }

export function movesAt(rep, key) { return rep.pos[key]?.moves || []; }

export function hasMove(rep, key, san) { return movesAt(rep, key).some(m => m.san === san); }

export function addMove(rep, key, san, uci) {
  const n = rep.pos[key] ||= { moves: [], note: '' };
  if (!n.moves.some(m => m.san === san)) n.moves.push({ san, uci });
}

export function setNote(rep, key, text) {
  const n = rep.pos[key] ||= { moves: [], note: '' };
  n.note = text;
  prune(rep);
}

export function removeMove(rep, key, san) {
  const n = rep.pos[key];
  if (!n) return;
  n.moves = n.moves.filter(m => m.san !== san);
  prune(rep);
}

// Move a stored move to the front: the first of your moves is the "main" one.
export function makeMain(rep, key, san) {
  const n = rep.pos[key];
  if (!n) return;
  const i = n.moves.findIndex(m => m.san === san);
  if (i > 0) n.moves.unshift(...n.moves.splice(i, 1));
}

/* Drop positions no longer reachable from the start (after a delete), and empty nodes
   with no note. Walks the graph by replaying moves with chess.js. */
export function prune(rep) {
  const reach = new Set();
  const stack = [DEFAULT_POSITION];
  const chess = new Chess();
  while (stack.length) {
    const fen = stack.pop();
    const key = keyOf(fen);
    if (reach.has(key)) continue;
    reach.add(key);
    for (const m of movesAt(rep, key)) {
      chess.load(fen);
      try { chess.move(m.san); stack.push(chess.fen()); } catch {}
    }
  }
  for (const key of Object.keys(rep.pos)) {
    const n = rep.pos[key];
    if (!reach.has(key) || (!n.moves.length && !n.note)) delete rep.pos[key];
  }
}

/* Number of distinct lines (leaf positions reached) below a position — shown next to
   each candidate move. Memoised per call; cycles guarded. */
export function lineCounter(rep) {
  const memo = new Map();
  const chess = new Chess();
  const count = (fen, seen) => {
    const key = keyOf(fen);
    if (memo.has(key)) return memo.get(key);
    if (seen.has(key)) return 0;
    seen.add(key);
    const ms = movesAt(rep, key);
    let total = ms.length ? 0 : 1;
    for (const m of ms) {
      chess.load(fen);
      try { chess.move(m.san); } catch { continue; }
      total += count(chess.fen(), seen);
    }
    seen.delete(key);
    memo.set(key, total);
    return total;
  };
  return (fen, san) => {
    chess.load(fen);
    try { chess.move(san); } catch { return 0; }
    return count(chess.fen(), new Set());
  };
}
