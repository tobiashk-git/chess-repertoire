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
| A | Master sync: PC publishes `masters/<name>.json`, phone follows, one-tap update keeping training progress, "Send my changes"; full JSON backup incl. training | 2026-10-03 |

## Now

**Testing the current version** (user, from 2026-10-03) before starting Phase B.
Collect anything fiddly or wrong here and fix it first:

- …

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
- Optional: training progress following you across devices (needs two-way sync)

## Notes for development

- Publishing commits to `main` from the app — always `git pull` before pushing code.
- Rebuild data: `pip install chess`, then `python tools/build_games.py` (master games) and
  `python tools/build_openings.py` (opening names).
- Local preview: `python devserver.py` → http://127.0.0.1:8150
