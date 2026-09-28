/* PGN reading and writing, including variations and comments (chess.js's own loadPgn
   drops variations, which are the whole point of a repertoire file).

   parse(text)  -> [{ headers, root }]   root = { comment, children: [Node] }
                                         Node = { san, comment, children, parent }
   importGames(rep, games, { maxPly })  merges the move trees into a repertoire
   exportRep(rep, headers)              writes the repertoire graph as one PGN game      */

import { Chess, DEFAULT_POSITION } from './vendor/chess.js';
import * as R from './repertoire.js';

const TOKEN = /\[\s*(\w+)\s+"((?:[^"\\]|\\.)*)"\s*\]|\{([^}]*)\}|;([^\n]*)|(\()|(\))|\$(\d+)|(1-0|0-1|1\/2-1\/2|\*)|(\d+)\s*\.+|([^\s(){};[\]$]+)/g;

export function parse(text) {
  const games = [];
  let game = null, cur = null, stack = [], sawMoves = false;
  const start = () => {
    game = { headers: {}, root: { comment: '', children: [] } };
    cur = game.root; stack = []; sawMoves = false;
    games.push(game);
  };
  const addComment = c => {
    c = c.replace(/\[%[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();   // drop [%clk] and friends
    if (c) cur.comment = cur.comment ? cur.comment + ' ' + c : c;
  };

  for (const t of text.matchAll(TOKEN)) {
    const [, tag, value, brace, semi, open, close, , result, , word] = t;
    if (tag !== undefined) {
      if (!game || sawMoves) start();
      game.headers[tag] = value.replace(/\\(.)/g, '$1');
      continue;
    }
    if (!game) start();
    if (brace !== undefined || semi !== undefined) addComment(brace ?? semi);
    else if (open) { if (cur.parent) { stack.push(cur); cur = cur.parent; } else stack.push(cur); }
    else if (close) { if (stack.length) cur = stack.pop(); }
    else if (result) { if (!stack.length) { game = null; } }          // result closes the game
    else if (word) {
      let san = word.replace(/[!?]+$/, '').replace(/^0-0-0/, 'O-O-O').replace(/^0-0/, 'O-O');
      if (!san || /^\d+$/.test(san) || san === '--' || san === 'Z0') continue;
      const node = { san, comment: '', children: [], parent: cur };
      cur.children.push(node);
      cur = node;
      sawMoves = true;
    }
  }
  return games.filter(g => g.root.children.length || Object.keys(g.headers).length);
}

/* Merge games into rep (mutates it). Games that start from a custom position are skipped.
   maxPly caps how deep each line goes (0 = no cap). Returns counts for the summary. */
export function importGames(rep, games, { maxPly = 0 } = {}) {
  const out = { games: 0, moves: 0, added: 0, skipped: 0, bad: 0 };
  const chess = new Chess();

  const mergeNote = (key, text) => {
    if (!text) return;
    const n = rep.pos[key] ||= { moves: [], note: '' };
    if (!n.note) n.note = text;
    else if (!n.note.includes(text)) n.note += '\n' + text;
  };

  const walk = (fen, parent, ply) => {
    if (maxPly && ply >= maxPly) return;
    for (const child of parent.children) {
      chess.load(fen);
      let m;
      try { m = chess.move(child.san); } catch { out.bad++; continue; }
      const key = R.keyOf(fen);
      out.moves++;
      if (!R.hasMove(rep, key, m.san)) { R.addMove(rep, key, m.san, m.from + m.to + (m.promotion || '')); out.added++; }
      const next = chess.fen();
      mergeNote(R.keyOf(next), child.comment);
      walk(next, child, ply + 1);
    }
  };

  for (const g of games) {
    const fen = g.headers.FEN;
    if (fen && R.keyOf(fen) !== R.START_KEY) { out.skipped++; continue; }
    out.games++;
    if (g.root.comment) mergeNote(R.START_KEY, g.root.comment);
    walk(DEFAULT_POSITION, g.root, 0);
  }
  R.prune(rep);
  return out;
}

/* Write the repertoire as a single PGN game: the first stored move at each position is the
   main line, the rest become ( variations ). A position reached a second time (transposition)
   is not expanded again — it gets a {Transposes} comment instead. */
export function exportRep(rep, headers = {}) {
  const chess = new Chess();
  const seen = new Set();
  const esc = s => s.replace(/[{}]/g, '');
  const note = key => { const t = R.node(rep, key)?.note; return t ? ` {${esc(t)}}` : ''; };
  const num = (ply, force) => ply % 2 === 0 ? `${ply / 2 + 1}. ` : force ? `${(ply + 1) / 2}... ` : '';

  // Returns [text, afterFen] for playing san from fen
  const play = (fen, san) => { chess.load(fen); chess.move(san); return chess.fen(); };

  function line(fen, ply, force) {
    const key = R.keyOf(fen);
    const moves = R.movesAt(rep, key);
    if (!moves.length) return '';
    if (seen.has(key)) return ' {Transposes}';
    seen.add(key);

    const [main, ...alts] = moves;
    const mainFen = play(fen, main.san);
    let s = ' ' + num(ply, force) + main.san + note(R.keyOf(mainFen));
    for (const alt of alts) {
      const altFen = play(fen, alt.san);
      const altNote = note(R.keyOf(altFen));
      s += ' (' + num(ply, true) + alt.san + altNote + line(altFen, ply + 1, !!altNote) + ')';
    }
    return s + line(mainFen, ply + 1, alts.length > 0 || !!note(R.keyOf(mainFen)));
  }

  const head = {
    Event: `${rep.side === 'w' ? 'White' : 'Black'} repertoire`,
    Site: 'Chess Repertoire', Date: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
    White: '?', Black: '?', Result: '*', Repertoire: rep.side, ...headers,
  };
  const tags = Object.entries(head).map(([k, v]) => `[${k} "${String(v).replace(/"/g, '\\"')}"]`).join('\n');
  const body = (note(R.START_KEY).trim() + line(DEFAULT_POSITION, 0, false)).trim();
  return `${tags}\n\n${wrap(body + ' *')}\n`;
}

function wrap(text, width = 79) {
  const out = [];
  let row = '';
  for (const w of text.split(/\s+/)) {
    if (row && row.length + 1 + w.length > width) { out.push(row); row = w; }
    else row = row ? row + ' ' + w : w;
  }
  if (row) out.push(row);
  return out.join('\n');
}
