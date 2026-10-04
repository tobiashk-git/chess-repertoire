/* Master copy sync through the app's own GitHub repo.

   masters/<slug>.json  { version, name, slug, published, reps: { w, b } }   moves + notes only
   masters/index.json   [{ slug, name, published }]

   The publishing device (your PC) writes through the GitHub contents API with a token that
   lives only in that browser. Following devices read the same files through the public API
   (no token, fresh immediately), falling back to the Pages copy if the API rate limit hits.

   On a following device, data.sync = { role, follow, applied, base } where `base` is the
   content of the master last applied — the yardstick for "changes made on this phone".   */

import { Chess, DEFAULT_POSITION } from './vendor/chess.js';
import * as R from './repertoire.js';
import { cardKeys } from './train.js';

export const REPO = { owner: 'tobiashk-git', repo: 'chess-repertoire', branch: 'main' };
const API = `https://api.github.com/repos/${REPO.owner}/${REPO.repo}/contents/`;

export const slugOf = name => name.trim().toLowerCase().normalize('NFKD')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/* ---------- content: the part of the repertoire a master carries ---------- */

// moves + notes only (no training progress), positions in sorted order so it compares stably
export function content(reps) {
  const out = {};
  for (const side of ['w', 'b']) {
    const pos = {};
    for (const k of Object.keys(reps[side].pos).sort()) {
      const n = reps[side].pos[k];
      pos[k] = { moves: n.moves.map(m => ({ san: m.san, uci: m.uci })), note: n.note || '' };
    }
    out[side] = { side, pos, models: reps[side].models || [] };
  }
  return out;
}

export const sameContent = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* What changed from `base` to `cur` (both content()):
   { added: [{ side, key, san }], removed: [...], notes: [{ side, key }] } */
export function diff(base, cur) {
  const d = { added: [], removed: [], notes: [] };
  for (const side of ['w', 'b']) {
    const bp = base?.[side]?.pos || {}, cp = cur[side].pos;
    for (const key of new Set([...Object.keys(bp), ...Object.keys(cp)])) {
      const bm = new Set((bp[key]?.moves || []).map(m => m.san));
      const cm = new Set((cp[key]?.moves || []).map(m => m.san));
      for (const san of cm) if (!bm.has(san)) d.added.push({ side, key, san });
      for (const san of bm) if (!cm.has(san)) d.removed.push({ side, key, san });
      if ((bp[key]?.note || '') !== (cp[key]?.note || '') && cp[key]?.note) d.notes.push({ side, key });
    }
  }
  return d;
}

export const changeCount = d => d.added.length + d.removed.length + d.notes.length;

/* Replace this device's moves + notes with the master's, keeping training progress for every
   position that is still one of your decision points. Returns the new reps. */
export function applyMaster(reps, master) {
  const out = {};
  for (const side of ['w', 'b']) {
    const rep = JSON.parse(JSON.stringify(master.reps[side]));
    R.prune(rep);                        // drop positions the master no longer reaches
    const keep = new Set(cardKeys(rep));
    const train = {};
    for (const [k, v] of Object.entries(reps[side].train || {})) if (keep.has(k)) train[k] = v;
    rep.train = train;
    out[side] = rep;
  }
  return out;
}

/* A cut-down repertoire holding only what this device added (new moves and edited notes),
   plus the moves leading to them, so it exports as a connected PGN the master can merge. */
export function changesReps(reps, d) {
  const out = { w: { side: 'w', pos: {} }, b: { side: 'b', pos: {} } };
  const chess = new Chess();
  for (const side of ['w', 'b']) {
    const rep = reps[side];
    const targets = [
      ...d.added.filter(c => c.side === side).map(c => ({ key: c.key, san: c.san })),
      ...d.notes.filter(c => c.side === side).map(c => ({ key: c.key, note: true })),
    ];
    if (!targets.length) continue;

    // breadth-first from the start: the move path to every position in the repertoire
    const paths = new Map([[R.START_KEY, { fen: DEFAULT_POSITION, path: [] }]]);
    const queue = [R.START_KEY];
    while (queue.length) {
      const key = queue.shift();
      const { fen, path } = paths.get(key);
      for (const m of R.movesAt(rep, key)) {
        chess.load(fen);
        try { chess.move(m.san); } catch { continue; }
        const next = R.keyOf(chess.fen());
        if (!paths.has(next)) { paths.set(next, { fen: chess.fen(), path: [...path, { key, san: m.san, uci: m.uci }] }); queue.push(next); }
      }
    }
    const add = (key, san, uci) => R.addMove(out[side], key, san, uci);
    for (const t of targets) {
      const p = paths.get(t.key);
      if (!p) continue;
      for (const step of p.path) add(step.key, step.san, step.uci);
      if (t.note) {
        (out[side].pos[t.key] ||= { moves: [], note: '' }).note = rep.pos[t.key].note;
      } else {
        add(t.key, t.san, R.movesAt(rep, t.key).find(m => m.san === t.san)?.uci);
      }
    }
  }
  return out;
}

/* ---------- GitHub ---------- */

const b64ToText = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0)));
function textToB64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function getFile(path, token) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${API}${path}?ref=${REPO.branch}&t=${Date.now()}`, { headers, cache: 'no-store' });
  if (r.status === 404) return null;
  if (!r.ok) throw Object.assign(new Error(`GitHub ${r.status}`), { status: r.status });
  const j = await r.json();
  // files over 1 MB come back without inline content
  const text = j.content ? b64ToText(j.content) : await (await fetch(j.download_url, { cache: 'no-store' })).text();
  return { sha: j.sha, text };
}

async function putFile(path, text, sha, token, message) {
  const r = await fetch(API + path, {
    method: 'PUT',
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: textToB64(text), branch: REPO.branch, ...(sha ? { sha } : {}) }),
  });
  if (!r.ok) {
    const why = r.status === 401 ? 'the token was not accepted'
      : r.status === 403 || r.status === 404 ? 'the token cannot write to the repository'
      : r.status === 409 || r.status === 422 ? 'the file changed underneath — try again'
      : `GitHub said ${r.status}`;
    throw Object.assign(new Error(why), { status: r.status });
  }
}

// Public read: API first (fresh), then the Pages copy (cached up to ~10 min) if the API refuses.
async function readPublic(path) {
  try { return (await getFile(path))?.text ?? null; }
  catch {
    const r = await fetch(`${path}?t=${Date.now()}`, { cache: 'no-store' });
    return r.ok ? r.text() : null;
  }
}

export async function fetchIndex() {
  const t = await readPublic('masters/index.json');
  return t ? JSON.parse(t) : [];
}

export async function fetchMaster(slug) {
  const t = await readPublic(`masters/${slug}.json`);
  return t ? JSON.parse(t) : null;
}

// Write this device's moves + notes as `name`'s master, and list it in the index.
export async function publish(reps, name, token) {
  const slug = slugOf(name);
  if (!slug) throw new Error('enter your name first');
  const published = new Date().toISOString();
  const master = { version: 1, name: name.trim(), slug, published, reps: content(reps) };
  const path = `masters/${slug}.json`;
  const existing = await getFile(path, token);
  await putFile(path, JSON.stringify(master), existing?.sha, token, `Publish ${master.name}'s repertoire master`);

  for (let attempt = 0; attempt < 2; attempt++) {
    const idx = await getFile('masters/index.json', token);
    const list = idx ? JSON.parse(idx.text) : [];
    const entry = { slug, name: master.name, published };
    const i = list.findIndex(e => e.slug === slug);
    if (i >= 0) list[i] = entry; else list.push(entry);
    list.sort((a, b) => a.name.localeCompare(b.name));
    try {
      await putFile('masters/index.json', JSON.stringify(list, null, 1), idx?.sha, token, `List ${master.name}'s master`);
      break;
    } catch (e) { if (attempt || (e.status !== 409 && e.status !== 422)) throw e; }
  }
  return { published, content: master.reps };
}
