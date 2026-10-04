# Chess Repertoire — family setup

Everyone gets their own repertoire, built on their own PC and trained on their own phone.
No logins inside the app: a free GitHub account is only needed so your PC can **publish**
your repertoire to your phone.

App: **https://tobiashk-git.github.io/chess-repertoire/**

---

## 1 · GitHub account (once, about 5 minutes)

1. Create a free account at **https://github.com/signup** and send Tobias your **username**.
2. Tobias adds you to the app's repository. You'll get an e-mail invitation — click
   **Accept invitation** (or open https://github.com/tobiashk-git/chess-repertoire/invitations).

## 2 · A publishing token (once)

On github.com: your profile picture → **Settings** → **Developer settings** →
**Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**:

- **Note:** `Chess Repertoire publish`
- **Expiration:** 1 year
- **Scopes:** tick **only `public_repo`**
- **Generate token**, then copy it (it is shown once).

> Why *classic*: GitHub's newer "fine-grained" tokens can't write to a repository you are
> only a collaborator on. The classic token with just `public_repo` is the smallest one that works.

## 3 · Your PC — where you build

1. Open the app link in **Edge** (or Chrome) and install it: the **App available** icon at
   the right of the address bar → **Install**. Always use this same browser on the PC.
2. Optional head start: **⋯ → Copy from someone's repertoire** → pick a person, White or
   Black, and **Everything** or one opening → **Preview copy** → **Import**.
   You get their moves, notes and model games, and from then on it's yours to change.
3. **⋯ → Master copy → This device: Publishes the master**
   - **Your name:** e.g. `Anna` (each person needs a different name)
   - **GitHub token:** paste it once — it stays in this browser only.
4. Build your lines (board, PGN import from chess.com / Lichess, model games…), then
   **Publish master** whenever you want your phone to have the latest.

## 4 · Your phone — where you train

1. Open the app link in **Safari** (from WhatsApp: *Open in Safari* first) → **Share** →
   **Add to Home Screen**, and open it from the new icon.
2. **⋯ → Master copy → This device: Follows a master → your name**, then tap **Update**
   in the yellow banner.
3. Train on the go. Each time you publish from the PC, the phone offers the update next
   time you open it — your training progress is kept.

---

### Good to know

- **Public:** published repertoires can be read by anyone who has the repository link.
- **Edit on the PC.** Changes made on the phone are replaced by the next update unless you
  use **Send my changes first** in the banner and import that file on the PC.
- **Backups:** now and then, **⋯ → Back up everything** on the PC (and on the phone, for
  training progress).
- **Token expired / "not accepted"** when publishing: make a new classic token (step 2)
  and paste it in again.
- **Trust:** collaborators can technically change any file in the repository, so only add
  people you trust — this is a family tool.
- The bottom of the **⋯** panel shows the app version; if a new feature seems missing,
  wait a minute and reload.
