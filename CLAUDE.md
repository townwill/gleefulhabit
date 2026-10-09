# GleefulHabit — Project Context for Claude Code

## What this is
A personal habit-tracking single-file web app (`index.html`), no build step, no backend — **localStorage only**. Deployed via GitHub Pages, used as an iOS/desktop home-screen PWA by Will (solo dev/user).

Several apps live in this repo, all single-file:
- **GleefulHabit** (`index.html`) — habit tracking with XP/leveling, streaks, rewards, weight tracking, protein/food logging.
- **UNO Deck Collection** (`uno/index.html`) — a separate family card-game catalog app. Same conventions apply, but it's not covered in detail below.
- **Marquee** (`movies/index.html`) — Will's iTunes movie library (~1,257 titles embedded as the `LIB` array). Pulls posters/genres/franchises/directors from the TMDB API in the browser using Will's own free TMDB key (`mq_tmdb_key`, raw localStorage, never in backups). `mq_state` holds marks (seen/favorite/watchlist), lists & moods, wish list, bought-later movies and TMDB matches (this is the backup, run through `migrateState()`); `mq_meta` and `mq_coll` are rebuildable TMDB caches. Same version-bump and update-check conventions. "Before you watch" calls the Anthropic API with the shared `gh_ai_key` (same key as GleefulHabit/Slab Happy) and caches answers per movie in `mq_prereq` (outside the backup).
- **Pixel TV** (`tv/index.html`) — a phone-sized CRT that plays original, AI-written episodic pixel-art shows. Single file, everything drawn from canvas rectangles and synthesized with WebAudio (no image/audio files); dialogue uses the phone's built-in speech voices. Channel 1 is the sitcom *Lunch Break Fire Escape* (`SHOW_ID = 'fire_escape'`; the on-screen name is the single `SHOW_NAME` constant): Nina, Theo and Maya, friends since kindergarten; Nina and Theo secretly love each other, Maya knows and plays matchmaker from her customer-support headset (`mic` beats toggle her headset LED; `service: true` is her bright customer voice; `CUSTOMER` speaks off-screen as a tinny phone mumble). Only two sets are used by this show: `apt` and `fire` (fire escape; `enter … from: 'below'` climbs the ladder, `from: 'window'` climbs through the apartment window, `'window'` as a target puts someone in the window; each set can define `floor` and a `win` spot). The pilot "Twenty-Three Years" is embedded as `PILOT`, a director's shot list. The earlier show *Rent's Due* (and its cafe/hall/stoop sets, still in `SETS`) was retired from channel 1 and lives in git history. Channels 2-4 (nature doc, sci-fi, trailers) are placeholders. "Write episode" in the TV guide runs a **writer** call then a **director** call to the Anthropic API (models in `tv_cfg`; Will uses Opus 5.5 as writer) using the shared `gh_ai_key`. Episodes live in `tv_eps` (filtered by `show`), story state (log, next episode number) in `tv_state`, watched marks in `tv_seen`. The series bible and both system prompts are the `BIBLE`, `WRITER_SYS` and `DIRECTOR_SYS` constants. New shows are added through `SHOWS`/`CHANNELS`; new sets through `SETS`; new sound effects through `SFX` (the director prompt lists `SFX_NAMES` automatically). Same version-bump and update-check conventions. Test with a real headless browser (Playwright): set `window.TV_SPEED` before load to run an episode faster than real time.

## Hard constraints — do not violate these
1. **Single-file only.** Everything — HTML, CSS, JS — stays in one self-contained `index.html`. No external dependencies except Google Fonts. No build step, no bundler, no npm packages shipped to the browser.
2. **No backend.** All persistence is `localStorage`. Two kinds of storage are used, and they're intentionally separate:
   - **`S` (app state object)** — habits, logs, XP, streaks, rewards, weight history. Serialized to `localStorage` under `STORE_KEY = 'habitflow'`. This is what gets exported/imported as a backup.
   - **Raw standalone `localStorage` keys** — for things that should *not* be in backups (e.g. `gh_ai_key` for the Anthropic API key, `gh_food_history` for the Quick Add food list). These are read/written directly, not through `S`, and require no migration.
3. **Version bump on every deploy.** `APP_VERSION` near the bottom of the script, format `YYYY-MM-DD.HHMM`. It drives a one-time "Updated to latest version!" toast on load. **Always bump this before finishing a change**, even a small one.
4. **Never use `localStorage`/`sessionStorage` inside a Claude-Artifacts-style sandboxed preview** — this doesn't apply here since this is a real deployed site, but don't accidentally introduce `window.storage` (the Artifacts persistence API) — this app uses plain `localStorage` directly.

## Migration discipline
Any new field added to `S.user` or `S.habits` (or any part of `S`) needs a default added to `migrateState()`. This function is shared between the normal load path and `importData()` (restoring a backup) — **never add a migration only to one path**. Forgetting this is the single most common way past changes have broken imports.

Fields stored in raw `localStorage` (outside `S`) do NOT need migration entries — that's the whole point of keeping them separate (see constraint #2 above).

## Testing methodology — required before presenting any change
Before considering a change done, run the actual script through a **Node.js DOM-stub harness**, not just `node --check` syntax validation:
- The harness fakes `document`, `localStorage`, `fetch`, and other browser globals, then `eval()`s the real extracted `<script>` body (not a copy — the actual current file content).
- **Critical gotcha:** `let`/`const` declared inside a *direct* `eval()` call never leak to the surrounding scope (only `var` and function declarations do). This means all test code that touches app state (`S`, `_pendingFoodLabel`, etc.) must be `eval()`'d in the *same call* as the app script itself — usually by concatenating a test-code string onto the app source before the single `eval()`.
- For date-sensitive logic (streaks, week boundaries), use a fake-clock override that only intercepts zero-arg `new Date()` and passes through explicit-arg forms, so day-by-day/week-boundary behavior can be simulated deterministically.
- This approach has caught real bugs (missing constants, flawed ISO-week formulas, scope leakage from `eval`) that syntax checking alone missed.
- Re-extract the `<script>...</script>` body fresh before each harness run — don't trust a stale extraction after edits.

A harness now exists: `tests/harness.js` (vm-based DOM stub + fake clock + fake localStorage; re-extracts the real `<script>` every run). Test code is appended to the app source and run in the same script, e.g. `run({now:'2026-10-07T12:00:00'}, "OUT.x = cardioWeekMinutes(todayKey());")`. Run a suite with `node tests/cardio.test.js`. Extend it rather than rewriting. For layout checks, load the page in headless Chromium (Playwright) at 390px wide and compare Today habit-card heights against the previous commit.

## Explain-first workflow
Will prefers understanding *why* something works or is broken before changes are made, especially for bugs — dig for root cause rather than surface-patching if something seems off. For ambiguous or open-ended feature requests, propose an approach and get confirmation before writing code; for small clear requests, just build it. Keep explanations concrete — what changed, why, and what to watch for — not exhaustive.

## Mobile-first constraints
Will primarily uses this app on an iPhone (home-screen PWA) and often works from the Claude mobile app rather than a laptop. Practical implications:
- **Card/row heights on the Today tab matter a lot** — avoid changes that add vertical space to habit cards, since that causes unwanted scrolling on the main screen. Compact affordances (small inline progress bars, short number labels) are strongly preferred over expanded inline sections for anything shown on Today.
- Prefer collapsible/hidden-by-default UI for anything sensitive or rarely needed (e.g. API key entry) rather than always-visible fields.
- iOS PWA caching: use `no-cache` (not `must-revalidate`) for reliable updates after deploy; the `APP_VERSION` footer string is the way to verify a deploy actually landed on the device.

## Current architecture highlights (as of this writing)

### Core habits
Four habits tracked by default: Workout (boolean, rest-day eligible), No Sugar (boolean, taper schedule), Spend Less (boolean), and **Protein** (numeric, target ~150g/day, unit "g"). Protein was converted from boolean to numeric to support gram tracking — this conversion preserved streak history because streak logic already treats a day's log as "done" whether it's `true` or a number ≥ target.

### Numeric habits: entries & chips
`S.logs[dateKey][habitId]` holds the running numeric total for the day. `S.logEntries[dateKey][habitId]` holds an array of individual add amounts, rendered as small chips. Entries can be either:
- a plain number (manual add, e.g. `12`), or
- an object `{amt, label}` (a food-logged add with a name attached, e.g. `{amt: 38, label: "grilled chicken breast"}`)

Rendering code must handle both shapes. `addNumCore(id, amt, label)` is the single shared function both the Today card's manual add and the Protein tab's add box call — don't duplicate this logic.

### Compact vs. full numeric habit UI
Two rendering modes exist for numeric habits on the Today tab, controlled by `isProteinHabit(h)` (checks `type==='numeric' && /protein/i.test(h.name)`):
- **Protein habit → compact mode.** No inline add-row/chips/reset on the Today card. Just a small mini progress bar + number label (`habit-mini-progress`) sitting between the habit name and the checkbox, same row height as boolean habits. Full logging happens only in the dedicated Protein tab.
- **Any other numeric habit → full mode.** Gets the traditional expanded block (total row, chips, add input, reset button, full-width bar) directly on the Today card, same as before the Protein tab existed.

If a future numeric habit should also get the compact treatment + a dedicated tab, generalize `isProteinHabit`-style detection rather than hardcoding — but don't change the behavior for existing non-protein numeric habits without being asked.

### Fuel tab (6th bottom tab, between ✦ Habits and Stats; formerly "Protein"/"Macros" — ids and `renderProteinTab()` keep the old name)
Dedicated tab (`section-protein` / `renderProteinTab()`) that surfaces everything related to the protein habit so it doesn't clutter Today:
- Hero block (current/target, % bar, streak, entries-logged count) — styled to match the existing Weight tab's hero for consistency.
- **Quick Add** — chips of previously-logged foods (name + grams) for one-tap re-adding with zero AI calls. Backed by `gh_food_history` in raw `localStorage` (capped at 12, deduped case-insensitively, most-recent-grams-wins). Only renders when history is non-empty.
- Manual "Add Protein" box (`padd-{habitId}` input + Add button) — the tab's equivalent of the old inline add-row.
- **AI Food Logging panel** — text description and/or photo, calls the Anthropic API directly from the browser (`fetch` to `api.anthropic.com/v1/messages`) using a user-supplied key, model `claude-haiku-4-5-20251001`, asks for a strict JSON response (`{food, grams_protein, confidence}`), fills the amount box with the estimate for the user to review before tapping Add (never auto-adds).
- Today's Food Log — full list of the day's entries (labeled or "Manual entry").
- **Today's Fuel card** (`fuelBarsHTML`) — five daily bars: protein, calories (limit), fiber (goal, default 30g), saturated fat (limit, default 13g), added sugar (limit, default 15g). Targets are editable in the **Daily Targets** card (`saveFuelTargets`); fiber/sat fat/sugar live in `S.user.fuelTargets` (migrated per key), calories in `S.user.calorieGoal`, protein on the habit.
- **Unknown is not zero**: food entries are `{amt,label,sugar,calories,carbs,fat,fiber,satFat}`; a macro field that was never recorded is simply absent (= unknown), while a real 0 is stored as 0. Always read totals through `macroTotalOn(hid,dk,field)` → `{sum,known,total,unknown}` and surface `unknown` rather than treating it as 0. The Haiku prompt returns `sat_fat_g`/`fiber_g`/`added_sugar_g` etc.; `null` or an omitted key stays unknown. Entries/quick-add history are written through `MACRO_KEYS`/`macroVal`.
- **Fuel-bar sugar goal vs the Less Sugar habit**: the habit still auto-completes at the `SUGAR_LIMIT_G` constant (15g) because habit completion is recomputed live and editing a goal must never rewrite past days/streaks. Only the Fuel bar and trend line use `fuelTarget('sugar')`.
- **AI API Key card** — collapsed by default (tap-to-expand), shows a compact "Set / Not set" status in the header even while collapsed so the key field isn't exposed unless deliberately opened. Key lives in `gh_ai_key`, outside `S`, never in backups.

### Weekly cardio minutes (inside the Workout habit)
`S.cardioLogs[dateKey]` is an array of `{min}`; `S.user.cardioGoalMin` defaults to 150. `cardioWeekMinutes(dk)` sums Mon-Sun via `weekDayKeysFor`, so it resets Monday. It is purely additive: logging minutes never completes the day, awards XP, or affects rest days / pause. Logging UI lives in the Circuits sub-tab's "Other Workouts Today" card (`cardioSectionHTML`); the Today Workout card only gets a compact `.habit-mini-progress.sm` bar so its height does not change.

### Anthropic API calls from the browser (not an Artifacts sandbox)
This is a **real deployed static site**, not a Claude Artifacts preview — so API calls to `api.anthropic.com` require:
- A real key attached via the `x-api-key` header, supplied by the user and stored in their own `localStorage`.
- The `anthropic-dangerous-direct-browser-access: true` header, required for any client-side browser call.
- The user's own Anthropic Console billing — this is pay-as-you-go API usage, unrelated to any Claude.ai/Pro subscription.
- Always handle `fetch` failures (network errors, non-2xx status, malformed/non-JSON model output) gracefully with a clear inline status message — never let a failed AI call throw or silently do nothing.

## Labs + cholesterol boss (Labs sub-tab under Track)
- Data: `S.labs = {panels:[{date,total,hdl,tg,ldl,ratio,nonHdl}], recheckDate, targets, awarded:{}, report:{}}`. Seeded by `seedLabs()` (hoisted function: migration runs before later consts, so no TDZ-bound refs). Dates are strictly validated on load/import (they reach inline handlers).
- Targets are editable (`LAB_TARGET_DEFAULTS`: LDL<100, TG<150, Total<200, Non-HDL<130, ratio<5.0, HDL>=40) — confirm with doctor.
- Rewards: only the newest panel, once per panel date (`awarded.panel_<date>`). Improved marker +25 XP; crit (crossing back past the 2024 value) +50 once; defeat +100 XP + pack; all six down = Hanger Box. All go through `grantReward(kind,flag,reason)` which now pays wishlist points (`LABS_USD`: defeat $10, mini $4, victory $150, times the points-per-dollar rate).
- Mini-bosses (`LAB_MINIBOSSES`): cardio = >=4 Mon-Sun weeks >=150 min ending in the month; fiber = average over logged days (>=20 logged) >= goal; sugar = Less Sugar done >=80% of days. Judged after month end, frozen in `S.labs.report`; start next full month.
- Day before `recheckDate` an in-app fasting banner (`#labsFastBanner`) shows; it must not add height to Today habit cards.
- Tests: `node tests/cardio.test.js tests/fuel.test.js tests/labs.test.js` (each file run separately).

## Rewards = wishlist points (no more boxes)
- Every old box reward now calls `awardBox(type,reason)`, which pays `boxPoints(type)` = `BOX_USD[type]` x `S.user.wishlistPointsPerDollar` (default 4): pack $4, blaster $30, super $40, mega $50, hobby $150, mythic $250. Nothing increments the legacy `*Bank` counters any more; the Pack Vault only renders if an old bank is non-zero.
- Earning: `awardHabitDayPoints()` = +2 per habit per day, once (`S.user.habitPtsPaid[date_habit]`, no clawback), only for days on/after `habitPtsSince` (set the first run) and within the last 14 days. Perfect week (both halves) = +20 once (`weeklyPackFlags[wk].bonus`). The three weekly pack drops are gone. Check-in 3/8, measurement 10, training score 20 unchanged.
- The box shop is seeded as wishlist items (`_boxShopSeeded`); buying uses the existing `redeemWishlistItem`.
- Tests: `node tests/points.test.js`.

## Deploy workflow
Historically: design/discuss in claude.ai chat, then deploy via Claude Code or GitHub's web editor — this file exists specifically to collapse that into one step by giving Claude Code on the Web (or Remote Control) the same context a chat conversation would have had. When finishing a change:
1. Bump `APP_VERSION`.
2. Run the DOM-stub harness; all tests must pass before presenting the file as done.
3. Summarize what changed and why in plain terms — Will reads this on mobile, so keep it concise (a few bullet points, not a wall of text).
