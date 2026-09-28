/* Chessboard view: 64 squares in a CSS grid, pieces as cburnett SVGs, tap-to-move and
   drag-to-move, legal-move dots, last-move/check highlights, arrows in an SVG overlay and
   a promotion picker. It knows nothing about repertoires — it asks a chess.js instance
   what is legal and reports moves through onMove({ from, to, promotion }). */

const FILES = 'abcdefgh';

export class Board {
  constructor(el, { onMove } = {}) {
    this.el = el;
    this.onMove = onMove;
    this.orientation = 'w';
    this.chess = null;
    this.selected = null;
    this.lastMove = null;
    this.arrows = [];
    this.interactive = true;
    this.drag = null;

    el.classList.add('board');
    el.innerHTML = '';
    this.grid = document.createElement('div');
    this.grid.className = 'grid';
    el.appendChild(this.grid);
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'arrows');
    this.svg.setAttribute('viewBox', '0 0 8 8');
    el.appendChild(this.svg);

    this.squares = {};
    for (let i = 0; i < 64; i++) {
      const sq = document.createElement('div');
      sq.className = 'sq';
      this.grid.appendChild(sq);
    }

    el.addEventListener('pointerdown', e => this._down(e));
    window.addEventListener('pointermove', e => this._moveDrag(e));
    window.addEventListener('pointerup', e => this._up(e));
    window.addEventListener('pointercancel', () => this._cancelDrag());
  }

  setOrientation(color) { this.orientation = color; this.render(); }

  set(chess, { lastMove = null, arrows = [] } = {}) {
    this.chess = chess;
    this.lastMove = lastMove;
    this.arrows = arrows;
    this.selected = null;
    this.render();
  }

  // square name for grid index, honouring orientation
  _nameAt(i) {
    const r = Math.floor(i / 8), c = i % 8;
    return this.orientation === 'w'
      ? FILES[c] + (8 - r)
      : FILES[7 - c] + (r + 1);
  }

  _xy(name) {
    const c = FILES.indexOf(name[0]), r = +name[1];
    return this.orientation === 'w' ? [c + 0.5, 8 - r + 0.5] : [7 - c + 0.5, r - 1 + 0.5];
  }

  render() {
    if (!this.chess) return;
    const targets = new Set(this.selected
      ? this.chess.moves({ square: this.selected, verbose: true }).map(m => m.to) : []);
    const checkSq = this.chess.inCheck() ? this._kingSquare(this.chess.turn()) : null;

    [...this.grid.children].forEach((sq, i) => {
      const name = this._nameAt(i);
      const piece = this.chess.get(name);
      const light = (FILES.indexOf(name[0]) + +name[1]) % 2 === 0;   // a1 dark, h1 light
      sq.className = 'sq ' + (light ? 'light' : 'dark');
      sq.dataset.sq = name;
      if (this.lastMove && (name === this.lastMove.from || name === this.lastMove.to)) sq.classList.add('last');
      if (name === this.selected) sq.classList.add('sel');
      if (name === checkSq) sq.classList.add('check');
      if (targets.has(name)) sq.classList.add(piece ? 'capture' : 'target');

      const r = Math.floor(i / 8), c = i % 8;
      let coords = '';
      if (c === 0) coords += `<span class="rank">${name[1]}</span>`;
      if (r === 7) coords += `<span class="file">${name[0]}</span>`;
      const img = piece ? `<img class="pc" draggable="false" src="pieces/${piece.color}${piece.type.toUpperCase()}.svg" alt="">` : '';
      const html = coords + img;
      if (sq._html !== html) { sq.innerHTML = html; sq._html = html; }   // untouched squares keep their img (no flicker)
    });
    this._drawArrows();
  }

  _kingSquare(color) {
    for (const row of this.chess.board()) for (const p of row)
      if (p && p.type === 'k' && p.color === color) return p.square;
    return null;
  }

  _drawArrows() {
    const NS = 'http://www.w3.org/2000/svg';
    this.svg.innerHTML = '';
    const defs = document.createElementNS(NS, 'defs');
    const colors = [...new Set(this.arrows.map(a => a.color))];
    colors.forEach((col, k) => {
      const m = document.createElementNS(NS, 'marker');
      m.setAttribute('id', 'ah' + k);
      m.setAttribute('viewBox', '0 0 10 10');
      m.setAttribute('refX', '5'); m.setAttribute('refY', '5');
      m.setAttribute('markerWidth', '3.2'); m.setAttribute('markerHeight', '3.2');
      m.setAttribute('orient', 'auto');
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', 'M0,0 L10,5 L0,10 z');
      p.setAttribute('fill', col);
      m.appendChild(p); defs.appendChild(m);
    });
    this.svg.appendChild(defs);
    for (const a of this.arrows) {
      const [x1, y1] = this._xy(a.from), [x2, y2] = this._xy(a.to);
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
      const ex = x2 - dx / len * 0.42, ey = y2 - dy / len * 0.42;   // stop short so the head sits on the square
      const line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', x1); line.setAttribute('y1', y1);
      line.setAttribute('x2', ex); line.setAttribute('y2', ey);
      line.setAttribute('stroke', a.color);
      line.setAttribute('stroke-width', a.width || 0.16);
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('opacity', a.opacity ?? 0.85);
      line.setAttribute('marker-end', `url(#ah${colors.indexOf(a.color)})`);
      this.svg.appendChild(line);
    }
  }

  _squareFromPoint(x, y) {
    const r = this.grid.getBoundingClientRect();
    if (x < r.left || y < r.top || x >= r.right || y >= r.bottom) return null;
    const c = Math.floor((x - r.left) / r.width * 8), row = Math.floor((y - r.top) / r.height * 8);
    return this._nameAt(row * 8 + c);
  }

  _ownPiece(name) {
    const p = this.chess.get(name);
    return p && p.color === this.chess.turn();
  }

  _down(e) {
    if (!this.interactive || !this.chess || this.picker) return;
    const name = this._squareFromPoint(e.clientX, e.clientY);
    if (!name) return;
    e.preventDefault();

    // second tap on a target completes a tap-move
    if (this.selected && name !== this.selected && !this._ownPiece(name)) {
      this._tryMove(this.selected, name);
      return;
    }
    if (!this._ownPiece(name)) { this.selected = null; this.render(); return; }

    const wasSelected = this.selected === name;
    this.selected = name;
    this.render();
    const sqEl = this.grid.querySelector(`[data-sq="${name}"]`);
    const img = sqEl.querySelector('img');
    const rect = sqEl.getBoundingClientRect();
    const ghost = img.cloneNode();
    ghost.className = 'ghost';
    ghost.style.width = ghost.style.height = rect.width + 'px';
    this.drag = { from: name, ghost, size: rect.width, started: false, x0: e.clientX, y0: e.clientY, wasSelected, img };
  }

  _moveDrag(e) {
    const d = this.drag;
    if (!d) return;
    if (!d.started) {
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 6) return;
      d.started = true;
      document.body.appendChild(d.ghost);
      d.img.style.opacity = '0.25';
    }
    d.ghost.style.left = (e.clientX - d.size / 2) + 'px';
    d.ghost.style.top = (e.clientY - d.size / 2) + 'px';
  }

  _up(e) {
    const d = this.drag;
    if (!d) return;
    this._cancelDrag();
    if (!d.started) {
      // a plain tap on an already-selected piece deselects it
      if (d.wasSelected) { this.selected = null; this.render(); }
      return;
    }
    const to = this._squareFromPoint(e.clientX, e.clientY);
    if (to && to !== d.from) this._tryMove(d.from, to);
    else this.render();
  }

  _cancelDrag() {
    if (!this.drag) return;
    this.drag.ghost.remove();
    this.drag.img.style.opacity = '';
    this.drag = null;
  }

  _tryMove(from, to) {
    const legal = this.chess.moves({ square: from, verbose: true }).filter(m => m.to === to);
    this.selected = null;
    if (!legal.length) { this.render(); return; }
    if (legal.some(m => m.promotion)) { this._pickPromotion(from, to); return; }
    this.onMove?.({ from, to });
  }

  _pickPromotion(from, to) {
    const color = this.chess.turn();
    const picker = document.createElement('div');
    picker.className = 'promo';
    for (const t of ['q', 'r', 'b', 'n']) {
      const b = document.createElement('button');
      b.innerHTML = `<img src="pieces/${color}${t.toUpperCase()}.svg" alt="${t}">`;
      b.onclick = ev => { ev.stopPropagation(); close(); this.onMove?.({ from, to, promotion: t }); };
      picker.appendChild(b);
    }
    const close = () => { picker.remove(); this.picker = null; this.render(); };
    picker.addEventListener('pointerdown', ev => { if (ev.target === picker) close(); });
    this.el.appendChild(picker);
    this.picker = picker;
  }
}
