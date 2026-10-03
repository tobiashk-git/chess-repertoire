"""Builds data/openings.json: opening names by position, from the lichess chess-openings
list (public domain, https://github.com/lichess-org/chess-openings).

  { "<position key>": ["B12", "Caro-Kann Defense: Advance Variation"], ... }

Keys match the app (FEN minus the move clocks, en-passant only when a capture is legal), so
a line reached by a different move order still finds its name.

Run:  python tools/build_openings.py     (needs: pip install chess)
"""
import json, os, urllib.request
import chess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master/{}.tsv'


def key_of(board):
    return ' '.join(board.fen().split(' ')[:4])


def main():
    rows = []
    for part in 'abcde':
        with urllib.request.urlopen(URL.format(part), timeout=60) as r:
            rows += [row.split('\t') for row in r.read().decode('utf-8').splitlines()[1:]]
    rows.sort(key=lambda r: len(r[2].split()))   # shortest move order first...
    out = {}
    for eco, name, pgn in rows:
        board = chess.Board()
        for tok in pgn.split():
            if not tok[0].isdigit():
                board.push_san(tok)
        out.setdefault(key_of(board), [eco, name])   # ...so it names a shared position
    path = os.path.join(ROOT, 'data', 'openings.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(out, f, separators=(',', ':'), ensure_ascii=False)
    print(f'{len(out)} named positions, {os.path.getsize(path) / 1e3:.0f} KB')


if __name__ == '__main__':
    main()
