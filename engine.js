/* Stockfish 18 (lite, single-threaded WASM build by nmrugg/stockfish.js, GPLv3 — see
   vendor/stockfish/Copying.txt) running in a Web Worker, spoken to in UCI.

   Two kinds of job share the one engine:
     analyse(fen, legal, onUpdate)  streaming analysis for the Engine tab: { depth, lines } with
                                    up to 3 lines, scores from White's side; runs until stop()
     evaluate(fen, { depth, move }) one search, resolved with { cp | mate, best, depth } from the
                                    side to move; `move` (UCI) restricts the search to that move
   Evaluations queue behind each other and pre-empt a streaming analysis; a streaming request
   made during an evaluation waits its turn.                                              */

const PATH = 'vendor/stockfish/stockfish-18-lite-single.js';
const STREAM_DEPTH = 22;
const LINES = 3;

let worker = null, ready = null;
let job = null;          // the search running now
let waiting = null;      // the job to start when it ends
let evalChain = Promise.resolve();

function start() {
  if (ready) return ready;
  ready = new Promise((resolve, reject) => {
    try { worker = new Worker(PATH); } catch (e) { reject(e); return; }
    worker.onerror = e => reject(e);
    worker.onmessage = e => {
      const line = String(e.data);
      if (line === 'uciok') send('isready');
      else if (line === 'readyok' && !worker.ready) { worker.ready = true; resolve(); }
      else onLine(line);
    };
    send('uci');
  });
  ready.catch(() => { ready = null; worker = null; });
  return ready;
}

const send = cmd => worker.postMessage(cmd);

function parseInfo(line) {
  const t = line.split(' ');
  const i = t.indexOf('score');
  if (i < 0 || !t.includes('pv') || t.includes('lowerbound') || t.includes('upperbound')) return null;
  const at = k => t[t.indexOf(k) + 1];
  const out = { depth: +at('depth'), multipv: +(at('multipv') || 1), pv: t.slice(t.indexOf('pv') + 1) };
  if (t[i + 1] === 'mate') out.mate = +t[i + 2]; else out.cp = +t[i + 2];
  return out;
}

function onLine(line) {
  if (line.startsWith('bestmove')) {
    const done = job;
    job = null;
    if (done?.kind === 'eval') done.resolve({ ...done.last, best: line.split(' ')[1] });
    if (waiting) { const next = waiting; waiting = null; begin(next); }
    return;
  }
  if (!job || !line.startsWith('info ')) return;
  const info = parseInfo(line);
  if (!info) return;
  if (job.kind === 'eval') {
    if (info.multipv === 1) job.last = { depth: info.depth, cp: info.cp, mate: info.mate };
    return;
  }
  // streaming: scores to White's side; report once every line of a depth is in
  const sign = job.white ? 1 : -1;
  const entry = { multipv: info.multipv, pv: info.pv };
  if (info.mate != null) entry.mate = sign * info.mate; else entry.cp = sign * info.cp;
  if (info.depth > job.depth) { job.depth = info.depth; job.next = []; }
  job.next[info.multipv - 1] = entry;
  if (job.next.filter(Boolean).length >= Math.min(LINES, job.legal)) {
    job.onUpdate({ depth: job.depth, lines: job.next.slice() });
  }
}

function begin(j) {
  job = j;
  send(`setoption name MultiPV value ${j.kind === 'eval' ? 1 : LINES}`);
  send(`position fen ${j.fen}`);
  send(j.kind === 'eval'
    ? `go depth ${j.depth}${j.move ? ` searchmoves ${j.move}` : ''}`
    : `go depth ${STREAM_DEPTH}`);
}

/* Streaming analysis of `fen` (legal = number of legal moves, so a lone reply still reports). */
export async function analyse(fen, legal, onUpdate) {
  await start();
  const j = { kind: 'stream', fen, legal: Math.max(1, legal), white: fen.split(' ')[1] === 'w', depth: 0, next: [], onUpdate };
  if (!job) begin(j);
  else if (job.kind === 'eval') { if (!waiting || waiting.kind === 'stream') waiting = j; }
  else { waiting = j; send('stop'); }
}

/* One evaluation; queued behind other evaluations. */
export function evaluate(fen, { depth = 16, move = null } = {}) {
  const run = () => start().then(() => new Promise(resolve => {
    const j = { kind: 'eval', fen, depth, move, resolve, last: null };
    if (!job) begin(j);
    else { waiting = j; if (job.kind === 'stream') send('stop'); }
  }));
  const p = evalChain.then(run, run);
  evalChain = p.catch(() => {});
  return p;
}

// Stop the streaming analysis (evaluations already queued still finish).
export function stop() {
  if (waiting?.kind === 'stream') waiting = null;
  if (worker && job?.kind === 'stream') send('stop');
}

export const started = () => !!worker?.ready;
