# Chess Repertoire — your opening trainer

A free app for your PC that helps you build the openings you want to play, and then drills
them until you know them by heart.

- **Build your lines** on a board, or bring them in from chess.com or Lichess.
- **Train:** the app plays your opponent's moves and you find yours. Lines you get wrong come
  back sooner; lines you know come back less often, so your time goes where it's needed.
- **Learn from the greats:** famous master games for every position, and the Stockfish engine
  to check your ideas.

App: **https://tobiashk-git.github.io/chess-repertoire/**

(A nicer-looking version of this guide is shared by Tobias as a web page.)

---

## Part 1 · Use it on your PC — about 5 minutes, no account needed

1. **Install the app.** Open the app link in **Edge** or **Chrome**, click the install icon at
   the right end of the address bar, then **Install**. Always use this same browser on your PC:
   your repertoire is saved in it.
2. **Get a head start (optional).** **⋯ (top right) → Copy from someone's repertoire**: pick a
   person, White or Black, and **Everything** or one opening → **Preview copy** → **Import**.
   You get their moves, notes and model games; after that it's yours to change.
3. **Build and train.**
   - **White / Black** at the top switches between your two repertoires.
   - Play moves on the board, then **Save line**. For another variation, go back to where it
     branches and play a different move.
   - **Train** → **Review due** (what needs practice today), **Practise** (every line, any
     time) or **Real game** (replies as often as masters play them).

## Part 2 · Also train on your phone — optional, about 10 minutes once

Build on the PC, then send your repertoire to your phone. This needs a free GitHub account,
which is what carries your repertoire from the PC to the phone.

4. **GitHub account.** Sign up at **https://github.com/signup** and send Tobias your
   **username**. Tobias adds you to the app; accept the e-mail invitation (or open
   https://github.com/tobiashk-git/chess-repertoire/invitations).
5. **Publishing token.** On github.com: profile picture → **Settings** → **Developer settings**
   → **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**:
   Note `Chess Repertoire publish`, Expiration 1 year, tick **only `public_repo`** →
   **Generate token** and copy it (shown once).
   It must be a *classic* token: GitHub's "fine-grained" tokens can't publish to an app you've
   been invited to.
6. **Publish from your PC.** **⋯ → Master copy → This device: Publishes the master** →
   **Your name** (e.g. `Anna`, everyone different) → paste the **GitHub token** once (it stays
   on this PC) → **Publish master**. Publish again whenever your phone should get your changes.
7. **Set up your phone.** Open the app link in **Safari** (from WhatsApp: *Open in Safari*
   first) → **Share** → **Add to Home Screen**. In the app: **⋯ → Master copy → This device:
   Follows a master → your name**, then **Update** in the yellow banner. After each publish the
   phone offers the update next time you open it; training progress is kept.

---

### Good to know

- **Back up now and then:** **⋯ → Back up everything** saves your repertoire and training progress.
- **Using the phone too?** Make changes on the PC. An update replaces phone changes unless you
  tap **Send my changes first** in the banner and import that file on the PC.
- **Token "not accepted"** when publishing: it has probably expired — make a new classic token
  (step 5) and paste it in again.
- **Published repertoires are public:** anyone with the repository link can read them.
- **New feature missing?** The bottom of the ⋯ panel shows the app version; updates take about
  a minute to arrive, so wait and reload.
- **Trust:** people added to the app's repository can technically change its files, so only
  add people you trust — this is a family tool.
