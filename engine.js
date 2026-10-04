/* Stockfish 18 (lite, single-threaded WASM build by nmrugg/stockfish.js, GPLv3 — see
   vendor/stockfish/Copying.txt) running in a Web Worker, spoken to in UCI.

   analyse(fen, onUpdate) streams { depth, lines: [{ multipv, cp | mate, pv: [uci…] }] } for
   that position until stop() or the next analyse(). Scores are from White's side.        */

const PATH = 'vendor/stockfish/stockfish-18-lite-single.js';
const DEPTH = 22;
const LINES = 3;

let worker = null, ready = null;
let searching = false, pending = null, current = null;

function start() {
  if (ready) return ready;
  ready = new Promise((resolve, reject) => {
    try { worker = new Worker(PATH); } catch (e) { reject(e); return; }
    worker.onerror = e => reject(e);
    worker.onmessage = e => {
      const line = String(e.data);
      if (line === 'uciok') { send(`setoption name MultiPV value ${LINES}`); send('isready'); }
      else if (line === 'readyok' && !worker.ready) { worker.ready = true; resolve(); }
      else onLine(line);
    };
    send('uci');
  });
  ready.catch(() => { ready = null; worker = null; });
  return ready;
}

const send = cmd => worker.postMessage(cmd);

function onLine(line) {
  if (line.startsWith('bestmove')) {
    searching = false;
    if (pending) { const p = pending; pending = null; go(p); }
    return;
  }
  if (!current || !line.startsWith('info ') || !line.includes(' pv ')) return;
  const t = line.split(' ');
  const at = k => t[t.indexOf(k) + 1];
  const depth = +at('depth');
  const multipv = +(at('multipv') || 1);
  const sign = current.white ? 1 : -1;        // UCI scores are for the side to move
  const kind = at('score'), val = +t[t.indexOf('score') + 2];
  if (t.includes('lowerbound') || t.includes('upperbound')) return;
  const entry = { multipv, pv: t.slice(t.indexOf('pv') + 1) };
  if (kind === 'mate') entry.mate = sign * val; else entry.cp = sign * val;
  if (depth > current.depth) { current.depth = depth; current.next = []; }
  current.next[multipv - 1] = entry;
  // report once every line of this depth is in (or straight away for single-move positions)
  if (current.next.filter(Boolean).length >= Math.min(LINES, current.legal)) {
    current.lines = current.next.slice();
    current.onUpdate({ depth: current.depth, lines: current.lines });
  }
}

function go(req) {
  current = req;
  searching = true;
  send(`position fen ${req.fen}`);
  send(`go depth ${DEPTH}`);
}

/* Analyse `fen` (legal = number of legal moves, so a lone reply still reports). */
export async function analyse(fen, legal, onUpdate) {
  await start();
  const req = { fen, legal: Math.max(1, legal), white: fen.split(' ')[1] === 'w', depth: 0, next: [], lines: [], onUpdate };
  if (searching) { pending = req; current = null; send('stop'); }
  else go(req);
}

export function stop() {
  pending = null;
  current = null;
  if (worker && searching) send('stop');
}

export const started = () => !!worker?.ready;
