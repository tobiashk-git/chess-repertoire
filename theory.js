/* Opening theory from the Wikibooks "Chess Opening Theory" book, fetched live through the
   MediaWiki API (CORS-enabled with origin=*). Pages are named by move order, e.g.
   "Chess_Opening_Theory/1._e4/1...c5/2._Nf3". The article HTML is reduced to plain text
   blocks (headings, paragraphs, list items) — nothing from it is inserted as HTML.        */

const API = 'https://en.wikibooks.org/w/api.php';
const cache = new Map();

export function titleFor(sans) {
  const parts = sans.map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}._${san}` : `${(i + 1) / 2}...${san}`));
  return ['Chess_Opening_Theory', ...parts].join('/');
}

export const pageUrl = title => `https://en.wikibooks.org/wiki/${encodeURI(title)}`;

const STOP = /^(references|see also|external links|further reading|sources|theory table|statistics|all possible)/i;
const DROP = 'table, style, script, sup, .mw-editsection, .reference, .references, .navbox, .thumb, figure, img, .noprint, .toc, .mw-empty-elt, .hatnote, .ambox, .metadata';

/* -> { title, blocks: [{ tag: 'h'|'p'|'li', text }] } or { title, missing: true } */
export function theoryFor(sans) {
  const title = titleFor(sans);
  if (!cache.has(title)) {
    const url = `${API}?action=parse&page=${encodeURIComponent(title)}&prop=text&format=json&formatversion=2&redirects=1&origin=*`;
    cache.set(title, fetch(url).then(r => r.json()).then(j => {
      if (j.error) return { title, missing: true };
      const doc = new DOMParser().parseFromString(j.parse.text, 'text/html');
      const root = doc.querySelector('.mw-parser-output') || doc.body;
      root.querySelectorAll(DROP).forEach(n => n.remove());
      const blocks = [];
      for (const el of root.querySelectorAll('h2, h3, h4, p, li')) {
        if (el.closest('li') && el.tagName !== 'LI') continue;
        const text = el.textContent.replace(/\[edit\]/g, '').replace(/\s+/g, ' ').trim();
        if (!text) continue;
        if (/^H/.test(el.tagName)) {
          if (STOP.test(text)) break;
          blocks.push({ tag: 'h', text });
        } else blocks.push({ tag: el.tagName === 'LI' ? 'li' : 'p', text });
      }
      // drop trailing headings with nothing under them
      while (blocks.length && blocks[blocks.length - 1].tag === 'h') blocks.pop();
      return { title: j.parse.title.replace(/_/g, ' '), blocks };
    }).catch(e => { cache.delete(title); throw e; }));
  }
  return cache.get(title);
}
