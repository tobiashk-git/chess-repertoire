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
2. PGN import / export ✅ (menu ⋯: file or paste, depth cap, undo; export, backup, copy)
3. Spaced-repetition training ✅ (train.js: card = your-turn position, line-based sessions, SM-2-lite)
4. Model games ✅ — bundled, no login: `data/` holds ~24k classical games by 48 all-time greats
   (PGN Mentor collections, best 700 per player, online/rapid/simul events filtered), indexed by
   position for the first 15 moves and dealt across five eras per position. Rebuild with
   `pip install chess` then `python tools/build_games.py`. Theory tab = Wikibooks Chess Opening
   Theory, fetched live (CC BY-SA). The lichess masters API now needs a login token, hence bundling.
5. Offline polish + HTTPS deploy (GitHub Pages)
