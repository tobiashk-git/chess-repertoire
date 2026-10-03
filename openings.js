/* Opening names (ECO + name) by position, from data/openings.json — built by
   tools/build_openings.py from the public-domain lichess chess-openings list.
   A line's name is the deepest named position along it, so "Sicilian Defense" becomes
   "Sicilian Defense: Najdorf Variation" once the line reaches 5...a6.                  */

let table = null;
let loading = null;

export function load() {
  return loading ||= fetch('data/openings.json').then(r => r.json()).then(t => (table = t))
    .catch(e => { loading = null; throw e; });
}

export const ready = () => !!table;

// keys: position keys after each move. -> { eco, name, family, variation, ply } or null
export function nameOf(keys, upto = keys.length) {
  if (!table) return null;
  for (let i = Math.min(upto, keys.length) - 1; i >= 0; i--) {
    const hit = table[keys[i]];
    if (hit) return describe(hit, i);
  }
  return null;
}

// the first position along the line that belongs to `family` (where that opening starts)
export function familyStart(keys, family) {
  for (let i = 0; i < keys.length; i++) {
    const hit = table?.[keys[i]];
    if (hit && familyOf(hit[1]) === family) return i;
  }
  return -1;
}

// the first position along the line named `name` or a sub-line of it ("name, ...")
// -> { ply, eco } or null
export function nameStart(keys, name) {
  for (let i = 0; i < keys.length; i++) {
    const n = table?.[keys[i]]?.[1];
    if (n === name || n?.startsWith(name + ',')) return { ply: i, eco: table[keys[i]][0] };
  }
  return null;
}

const familyOf = name => name.split(':')[0].trim();

function describe([eco, name], ply) {
  const i = name.indexOf(':');
  return { eco, name, ply, family: familyOf(name), variation: i < 0 ? '' : name.slice(i + 1).trim() };
}
