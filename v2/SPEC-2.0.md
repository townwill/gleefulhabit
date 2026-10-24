# GleefulHabit 2.0 — Rebuild Spec

Design reference: the "GleefulHabit 2.0 Directions" canvas, boards **Final · Today**, **Final · Weight**, **Final · Protein**, **D2 Log a workout**, **D3 Pause check-in**, **D4 Pause trends**, **D5 Log a wind-down**. Boards A–C and D are earlier explorations; ignore their colors and money rules.

## Why 2.0 exists
v1 got bloated (XP, levels, packs, side quests) and rewards came too easily, so check-ins turned into box-ticking. 2.0 is smaller, more honest, and built around coming back after a slip rather than protecting a streak.

## Keep from v1
- Single self-contained HTML file, no build step, GitHub Pages, localStorage only, iOS home-screen PWA tested at 390px.
- Protein tab's AI food analysis (Claude Haiku, user's own API key, key stored outside the exported state).
- Backup / import (JSON export and import), extended to cover all 2.0 data.
- `migrateState()` discipline and `APP_VERSION` footer.
- Import v1 history (habit logs, weight, protein logs) where it maps cleanly. The 1–2 month gap since he stopped stays a visible gap; the first 2.0 log counts as a comeback.

## Remove from v1
XP and levels, streak-based rewards, side quests, Hanger/Blaster boxes and packs, wishlist points, storm/survival mode, weight as a reward.

## Look
- White background, Apple-style minimalism, system font (`-apple-system`), rounded numerals for big numbers (`ui-rounded`).
- Accent: forest green `#1F5F3A`; light tint `#EEF3EF`; secondary green `#8DBE9C`; greys `#6E6E73` text, `#E8E8ED` tracks.
- Header reads **GleefulHabit 2.0**.
- **Today page never scrolls** at 390×844. 44px minimum tap targets. Dark mode optional later.

## Pages
1. **Today** (home): balance, Daily and Bonus bars, Spend / + Win / Sick day buttons, the four habits, October calendar, little wins this week, page dots.
2. **Weight** (swipe right, or tap the dots): log today's weight, 12-week weekly-average trend with gaps shown dashed, monthly averages. Never tied to money.
3. **Protein** (tap Protein on Today): ring, Snap meal / Say it / quick-add chips, today's food list showing protein and added sugar per entry.
4. Sheets: Log workout, Log wind-down, Pause check-in, Spend, + Win.
5. **History** (chart button): calendar history, pause trends, spend history.

## The four habits

### 1. Workout
- Goal: **3 workouts a week**. Each day logs **Workout** or **Rest day**.
- Rest days log but **do not pay**. Only workouts pay their daily share.
- 4th and later workouts in a week earn the bonus (see Money).
- Log sheet, all taps: **What** (Circuit, Kettlebell, Bike, Slack board, Yoga, Walk/Run), **How long** (<20m, 20–40, 40–60, 60+), **Strenuous?** (Easy, Solid, Hard).
- Row shows "N of 3 this week".

### 2. Protein
- Goal **150 g/day**. Done at 150 g; **small** at 113 g (75%).
- Always on: cannot be paused, except by a Sick day.
- Input: photo (AI), voice/description (AI), one-tap quick-add chips built from most-logged foods, manual grams.
- The analyzer also estimates **added sugar** for each entry and feeds Less sugar.
- Tag "High protein, low sugar" on qualifying entries. Swipe a row to edit or delete.

### 3. Wind down
- Counts at **10 minutes**. Log sheet, all taps: **What** (multi-select: Reading, Phone puzzle (one game, no scrolling), Meditation, Plan tomorrow, LEGO, Puzzle with wife), **How long** (10m, 20m, 30m, 45m+), **Lights out by** (9:30, 10:00, 10:30, Later).
- History should be able to show which wind-downs line up with earlier lights-out.

### 4. Less sugar
- Budget: **25 g added sugar per day** (natural sugar in fruit and plain milk doesn't count). Within budget = done.
- No protein exception: protein foods count their added sugar like anything else.
- **10 free days per year**, set in advance only (birthday, holidays). A free day turns the sugar budget off for that day, pays nothing, and doesn't break anything. Free days can't be added after the fact.
- Row shows "X g left today" and a ring.

## Money
Monthly spending money is $200, split:
- **$100 daily drip**: $100 ÷ days in the month (Oct = $3.23/day), split evenly across the 4 habits. Done = full share; small = half share. Workout pays only on workout days; rest days pay $0.
- **$50 bonus pool**, which funds:
  - **+$2** for a fully logged week (every habit logged every day, Mon–Sun).
  - **+$3** for each workout past 3 in a week.
  - **Welcome-back bonus** after a pause: offered from **day 3** of a pause at **+$3**, growing **$1/day to a $5 cap**; paid on the day the habit resumes and is logged. Pauses of 1–2 days get nothing.
  - The bonus pool can't pay out more than $50 a month.
- **$50 stays outside the app.** Show a note; don't track it.
- **Unearned money at month end** rolls to "savings" (record the amount per month; not spendable in-app).
- **Spend**: amount + category chips (Cards, LEGO, Eating out, Other). Subtracts from the unlocked balance. The big number on Today is **unlocked − spent**, labeled "to spend"; the subline shows unlocked of $150 and spent.

## Pause and sick days
- **Pause** is per habit (Workout, Wind down, Less sugar). Protein can't be paused on its own.
- Pausing opens a **4-question, tap-only check-in**: Why (Sick or hurt, Work stress, Travel, Family, Holiday or event, Just worn out), Expected length (1–2 days, About a week, Not sure), Planned? (Saw it coming, Caught me off guard), What would get you back (A smaller version, A daily nudge, The bonus, Just time).
- A paused habit is greyed out with "Paused · day N", keeps its history, and shows the welcome-back card from day 3.
- **Sick day** button: one tap pauses **Workout and Protein together**, records the reason as Sick, and skips the survey. Wind down and Less sugar keep running. The welcome-back bonus applies as normal.
- **Pause trends** (History): pause count, average length, return rate, days to come back by reason, which habits pause most, and a plain-language pattern note.

## Little wins
- **+ Win** opens a grid of prefilled one-tap wins (e.g. Walked the dog, Cooked dinner, Helped at school, Hard conversation handled, Stayed calm, Finished a project) plus an optional Other with text.
- Wins show in history and on Today ("Little wins · this week"). **They pay nothing.**

## Logging rules
- Today can be logged any time. **Yesterday can be logged until noon**, then it locks.
- Calendar cell colors: full day `#1F5F3A`, small/partial `#8DBE9C`, missed `#E8E8ED`, today outlined, future empty.

## Reminders
- An evening wind-down nudge via PWA notification (iOS home-screen app). Ask for permission only when he turns reminders on, not on first launch.

## Not in scope yet
- Evening good-day/rough-day check-in (parked).
- Dark mode.

## Suggested build order
1. New state shape + `migrateState()` from v1, and v1 history import.
2. Today page layout with static data at 390px, no scroll.
3. Habit logic and the log sheets (Workout, Wind down, Protein reuse, Less sugar).
4. Money engine: daily drip, bonus pool, spend, month rollover to savings. Unit-test this in the DOM-stub harness with edge cases (31/30/28-day months, pause spanning month end, bonus pool cap).
5. Pause, sick day, survey, welcome-back bonus, free days.
6. Weight page, History and pause trends, little wins.
7. Backup/import for all new data, reminders, version bump.
