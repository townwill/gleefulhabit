# GleefulHabit — Project Context for Claude Code

## What this is
A personal habit-tracking single-file web app (`index.html`), no build step, no backend — **localStorage only**. Deployed via GitHub Pages, used as an iOS/desktop home-screen PWA by Will (solo dev/user).

Two apps live in this repo, both single-file:
- **GleefulHabit** (`index.html`) — habit tracking with XP/leveling, streaks, rewards, weight tracking, protein/food logging.
- **UNO Deck Collection** (`uno/index.html`) — a separate family card-game catalog app. Same conventions apply, but it's not covered in detail below.

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

If a harness file already exists in the repo, extend it rather than rewriting from scratch. If not, build a minimal one following the pattern above before making non-trivial changes.

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

### Protein tab (6th bottom tab, between ✦ Habits and Stats)
Dedicated tab (`section-protein` / `renderProteinTab()`) that surfaces everything related to the protein habit so it doesn't clutter Today:
- Hero block (current/target, % bar, streak, entries-logged count) — styled to match the existing Weight tab's hero for consistency.
- **Quick Add** — chips of previously-logged foods (name + grams) for one-tap re-adding with zero AI calls. Backed by `gh_food_history` in raw `localStorage` (capped at 12, deduped case-insensitively, most-recent-grams-wins). Only renders when history is non-empty.
- Manual "Add Protein" box (`padd-{habitId}` input + Add button) — the tab's equivalent of the old inline add-row.
- **AI Food Logging panel** — text description and/or photo, calls the Anthropic API directly from the browser (`fetch` to `api.anthropic.com/v1/messages`) using a user-supplied key, model `claude-haiku-4-5-20251001`, asks for a strict JSON response (`{food, grams_protein, confidence}`), fills the amount box with the estimate for the user to review before tapping Add (never auto-adds).
- Today's Food Log — full list of the day's entries (labeled or "Manual entry").
- **AI API Key card** — collapsed by default (tap-to-expand), shows a compact "Set / Not set" status in the header even while collapsed so the key field isn't exposed unless deliberately opened. Key lives in `gh_ai_key`, outside `S`, never in backups.

### Anthropic API calls from the browser (not an Artifacts sandbox)
This is a **real deployed static site**, not a Claude Artifacts preview — so API calls to `api.anthropic.com` require:
- A real key attached via the `x-api-key` header, supplied by the user and stored in their own `localStorage`.
- The `anthropic-dangerous-direct-browser-access: true` header, required for any client-side browser call.
- The user's own Anthropic Console billing — this is pay-as-you-go API usage, unrelated to any Claude.ai/Pro subscription.
- Always handle `fetch` failures (network errors, non-2xx status, malformed/non-JSON model output) gracefully with a clear inline status message — never let a failed AI call throw or silently do nothing.

## Deploy workflow
Historically: design/discuss in claude.ai chat, then deploy via Claude Code or GitHub's web editor — this file exists specifically to collapse that into one step by giving Claude Code on the Web (or Remote Control) the same context a chat conversation would have had. When finishing a change:
1. Bump `APP_VERSION`.
2. Run the DOM-stub harness; all tests must pass before presenting the file as done.
3. Summarize what changed and why in plain terms — Will reads this on mobile, so keep it concise (a few bullet points, not a wall of text).
