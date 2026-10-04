/* Model games: games you flag as the inspiration for a line, kept per repertoire in
   rep.models = [{ id, white, black, whiteFull, blackFull, wElo, bElo, year, event, site,
                   result, eco, moves: [san…], note, added }]
   Bundled master games get id "b:<n>", pasted PGN games "p:<hash>". A model game belongs to
   every position it passes through, so it shows up however you reached the position.   */

import { Chess } from './vendor/chess.js';
import { keyOf } from './repertoire.js';
import { fnv1a } from './games.js';
import * as PGN from './pgn.js';

const keyCache = new Map();   // id -> Map(position key -> number of moves played to reach it)

export const list = rep => rep.models || [];
export const find = (rep, id) => list(rep).find(m => m.id === id);
export const idOf = g => (g.id != null && String(g.id).includes(':') ? g.id : `b:${g.id}`);

export function add(rep, g, note = '') {
  const id = idOf(g);
  if (find(rep, id)) return find(rep, id);
  const m = {
    id, white: g.white, black: g.black, whiteFull: g.whiteFull || g.white, blackFull: g.blackFull || g.black,
    wElo: g.wElo || 0, bElo: g.bElo || 0, year: g.year || 0, event: g.event || '', site: g.site || '',
    result: g.result || '*', eco: g.eco || '', moves: g.moves.slice(), note, added: new Date().toISOString(),
  };
  (rep.models ||= []).push(m);
  return m;
}

export function remove(rep, id) {
  rep.models = list(rep).filter(m => m.id !== id);
}

// position key -> moves played when the game first reaches it
function keysOf(m) {
  if (!keyCache.has(m.id)) {
    const chess = new Chess();
    const map = new Map([[keyOf(chess.fen()), 0]]);
    m.moves.forEach((san, i) => {
      try { chess.move(san); } catch { return; }
      const k = keyOf(chess.fen());
      if (!map.has(k)) map.set(k, i + 1);
    });
    keyCache.set(m.id, map);
  }
  return keyCache.get(m.id);
}

// Model games passing through a position: [{ m, at }]  (at = moves played to get there)
export function reaching(rep, key) {
  return list(rep).map(m => ({ m, at: keysOf(m).get(key) })).filter(x => x.at != null);
}

/* Model games that illustrate a line (keys = positions after each move): the game follows the
   line at least as far as `from` (its branch point) and at least 3 moves deep. */
export function illustrating(rep, keys, from = 0) {
  const need = Math.max(from, 5);
  return list(rep).filter(m => {
    const ks = keysOf(m);
    for (let i = keys.length - 1; i >= need; i--) if (ks.has(keys[i])) return true;
    return false;
  });
}

/* A game from PGN text (the first game, main line only) -> model-game fields, or null. */
export function fromPgn(text) {
  const g = PGN.parse(text).find(x => x.root.children.length);
  if (!g) return null;
  const chess = new Chess();
  const moves = [];
  for (let n = g.root.children[0]; n; n = n.children[0]) {
    try { moves.push(chess.move(n.san).san); } catch { break; }
  }
  if (moves.length < 2) return null;
  const h = g.headers;
  const surname = s => (s || '?').split(',')[0].trim();
  const year = parseInt((h.Date || h.UTCDate || '').slice(0, 4), 10) || 0;
  return {
    id: `p:${fnv1a([h.White, h.Black, h.Date, moves.join(' ')].join('|')).toString(36)}`,
    white: surname(h.White), black: surname(h.Black), whiteFull: h.White || '?', blackFull: h.Black || '?',
    wElo: +h.WhiteElo || 0, bElo: +h.BlackElo || 0, year,
    event: h.Event && h.Event !== '?' ? h.Event : '', site: h.Site && h.Site !== '?' && !/^https?:/.test(h.Site) ? h.Site : '',
    result: h.Result || '*', eco: h.ECO || '', moves,
  };
}

export const label = m => `${m.white} – ${m.black}${m.year ? `, ${m.year}` : ''}`;
