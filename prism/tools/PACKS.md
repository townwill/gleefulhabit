# Prism level packs: plan and build guide

This guide is for the model that builds new level packs for Will's game Prism. Read all of it before running anything. The game, its generator and its tests are in this folder. Packs have been planned but none is built yet.

## What Prism is

A 3D light-beam puzzle in one HTML file. It lives in two places: on GitHub Pages at `prism/index.html` in the `townwill/gleefulhabit` repository (the main home), and as a Claude artifact titled "Prism" (https://claude.ai/artifact/1QBH7xHtNcdYmjQxSCu1D5). It has 100 campaign levels in five worlds of 20, a Daily puzzle with a streak, and an Endless mode. A pack is one more group of exactly 20 levels that shows up in the level picker after World 5.

Every level in the game is machine-generated and machine-verified. Do not hand-write levels and do not edit generated level files by hand. If a level is bad, change its recipe and regenerate it.

## Files

| File | What it is |
|---|---|
| `index.src.html` | The game source. Has placeholders that `build.js` fills in. |
| `logic.js` | Level parser and beam tracer. Shared by the game and the generator. |
| `gen2.js` | The level generator and the full solver. Holds the list of recipes (`specs`). |
| `assemble.js` | Collects generated levels into one pack file. |
| `build.js` | Verifies every level with the solver and writes `out/index.html`. |
| `smoke.js` | Runs the built game against stand-ins for the 3D and audio libraries. |
| `genpool.js` | Builds the Daily and Endless pools. Not needed for packs. |
| `gen40.json`, `gen60.json`, `gen80.json`, `gen100.json` | The campaign levels. Do not change. |
| `pool_0.json` to `pool_3.json` | The Daily and Endless pools. Do not change. |
| `vendor/three.min.js` | The 3D library (three.js r128, MIT), inlined into the GitHub Pages build. |
| `out/index.html` | The artifact build (loads the 3D library from a CDN). Not committed. |
| `../index.html` | The GitHub Pages build, written by `TARGET=pages node build.js`. Generated: never edit it by hand. |

Everything runs on plain Node. Nothing needs installing.

## Rules that must not be broken

1. **Never reorder or remove the first 100 levels.** Saved progress is stored by level position. Packs are only ever appended.
2. **A pack is exactly 20 levels with 20 names.** `build.js` refuses anything else.
3. **Append packs in order.** Once a pack is published, its position is fixed too. New packs go after it.
4. **Ship to the places that already exist.** For GitHub, run `TARGET=pages node build.js` and commit `prism/index.html` with the tools folder, following the repository's `CLAUDE.md`. For the artifact, republish `out/index.html` over the existing Prism artifact; never create a second one.
5. **Do not publish a build that fails `build.js` or `smoke.js`.**
6. **Ask Will before publishing** unless he has already told you to publish.

## How a level is written

A level is a list of text rows, one character per tile.

| Char | Piece |
|---|---|
| `.` | Empty tile |
| `>` `<` `^` `v` | Emitter, firing white light that way |
| `/` `N` | Turnable mirror (the two angles) |
| `F` `B` | Locked mirror (the two angles) |
| `S` `Z` | Turnable half-mirror (reflects and passes) |
| `D` | Dial mirror, eight angles; starting angles are in the level's `d` string |
| `P` | Prism (splits white into red, green, blue) |
| `#` | Wall |
| `1` `2` `4` | Red, green, blue filter |
| `6` `7` `8` `9` | Combiner, nozzle pointing right, down, left, up |
| `r` `g` `b` | Crystal needing one color |
| `y` `m` `c` `w` | Crystal needing a mix (yellow, magenta, cyan, white) |
| `R` `G` `U` | Twin crystal (needs two beams of red, green, blue; drawn as two gems side by side) |
| `L` | Lift (two-deck levels only) |
| `X` | The divider column between the two decks in a two-deck level |

Other fields: `tray` (pieces the player places: `/` mirror, `S` half-mirror, `P` prism), `spare` (1 if the last tray piece is not needed), `d` (dial start angles), `decks` (2 for a two-deck level), `par`.

You never write these by hand. This table is so you can read the generator's output.

## How a recipe works

Each level comes from one recipe line in the `specs` list in `gen2.js`, written as `B(size, mirrors, {options})`. The generator makes thousands of candidate boards from the recipe, solves each one, and keeps one that passes every quality rule.

| Field | Meaning |
|---|---|
| `size` | Board is size × size. With `two:1` it is the size of each deck. |
| `mirrors` | Turnable mirrors placed along the beams. |
| `T` | Number of crystals. Default 3. |
| `par` | How many mirrors start scrambled. Default is the smaller of `mirrors` and 3. Use 0 to 2 for tray levels. |
| `fixed`, `walls`, `filters` | Locked mirrors, walls, filters. |
| `half` | Turnable half-mirrors on the board. |
| `dials` | Dial mirrors. |
| `mix` | Mixed-color crystals. |
| `strong` | Double-strong crystals. Needs `half:1` or more. |
| `comb` | 1 adds a combiner. Always use it with `half:1, mix:1, m2:1`. |
| `m2` | Extra mirrors placed after the combiner. |
| `two`, `lifts` | Two decks, and how many lift pairs join them. |
| `tray` | How many mirrors are moved off the board into the tray. Having this key at all makes it a tray level. |
| `trayPrism`, `trayHalf` | Also move the prism, or the half-mirror, into the tray. |
| `spare` | Add one mirror to the tray that is not needed. |
| `slack` | How many turnable mirrors may go unused in the solution. Default 0. |
| `maxSols` | How many mirror settings may solve it. Default 1. |
| `maxPlace` | How many tray arrangements may solve it. Default 2. |

The generator already enforces these, so you do not check them yourself: all three colors are used, no beam can loop in any mirror setting, beams do not overlap and white light does not reach a half-mirror in the starting and solved layouts, every special piece is used in the solution, and the level does not start solved.

### Keeping the solver fast

Tray levels are checked by trying every arrangement, so some recipes are far slower than others. Rough cost is: ways to place the tray pieces × 2 for every turnable mirror and half-mirror × 8 for every dial. The solver manages about half a million checks per second. Keep a recipe under about 10 million.

Safe: two tray mirrors on any board; three on 7×7 or 8×8 with at most one mirror left on the board; four on 7×7 with none left on the board; two mirrors plus the prism on 7×7. Too slow: four mirrors plus the prism on 8×8; three tray pieces plus two dials on 8×8.

Every recipe in the pack plan below has already produced a level in the campaign, so they are known to work.

## Building a pack, step by step

1. **Check the starting point.** Run `node build.js`. It must list 100 levels (more if packs already exist) and end with `built`. Then run `node smoke.js`; it must end with `smoke ok`.

2. **Find the first free recipe index.** Count the `B(` entries in the `specs` list. With no packs built it is 97, so the first pack uses indexes 97 to 116.

3. **Add 20 recipes** to the end of `specs`, under a comment naming the pack. Order them easiest to hardest. Repeating the same recipe line is fine and expected: each index uses a different random seed, so the same recipe gives different boards.

4. **Generate.** Run `FROM=97 TO=117 CAP=150000 node gen2.js`. `TO` is one past the last index. Each line of output is one level, or `FAIL`. To go faster, split the range across several runs started at the same time; each run writes its own `gen_scratch_<FROM>.json`.

5. **Fix failures.** For a `FAIL`, relax that one recipe (raise `slack` or `maxSols`, drop a wall, reduce `tray` by one) and rerun only that index, for example `FROM=103 TO=104 node gen2.js`.

6. **Assemble.** Run `node assemble.js 97 pack_<name>.json`. It stops with a list if any index is missing.

7. **Register the pack.** Create or extend `packs.json`, a list with one entry per pack:

   ```json
   [{"name":"Afterglow","gate":0,"file":"pack_afterglow.json",
     "names":["...twenty names..."],
     "hints":{"1":"Optional hint for the pack's first level."}}]
   ```

   Write 20 short level names (one to three words, none already used in the game). `gate` is the number of stars needed in the previous group to open the pack; use 0 so packs are open to anyone.

8. **Build and test.** Run `TARGET=pages node build.js` (it takes about five minutes because it re-solves every level), then `node smoke.js` and `node smoke.js ../index.html`. All must pass. `build.js` re-solves every pack level, sets its par, and stamps the version.

9. **Read the result.** In the `build.js` output, check the pack's 20 lines: par should rise across the pack, and `placements` should be 1 or 2 on tray levels. Regenerate any level that breaks the curve.

10. **Ship**, with Will's go-ahead: commit and push to the repository on a branch, and republish `out/index.html` to the existing Prism artifact if he still uses it. Tell him the pack name, how many levels, and that his saved progress is kept.

After publishing, delete the `gen_scratch_*.json` files so they cannot leak into the next pack.

## The pack plan

Five packs, each with a clear identity. Each pack is four bands of five levels; use each recipe line five times.

### 1. Afterglow (easy, tap only)

For quick drop-in play. No tray, no dials, small boards. Par 3 to 5.

```js
B(6,4,{fixed:1,walls:1}),
B(6,5,{filters:1,walls:1,par:4}),
B(6,4,{half:1,T:4,par:3}),
B(7,6,{half:1,fixed:2,walls:2,T:4,par:5,slack:1,maxSols:2}),
```

### 2. Glassworks (color mixing)

Mixed crystals first, then the combiner, then the combiner with a tray and a dial.

```js
B(6,5,{half:1,mix:1,walls:1,par:4,slack:1,maxSols:2}),
B(6,3,{comb:1,half:1,mix:1,m2:1,par:3,slack:2,maxSols:3}),
B(7,3,{comb:1,half:1,mix:1,m2:1,tray:2,par:1,slack:2,maxSols:3,maxPlace:3}),
B(7,3,{comb:1,half:1,mix:1,m2:1,dials:1,tray:2,par:2,slack:2,maxSols:3,maxPlace:3}),
```

### 3. Protractor (dials and diagonals)

Two dials from the start, three by the end.

```js
B(6,2,{dials:2,walls:1,par:3}),
B(7,3,{dials:2,walls:1,par:4,slack:1,maxSols:2}),
B(7,3,{dials:2,tray:2,fixed:1,par:2,slack:1,maxSols:2}),
B(8,3,{dials:3,walls:3,fixed:2,par:5,slack:1,maxSols:2}),
```

### 4. Bare Metal (placement)

Nearly empty boards where the player places the whole route. The hardest pack to fumble through.

```js
B(6,3,{tray:3,fixed:1,walls:1,par:0}),
B(7,4,{tray:4,fixed:2,walls:2,par:0}),
B(7,3,{tray:3,trayPrism:1,spare:1,walls:2,par:0}),
B(8,4,{tray:4,fixed:2,walls:3,par:0}),
```

### 5. Skyline (two decks)

More of World 5, with two lifts on most boards.

```js
B(5,3,{two:1,lifts:1,tray:2,par:1}),
B(6,4,{two:1,lifts:2,fixed:2,walls:2,par:4,slack:1,maxSols:2}),
B(6,4,{two:1,lifts:2,tray:3,par:1,slack:1,maxSols:2}),
B(6,4,{two:1,lifts:2,dials:1,tray:2,walls:3,par:2,slack:1,maxSols:2}),
```

Suggested order to build: Afterglow, Bare Metal, Glassworks, Protractor, Skyline. Build and publish one pack at a time so Will can play each before the next.

## Things Will has asked for that affect packs

- Winning should feel earned. He found tap-only levels too easy to fumble through, so favor tray levels outside the Afterglow pack.
- Beams that loop or run back over themselves confused him. The generator blocks loops; do not turn that off with `loopsOk`.
- Boards must stay readable on a phone. Do not go above 8×8, or 6×6 per deck.

## Known limits

- The game has only been tested against stand-ins for the 3D and audio libraries, not on a real screen. After publishing, ask Will to open the pack's first and last level and say if anything looks wrong.
- `smoke.js` plays the 100 campaign levels plus Daily and Endless. It does not play pack levels; `build.js` is what verifies those.
- Music is assigned by group: each pack takes the next of the five tracks in turn.
