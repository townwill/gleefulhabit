# GleefulHabit

Personal habit-tracking web app. Single self-contained `index.html` (~1,500
lines: HTML + CSS + JS inline, no separate files, no build step, no
framework). Deployed as a static site on **GitHub Pages** at this repo.

## Deploy

- Editing `index.html` and pushing to `main` is the entire deploy process —
  GitHub Pages picks it up automatically within a minute or two.
- No build/compile step. No `npm install`. Don't add one.
- The app is added to the owner's iPhone as a Home Screen web app (not a
  native PWA — no service worker). `index.html` includes no-cache meta tags
  so the Home Screen icon always fetches the latest deploy rather than a
  stale cached copy.
- There's an `APP_VERSION` constant near the bottom of the script that
  should be bumped on every deploy — it drives a one-time "Updated to latest
  version!" toast so the user gets visible confirmation an update landed.

## Data model

- All user data lives in **`localStorage`** under one JSON blob (`S`) — no
  backend, no server-side storage. Everything is client-only.
- Backup/restore is via manual JSON export/import (buttons in-app). Export
  tries the native Web Share API first (saves to Files/iCloud on iOS), falls
  back to a plain file download.
- **iOS caveat**: Safari can evict localStorage after ~7 days of no
  interaction, even for Home Screen apps (Apple's docs say Home Screen apps
  are exempt; real-world reports say this isn't fully reliable). The app
  nudges the user to back up if 7+ days have passed since their last export.

## Key mechanics (as of last major rework)

- **Week runs Monday–Sunday** (`thisWeekDays()`), aligned with the
  already-Monday-based ISO week-key system (`isoWeek()` / `weekKeyFor()`)
  used for de-duplicating weekly rewards.
- **Packs** (📦): Perfect Mon–Wed, Perfect Thu–Sat (each allows at most 1
  "rest day" skip across the 3-day span), and 10+ side quests in the week
  (only awarded on Sunday, not the moment the count is hit).
- **Rest days**: opt-in per habit (`habit.restEligible`), max 2/week. A rest
  day shields the streak (doesn't break it) but does **not** count as a real
  completion anywhere else — not toward Pack progress, XP, or the monthly
  Blaster percentage. This is deliberate: rest days must not be usable to
  inflate other rewards.
- **Hanger Box** 🎁: "2 Perfect Weeks in a Row" (repeatable — fires again
  every 2 more consecutive perfect weeks, tracked via
  `perfectWeekStreak`/`perfectWeekBoxesEarned`), 20 side quests/week, Level 5.
- **Blaster Box** 🏆: 80% of all possible habit completions in the current
  calendar month (habits × days elapsed), checked against each habit's real
  target — not just "logged something." Evaluated once 25+ days into the
  month. The in-app card shows live pace tracking ("On track (+X)" /
  "Behind (-X)" / "Behind (out of time)") — deliberately hidden once the box
  is mathematically guaranteed, so the user doesn't coast at month's end.
- Milestone cards show a small cadence badge (One-Time / Weekly / Monthly /
  Recurring) in the top-right corner.

## Patterns to follow when changing reward/milestone logic

- **Data integrity**: XP and stats are written into totals at completion
  time. Deleting a completed item later does not retroactively remove
  earned XP — deletion only removes the item from the list.
- **Dedup guards**: use per-threshold boolean flags (see
  `weeklyPackFlags`, `weeklyPacksAwarded`), not a single cumulative counter —
  cumulative counts can't tell you *which* threshold was actually crossed,
  which causes mislabeled or duplicate-looking awards.
- **Migration discipline**: any rename or schema change needs a load-time
  migration for both the normal load path and `importData`, since users may
  import an old-format backup at any time.
- **XP farming guards**: reset-then-redo loops are blocked via `xpAwarded`
  boolean flags with XP reversal on reset — applies to both boolean and
  numeric habits.

## Known technical debt

- Habit/side-quest names are inserted into `innerHTML` unescaped — possible
  XSS/rendering bug if a name ever contains HTML-special characters.
- `xpAwarded` map grows forever with no cleanup mechanism.

## Working style

- Explain *why* a bug happens and what a fix does before making changes,
  especially for anything touching the reward/milestone system — this
  project has had a lot of back-and-forth on reward-economy design
  decisions, so don't assume a change is purely mechanical.
- Prefer small, targeted edits over rewrites. This is a single dense file;
  precision matters more than cleverness.
