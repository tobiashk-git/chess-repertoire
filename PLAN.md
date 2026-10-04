# Chess Repertoire — project plan

Phone-first PWA for building and drilling a chess opening repertoire.
Live: https://tobiashk-git.github.io/chess-repertoire/ · repo `tobiashk-git/chess-repertoire`.

Working style: phased, smallest useful scope per phase, playtest on the phone before moving on.

## Done

| Phase | What | Shipped |
|---|---|---|
| 1 | Board + repertoire builder (position graph, moves column, arrows, notes) | 2026-09-28 |
| 2 | PGN import / export with variations, comments as notes, undo | 2026-09-28 |
| — | Line table: one W/B column pair per line, branch highlights, phone mini board | 2026-09-28 |
| 3 | Spaced-repetition training (line-based sessions, Train / From here) | 2026-09-28 |
| 4 | Study panel: ~24k bundled master games by position + Wikibooks theory, game viewer | 2026-09-28 |
| — | Opening names (ECO) on the line table, "Jump to opening" selector | 2026-10-03 |
| — | Training chooser: All lines / From here × Review due, Practise (ignores schedule), Real game (master-weighted replies, first move included) | 2026-10-03 |
| — | Training end-of-line: stays on the final position (opening name + note) until Next; Note this position button | 2026-10-03 |
| — | Import from Lichess link (study / chapter / game, side from the chapter's orientation, remembered links with Re-import) + Paste from clipboard | 2026-10-03 |
| — | Undo for deleted moves / lines (toast, 8 s; restores notes + training) | 2026-10-03 |
| — | Line table → Excel (CSV) export of the shown columns; PC exports download instead of opening the share dialog | 2026-10-04 |
| — | Engine tab: Stockfish 18 lite (WASM, offline after first start) — eval bar + 3 best lines, tap to play; builder only | 2026-10-04 |
| — | Model games: ★ flag master games or pasted PGN games as a line's inspiration (+ why-note); ★ Models study tab, stars on line-table columns, listed at the end of a training line; published with the master | 2026-10-04 |
| A | Master sync: PC publishes `masters/<name>.json`, phone follows, one-tap update keeping training progress, "Send my changes"; full JSON backup incl. training | 2026-10-03 |

## Now

**Testing the current version** (user, from 2026-10-03) before starting Phase B.
Collect anything fiddly or wrong here and fix it first:

- …

**Lichess workflow (set up 2026-10-03, import shipped same day):** workflow = build in Lichess
studies on the PC → import into the app on the PC → Publish → phone trains on the go.

- **Import from link** (PC first): paste a Lichess study, chapter or game link; the app fetches
  the PGN (`https://lichess.org/api/study/{id}.pgn` — CORS-open, no token, verified for public
  studies; chapter = `/api/study/{id}/{chapterId}.pgn`, game = `/game/export/{id}`) and runs the
  normal import preview. Studies must be Public or Unlisted (Private would need a token).
  Re-importing an updated study only adds the new moves.
- **Paste from clipboard** button in the import panel (one tap; helps chess.com and the
  Lichess analysis board, whose shared links cannot be fetched).
- Chess.com shared analysis links are not importable (PGN loaded privately, no CORS) — copy PGN instead.
- Optional once the account exists: a Lichess token on the PC could add live
  masters/Lichess-database stats to the Study panel.

## Next — Phase B: family / multiple users

Goal: other family members can use the app with their own repertoires, follow or copy each
other's, with **no logins** unless self-service publishing is wanted later.

Already true: every device keeps its own repertoire, so anyone can install the app and build
their own today. Phase A already stores one master file per person (`masters/<slug>.json`,
listed in `masters/index.json`).

Scope (smallest first — each step shippable on its own):

1. **Follow list for everyone** — the Follow picker already lists all published masters;
   check it reads well with several names (last-published date beside each name).
2. **Copy from…** — seed or extend your own repertoire from someone else's master:
   pick a person, then all of it or one opening (reuse the Jump-to-opening families);
   merges like a PGN import, with the usual preview and undo. No following involved.
3. **Local profiles** (only if a device is shared, e.g. a family iPad) — a profile switcher
   in the header; each profile has its own repertoires, training progress and sync settings
   (separate storage keys). Default single profile stays invisible.
4. **More publishers** — if a family member wants a PC master of their own: give them a
   free GitHub account, add them as a collaborator on the repo, and they create their own
   fine-grained token (Contents read/write + Metadata read-only). No app changes needed.

Open questions to settle at the start of Phase B:

- Who joins first, and do they train only (follow / copy) or also build on a PC (publish)?
- Is a shared device involved (decides whether step 3 is needed)?
- Still fine for repertoires to be public in the repo? If not: private storage (gist or a
  small backend), which brings tokens or logins onto every device.

Later, only if needed: **real sign-in** (e.g. Supabase free tier with email links) so people
can publish without GitHub; the master file format carries straight over.

## Backlog (unscheduled)

- Whole master-games collection available offline (today: cached as positions are viewed)
- Daily review reminder / streak
- Engine line check: run Stockfish down a whole line and flag your moves that lose ≥0.8 against its best (one tap per line, results marked in the line table)
- Styled Excel (.xlsx) export of the line table (colours for branch moves / your moves), if CSV isn't enough
- Optional: training progress following you across devices (needs two-way sync)

## Notes for development

- Publishing commits to `main` from the app — always `git pull` before pushing code.
- Rebuild data: `pip install chess`, then `python tools/build_games.py` (master games) and
  `python tools/build_openings.py` (opening names).
- Local preview: `python devserver.py` → http://127.0.0.1:8150
