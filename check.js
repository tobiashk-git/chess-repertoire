/* Engine line check: for each of your moves, is it sound and is it a surprise?

   Soundness compares Stockfish's best move with yours in the same position (two searches,
   the second restricted to your move), both scored for you. Surprise is how rarely masters
   chose your move there in the bundled games. Results are kept per device in
   rep.checks["<position key>|<san>"] — not published with the master.                   */

import { Chess } from './vendor/chess.js';
import * as E from './engine.js';
import { keyOf } from './repertoire.js';
import { gamesAt, nextMoves } from './games.js';

export const DEPTH = 16;

export const VERDICTS = {
  best:     { label: "Engine's choice", short: '✓ Best' },
  solid:    { label: 'Solid',           short: 'Solid' },
  playable: { label: 'Playable',        short: 'Playable' },
  risky:    { label: 'Risky',           short: 'Risky' },
  mistake:  { label: 'Mistake',         short: 'Mistake' },
};

// mate scores as large centipawn values (closer mates bigger), from the side to move
const toCp = s => (s.mate != null ? (s.mate > 0 ? 10000 - 10 * s.mate : -10000 - 10 * s.mate) : s.cp ?? 0);

/* loss = how much worse than the best move; after = where the position stands after yours.
   Graded mainly on the loss (as Black, normal openings already sit around −0.3/−0.5), with
   extra room while the position stays level: that is the sound-but-offbeat zone. */
export function verdict(loss, after) {
  if (loss <= 15) return 'best';
  if (loss <= 50 || (after >= -30 && loss <= 100)) return 'solid';
  if (loss <= 100) return 'playable';
  if (loss <= 200) return 'risky';
  return 'mistake';
}

/* How unusual your move is among the master games here (a sample of up to 40 per position),
   for sound moves only: 'surprise' under 5%, 'sideline' 5–15%, else null. */
export function rarity(r) {
  const m = r.masters;
  if (!m || m.total < 5 || (r.verdict !== 'best' && r.verdict !== 'solid')) return null;
  const share = m.count / m.total;
  return share < 0.05 ? 'surprise' : share <= 0.15 ? 'sideline' : null;
}
export const isSurprise = r => rarity(r) === 'surprise';

export const checkKey = (fen, san) => `${keyOf(fen)}|${san}`;

export async function checkMove(fen, san, ply) {
  const chess = new Chess(fen);
  const mv = chess.move(san);
  const uci = mv.from + mv.to + (mv.promotion || '');
  const best = await E.evaluate(fen, { depth: DEPTH });
  const mine = best.best === uci ? best : await E.evaluate(fen, { depth: DEPTH, move: uci });
  const bestCp = toCp(best), after = best.best === uci ? bestCp : toCp(mine);
  let bestSan = san;
  if (best.best && best.best !== uci) {
    try { bestSan = new Chess(fen).move({ from: best.best.slice(0, 2), to: best.best.slice(2, 4), promotion: best.best[4] }).san; } catch {}
  }
  const loss = Math.max(0, bestCp - after);

  let masters = null;
  try {
    const { games, beyond } = await gamesAt(fen, ply);
    if (!beyond) {
      const counts = nextMoves(games);
      masters = { count: counts.find(c => c.san === san)?.n || 0, total: counts.reduce((a, c) => a + c.n, 0) };
    }
  } catch {}

  return { san, bestSan, best: bestCp, after, loss, verdict: verdict(loss, after), masters, depth: DEPTH, at: new Date().toISOString() };
}

// centipawns (for the mover) as text: +0.35, −1.20, #3 / −#2
export function fmt(cp) {
  if (Math.abs(cp) >= 9000) { const n = Math.round((10000 - Math.abs(cp)) / 10); return cp > 0 ? `#${n}` : `−#${n}`; }
  return `${cp > 0 ? '+' : cp < 0 ? '−' : ''}${Math.abs(cp / 100).toFixed(2)}`;
}
