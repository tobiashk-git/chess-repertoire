# Chess Repertoire

A phone-first PWA for building a chess opening repertoire and drilling it.

- **Run locally:** `python devserver.py` → http://127.0.0.1:8150 (no-cache server)
- **No build step:** plain ES modules. `vendor/chess.js` is chess.js 1.4.0 (BSD-2); `pieces/` is the
  cburnett set from lichess (CC BY-SA 3.0).
- **Data:** stored in `localStorage` (`chessrep.v1`) on the device — export/backup arrives with PGN in phase 2.

## Model
A repertoire is a graph keyed by position (FEN without move clocks), so transpositions merge.
Each position stores the moves leaving it (the first of *your* moves is the main one) and a note.

## Phases
1. Board + repertoire builder ✅
2. PGN import / export
3. Spaced-repetition training
4. Model games (lichess masters explorer)
5. Offline polish + HTTPS deploy (GitHub Pages)
