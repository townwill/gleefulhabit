// Pixel TV — art for "Lunch Break Fire Escape", written for pxl (github.com/crsolver/claude-pxl).
// Build + embed into ../index.html:   node tv/art/embed.mjs <path to claude-pxl>
// Layout coordinates match the engine: apt floor y=198, fire escape floor y=182, 320x240 canvas.
// Characters: 28x50 before outline (30x52 after). Faces, props and Maya's mic light are drawn by the
// engine on top, so the sprites have no eyes or mouth.

pal({
  k: "#1d1424", D: "#3a2a3a", d: "#55404e",                                   // ink, deep shadow
  y: "#5d7fb8", Y: "#8fb7e6", z: "#c9e2f6",                                   // sky
  i: "#5f6b85", I: "#7d8aa6", j: "#a9b6cc",                                   // skyline
  B: "#6e2f26", b: "#9a4836", n: "#b8603f", N: "#d27a52", m: "#c9b9a0",       // brick, mortar
  f: "#efe6d4", F: "#cfc2a8",                                                 // window trim
  x: "#2b2b33", X: "#454552", Z: "#64646f",                                   // iron
  T: "#6a4026", t: "#a8673a", 3: "#8a5532",                                   // wood
  c: "#3d6fb0", C: "#2b4f86", u: "#e0a628", U: "#a87a18",                     // crates
  W: "#d9b98a", w: "#ecd3a6", L: "#ffd36e", 4: "#b8925e",                     // wallpaper, lamp
  r: "#b3433a", R: "#7e2a28",                                                 // curtains
  g: "#4f9a46", G: "#2f6a34", h: "#a0522d",                                   // plants
  e: "#e9e9e4", E: "#b9bcc4", 5: "#8d9098",                                   // fridge / laptop
  M: "#3e6b5a", O: "#4d8068", o: "#62997c",                                   // couch
  p: "#8a5a34", P: "#6e4527", q: "#a06a3e",                                   // floor
  // characters
  a: "#eab48c", A: "#c98d6a", l: "#5a3420", H: "#7d4c30",                     // Nina skin, hair
  s: "#8fd0c0", S: "#5fa596", v: "#3a4a6a", V: "#283550", K: "#1a1a1e", Q: "#f2f2f0", // Nina top, pants, ink, white
  6: "#c98d62", 7: "#a06c48", 8: "#2b1d12", 9: "#4a3424",                     // Theo skin, hair
  J: "#34528a", 0: "#22375e", 1: "#1d2433", 2: "#e8c040",                     // Theo shirt, pants, badge
  "!": "#8a5434", "@": "#6a3c24", "$": "#140c08", "%": "#3a2a20",             // Maya skin, hair
  "&": "#c75b3c", "*": "#93402c", "-": "#2e2a38", "=": "#1f1c28",             // Maya sweater, pants
})
ramps("kdBbnN", "kDd", "kRr", "kxXZ", "kCc", "kUu", "kiIj", "kTt", "kPpq", "k4Ww", "kMOo", "kGg", "k5Ee")

// ------------------------------------------------------------------ parts
sprite("_brick", `
  bbbbbbbm
  bbbnbbbm
  bbbbbbbm
  mmmmmmmm
  bbbmbbbb
  bnbmbbbb
  bbbmbbbb
  mmmmmmmm`)
sprite("_plank", `
  pppppppppppppppppppppppP
  pppppppqpppppppppppppppP
  pppppppppppppppppppppppP
  pppppppppppppppppppppppP
  pppppppppppppppppppppppP
  pppppppppppppppqpppppppP
  pppppppppppppppppppppppP
  pppppppppppppppppppppppP
  pppppppppppppppppppppppP
  pppppppppppppppppppppppP
  pppqpppppppppppppppppppP
  PPPPPPPPPPPPPPPPPPPPPPPP`)
sprite("_paper", `
  WWWWWWww
  WWWWWWww
  WWWWWWww
  WWWWWWww`)

// ------------------------------------------------------------------ FIRE ESCAPE
scene("fire", { w: 320, h: 240 },
  layer("sky", grad(0, 0, 320, 70, "yYz", "v", 0.6),
    rect(20, 12, 18, 3, "z"), rect(24, 9, 10, 3, "z"), rect(286, 18, 20, 3, "z"), rect(290, 15, 10, 3, "z")),
  layer("city", (c) => {
    const towers = [[0, 40, 30], [28, 24, 26], [54, 46, 22], [76, 30, 30], [106, 52, 20], [126, 36, 28], [154, 20, 24], [178, 44, 30], [208, 28, 22], [230, 50, 26], [256, 34, 30], [286, 42, 34]]
    towers.forEach(([x, y, w], i) => {
      c.rect(x, y, w, 70 - y, i % 2 ? "i" : "I"); c.vline(x + w - 1, y, 70 - y, "i")
      for (let wy = y + 4; wy < 62; wy += 6) for (let wx = x + 3; wx < x + w - 3; wx += 5) if ((wx * 7 + wy * 13 + i) % 3 === 0) c.rect(wx, wy, 2, 3, "j")
    })
    c.rect(250, 6, 22, 18, "t"); c.rect(250, 6, 22, 2, "T"); c.vline(271, 6, 18, "T"); c.poly([248, 6, 261, 0, 274, 6], "T")
    c.line(252, 24, 250, 40, "T"); c.line(269, 24, 271, 40, "T"); c.line(252, 30, 269, 30, "T")
  }),
  layer("wall", pattern("_brick", 0, 58, 320, 128), rect(0, 58, 320, 5, "m"), hline(0, 63, 320, "F"),
    (c) => { for (const x of [24, 96, 168, 240]) c.vline(x, 152, 28, "R") }),                       // rust under brackets
  layer("window",
    rect(55, 75, 80, 84, "f"), box(55, 75, 80, 84, "F"),
    rect(62, 82, 66, 76, "W"), (c) => { for (let x = 62; x < 128; x += 10) c.rect(x, 82, 4, 76, "w") },
    rect(66, 122, 18, 14, "T"), rect(68, 124, 14, 10, "r"),
    rect(110, 98, 4, 26, "T"), poly([104, 98, 120, 98, 116, 90, 108, 90], "L"),
    dither(62, 82, 66, 28, "z", "W", 0.5), rect(62, 110, 66, 4, "f"), hline(62, 113, 66, "F"),
    rect(58, 79, 7, 80, "r"), vline(63, 79, 80, "R"), rect(125, 79, 7, 80, "r"), vline(125, 79, 80, "R"),
    rect(51, 158, 88, 5, "m"), hline(51, 162, 88, "F")),
  layer("stain", { shade: true, density: 0.5 }, rect(56, 163, 78, 14, "k")),
  layer("windows2", (c) => {
    for (const x of [176, 222]) { c.rect(x - 3, 69, 40, 52, "f"); c.rect(x, 72, 34, 46, "D"); c.rect(x + 2, 74, 30, 18, "d"); c.rect(x + 16, 72, 2, 46, "f"); c.rect(x, 94, 34, 2, "f"); c.rect(x - 5, 121, 44, 4, "m") }
  }),
  layer("props",
    rect(13, 166, 18, 14, "h"), rect(11, 164, 22, 3, "t"), line(18, 164, 16, 150, "G", 2), line(22, 164, 24, 146, "g", 2), line(26, 164, 30, 152, "G", 2),
    circ(16, 150, 3, "g"), circ(25, 146, 3, "g"), circ(31, 152, 3, "G"),
    rect(148, 167, 25, 15, "c"), box(148, 167, 25, 15, "C"), rect(151, 170, 5, 4, "C"), rect(158, 170, 5, 4, "C"), rect(165, 170, 5, 4, "C"),
    rect(184, 167, 25, 15, "u"), box(184, 167, 25, 15, "U"), rect(187, 170, 5, 4, "U"), rect(194, 170, 5, 4, "U"), rect(201, 170, 5, 4, "U")),
  layer("iron",
    rect(0, 180, 320, 6, "x"), (c) => { for (let x = 0; x < 320; x += 4) c.vline(x, 181, 4, "X") }, hline(0, 180, 320, "Z"),
    rect(0, 186, 320, 54, "D"), grad(0, 186, 320, 54, "dD", "v", 0.5),
    (c) => { for (let x = 6; x < 320; x += 46) { c.rect(x, 200, 18, 12, "k"); c.rect(x + 2, 202, 14, 8, "d") } },
    rect(256, 134, 2, 106, "x"), rect(276, 134, 2, 106, "x"), (c) => { for (let y = 140; y < 240; y += 9) c.rect(256, y, 22, 2, "X") }),
  layer("shadow", { shade: true, density: 0.5 }, rect(0, 186, 320, 10, "k")),
)
scene("fire_front", { w: 320, h: 240 },
  rect(0, 152, 252, 2, "x"), rect(282, 152, 38, 2, "x"), hline(0, 152, 252, "Z"), hline(282, 152, 38, "Z"),
  rect(0, 166, 252, 1, "x"), rect(282, 166, 38, 1, "x"),
  (c) => { for (let x = 0; x < 252; x += 24) c.rect(x, 152, 2, 30, "x"); c.rect(250, 134, 2, 48, "x"); c.rect(282, 134, 2, 48, "x"); c.rect(318, 152, 2, 30, "x") })

// ------------------------------------------------------------------ APARTMENT
scene("apt", { w: 320, h: 240 },
  layer("wall", rect(0, 0, 320, 176, "W"), (c) => { for (let x = 0; x < 320; x += 16) c.rect(x, 8, 6, 160, "w") },
    rect(0, 0, 320, 8, "4"), hline(0, 8, 320, "3"), rect(0, 166, 320, 10, "3"), hline(0, 166, 320, "t")),
  layer("floor", pattern("_plank", 0, 176, 320, 64), (c) => { for (let r = 0; r < 6; r++) c.vline((r % 2) * 13 + 7 + r * 5, 176 + r * 12, 11, "P") }),
  layer("door",
    rect(3, 37, 38, 139, "T"), rect(7, 41, 30, 135, "3"), box(11, 47, 22, 38, "T"), box(11, 93, 22, 72, "T"),
    rect(31, 111, 3, 3, "L"), rect(20, 64, 4, 2, "x"), rect(13, 23, 18, 11, "u"), box(13, 23, 18, 11, "U"), text(17, 26, "4C", "T")),
  layer("window",
    rect(53, 43, 62, 72, "f"), box(53, 43, 62, 72, "F"), grad(56, 46, 56, 66, "yYz", "v", 0.6),
    pattern("_brick", 56, 92, 56, 20),                                                               // building across the way
    rect(56, 96, 56, 2, "x"), (c) => { for (let x = 58; x < 112; x += 7) c.vline(x, 96, 16, "x") }, rect(56, 106, 56, 2, "X"),
    rect(82, 46, 3, 66, "f"), rect(56, 77, 56, 3, "f"),
    rect(47, 38, 12, 80, "r"), vline(55, 38, 80, "R"), rect(109, 38, 12, 80, "r"), vline(109, 38, 80, "R"),
    rect(49, 114, 70, 4, "m")),
  layer("stain", { shade: true, density: 0.5 }, rect(53, 118, 62, 6, "k")),
  layer("poster", rect(176, 54, 52, 44, "K"), rect(179, 57, 46, 38, "Q"), rect(186, 64, 14, 14, "r"), rect(200, 76, 20, 14, "c"), circ(193, 85, 4, "u")),
  layer("kitchen",
    rect(262, 66, 30, 110, "e"), box(262, 66, 30, 110, "E"), hline(262, 112, 30, "E"), rect(285, 80, 2, 20, "5"), rect(285, 120, 2, 24, "5"),
    rect(266, 72, 4, 4, "r"), rect(273, 86, 5, 4, "u"), rect(268, 126, 6, 6, "c"),                   // magnets / drawing
    rect(293, 58, 27, 44, "T"), rect(296, 62, 21, 36, "t"), rect(293, 118, 27, 58, "E"), rect(293, 112, 27, 7, "e"),
    rect(300, 100, 10, 12, "5"), rect(302, 96, 6, 4, "5")),
  layer("chair", rect(139, 152, 22, 8, "x"), rect(141, 160, 3, 34, "x"), rect(156, 160, 3, 34, "x"), hline(139, 152, 22, "Z")),
  layer("couch",
    rect(166, 156, 80, 36, "M"), rect(170, 160, 34, 16, "O"), rect(208, 160, 34, 16, "O"), hline(170, 160, 34, "o"), hline(208, 160, 34, "o"),
    rect(214, 158, 14, 11, "u"), box(214, 158, 14, 11, "U")),
  layer("lowshade", { shade: true, density: 0.5 }, rect(0, 176, 320, 4, "k")),
)
scene("apt_front", { w: 320, h: 240 },
  // desk with laptop and mug
  rect(122, 183, 62, 5, "t"), hline(122, 183, 62, "q"), rect(125, 188, 56, 15, "T"), hline(125, 192, 56, "3"),
  rect(160, 170, 20, 13, "E"), box(160, 170, 20, 13, "5"), rect(156, 182, 28, 2, "5"), circ(170, 176, 2, "e"),
  rect(131, 176, 7, 7, "Q"), rect(138, 178, 2, 3, "Q"), rect(132, 176, 5, 1, "P"),
  // couch front
  rect(166, 186, 80, 14, "O"), hline(166, 186, 80, "o"), rect(166, 197, 80, 3, "M"),
  rect(157, 158, 13, 42, "M"), rect(242, 158, 13, 42, "M"), hline(157, 158, 13, "O"), hline(242, 158, 13, "O"))

// ------------------------------------------------------------------ CHARACTERS
const CAST = {
  nina: { skin: "a", skinS: "A", hair: "l", hairH: "H", top: "s", topS: "S", pants: "v", pantsS: "V", shoes: "Q", hairStyle: "long", extra: "nametag" },
  theo: { skin: "6", skinS: "7", hair: "8", hairH: "9", top: "J", topS: "0", pants: "1", pantsS: "K", shoes: "K", hairStyle: "messy", extra: "badge" },
  maya: { skin: "!", skinS: "@", hair: "$", hairH: "%", top: "&", topS: "*", pants: "-", pantsS: "=", shoes: "K", hairStyle: "bun", extra: "headset" },
}
const POSES = ["stand", "walk1", "walk2", "sit", "up", "situp", "both", "poke"]

function person(c, P, pose) {
  const R = (x, y, w, h, k) => c.rect(x, y, w, h, k)
  const sit = pose === "sit" || pose === "situp"
  if (P.hairStyle === "long") { R(5, 5, 3, 21, P.hair); R(20, 5, 3, 21, P.hair) }               // hair behind shoulders
  // legs
  if (!sit) {
    const lL = pose === "walk1" ? -2 : 0, rL = pose === "walk2" ? -2 : 0
    R(8, 34, 5, 13 + lL, P.pants); R(15, 34, 5, 13 + rL, P.pants); R(12, 34, 1, 13 + lL, P.pantsS); R(19, 34, 1, 13 + rL, P.pantsS)
    R(7, 47 + lL, 6, 3, P.shoes); R(15, 47 + rL, 6, 3, P.shoes)
  } else { R(7, 34, 14, 4, P.pants); R(7, 37, 14, 1, P.pantsS) }
  // torso
  R(7, 18, 14, 16, P.top); R(6, 19, 16, 14, P.top); R(18, 19, 4, 14, P.topS); R(6, 33, 16, 1, P.topS)
  R(12, 17, 4, 2, P.skinS)
  // arms
  const armDown = (x, k) => { R(x, 19, 3, 13, k); R(x, 32, 3, 3, P.skin) }
  const armUp = (x, k) => { R(x, 9, 3, 11, k); R(x, 6, 3, 3, P.skin) }
  if (pose === "both") armUp(3, P.top); else armDown(3, P.top)
  if (pose === "up" || pose === "situp" || pose === "both") armUp(22, P.topS)
  else if (pose === "poke") { R(22, 19, 4, 3, P.topS); R(25, 19, 3, 3, P.skin) }
  else armDown(22, P.topS)
  // head
  R(8, 3, 12, 14, P.skin); R(7, 5, 14, 10, P.skin); R(19, 5, 1, 10, P.skinS); R(9, 16, 10, 1, P.skinS)
  R(6, 9, 1, 3, P.skin); R(21, 9, 1, 3, P.skinS); R(13, 11, 2, 1, P.skinS)
  // hair
  const h = P.hair, hh = P.hairH
  if (P.hairStyle === "long") { R(7, 1, 14, 5, h); R(6, 3, 16, 3, h); R(8, 5, 6, 2, h); R(15, 5, 5, 1, h); R(6, 5, 2, 11, h); R(20, 5, 2, 11, h); R(10, 2, 5, 1, hh); R(6, 8, 1, 6, hh) }
  else if (P.hairStyle === "messy") {
    R(7, 2, 14, 5, h); R(6, 4, 16, 2, h); R(7, 6, 1, 4, h); R(20, 6, 1, 4, h); R(8, 6, 4, 1, h); R(15, 6, 3, 1, h)
    for (const [x, y] of [[8, 1], [10, 0], [11, 1], [14, 0], [15, 1], [18, 1], [19, 0]]) c.px(x, y, h)
    R(11, 3, 4, 1, hh); R(16, 2, 2, 1, hh)
  } else if (P.hairStyle === "bun") {
    c.circ(14, 1, 3, h); R(7, 3, 14, 4, h); R(6, 5, 16, 2, h); R(6, 7, 2, 6, h); R(20, 7, 2, 6, h); R(13, -1, 2, 1, hh); R(10, 4, 3, 1, hh)
  }
  // extras
  if (P.extra === "nametag") { R(16, 21, 3, 2, "Q") }
  if (P.extra === "badge") { R(9, 21, 2, 2, "2"); R(11, 18, 6, 1, P.topS); R(16, 22, 3, 1, P.topS); R(7, 33, 14, 1, "K") }
  if (P.extra === "headset") {
    R(7, 2, 14, 1, "K"); R(6, 3, 1, 5, "K"); R(21, 3, 1, 5, "K"); R(5, 8, 2, 4, "K"); R(21, 8, 2, 4, "K"); c.line(6, 12, 10, 14, "K")
    c.box(9, 8, 4, 4, "K"); c.box(15, 8, 4, 4, "K"); R(13, 9, 2, 1, "K")                         // glasses
  }
}
for (const [name, P] of Object.entries(CAST)) for (const pose of POSES)
  sprite(name + "_" + pose, { w: 28, h: 50, outline: "k" }, (c) => person(c, P, pose))
sheet("chars", ["nina_*", "theo_*", "maya_*"], { pad: 1 })

// ------------------------------------------------------------------ preview only (not embedded)
scene("_check_fire", { w: 320, h: 240 }, stamp("fire", 0, 0), stamp("nina_sit", 146, 141), stamp("theo_stand", 252, 131), stamp("maya_up", 106, 131), stamp("fire_front", 0, 0))
scene("_check_apt", { w: 320, h: 240 }, stamp("apt", 0, 0), stamp("maya_sit", 135, 157), stamp("nina_both", 85, 147), stamp("theo_walk1", 205, 147), stamp("apt_front", 0, 0))
scene("check_fire", { w: 320, h: 240 }, stamp("_check_fire", 0, 0))
scene("check_apt", { w: 320, h: 240 }, stamp("_check_apt", 0, 0))
