/* Bundled master games (built by tools/build_games.py from PGN Mentor collections).
   Positions are looked up by a 32-bit FNV-1a hash of the position key: the low byte picks
   one of 256 index shards, so each lookup fetches a few KB. Games live in shards of 250.
   Every game is replayed to confirm it really reaches the position (hash collisions are
   dropped) and to find where it does and what was played next.                          */

import { Chess } from './vendor/chess.js';
import { keyOf } from './repertoire.js';

const cache = new Map();
function getJSON(url) {
  if (!cache.has(url)) {
    cache.set(url, fetch(url).then(r => {
      if (!r.ok) throw new Error(`${url}: ${r.status}`);
      return r.json();
    }).catch(e => { cache.delete(url); throw e; }));
  }
  return cache.get(url);
}

export function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

export const meta = () => getJSON('data/meta.json');

const surname = n => (n || '?').split(',')[0].trim();

/* Games reaching `fen` (the ply-th position of a line), best first:
   [{ id, white, black, wElo, bElo, year, event, site, result, eco, moves, at, next }]
   at = number of moves played when the position is reached; next = the move played there. */
export async function gamesAt(fen, ply) {
  const m = await meta();
  if (ply > m.maxPly) return { games: [], beyond: true, total: m.games };
  const key = keyOf(fen);
  const h = fnv1a(key);
  const idx = await getJSON(`data/idx/${(h & 255).toString(16).padStart(2, '0')}.json`);
  const ids = idx[h.toString(36)] || [];

  const shards = [...new Set(ids.map(id => Math.floor(id / m.perShard)))];
  const loaded = await Promise.all(shards.map(s => getJSON(`data/g/${s}.json`)));
  const rows = Object.fromEntries(shards.map((s, i) => [s, loaded[i]]));

  const chess = new Chess();
  const games = [];
  for (const id of ids) {
    const r = rows[Math.floor(id / m.perShard)][id % m.perShard];
    const moves = r[9].split(' ');
    chess.reset();
    let at = ply === 0 ? 0 : -1;
    for (let i = 0; i < Math.min(moves.length, m.maxPly) && at < 0; i++) {
      chess.move(moves[i]);
      if (keyOf(chess.fen()) === key) at = i + 1;
    }
    if (at < 0) continue;   // hash collision
    games.push({
      id, white: surname(r[0]), black: surname(r[1]), wElo: r[2], bElo: r[3], year: r[4],
      event: r[5], site: r[6], result: r[7], eco: r[8], moves, at, next: moves[at] || null,
      whiteFull: r[0], blackFull: r[1],
    });
  }
  return { games, beyond: false, total: m.games };
}

// What the masters played from here, most popular first: [{ san, n }]
export function nextMoves(games) {
  const count = new Map();
  for (const g of games) if (g.next) count.set(g.next, (count.get(g.next) || 0) + 1);
  return [...count].map(([san, n]) => ({ san, n })).sort((a, b) => b.n - a.n);
}

export function pgnOf(g) {
  const tags = { Event: g.event, Site: g.site, Date: g.year ? `${g.year}.??.??` : '????.??.??', White: g.whiteFull, Black: g.blackFull, Result: g.result, ECO: g.eco };
  const head = Object.entries(tags).filter(([, v]) => v).map(([k, v]) => `[${k} "${String(v).replace(/"/g, "'")}"]`).join('\n');
  const body = g.moves.map((s, i) => (i % 2 ? '' : `${i / 2 + 1}. `) + s).join(' ');
  return `${head}\n\n${body} ${g.result}\n`;
}
