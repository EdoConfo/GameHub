// The GameHub mark, in one place.
//
// This file is the only place the shape is described. The favicon and every PWA
// icon are generated from it by `npm run icons` — so change a number here, run
// that, and the site, the browser tab and the phone's home screen all follow.
// Nothing is drawn by hand any more, and there is nothing to keep in sync.
//
// The mark, in words: a circle with its top-right quarter missing, which is what
// makes it a G. The H's left stem is the circle's vertical diameter; its right
// stem comes down from the top and stops at the crossbar, so below the bar the
// right-hand side is nothing but arc. The crossbar starts half a radius left of
// centre and runs out to the stem, doubling as the G's bar — and the arc ends at
// 3 o'clock, right where the two meet.
//
// Everything sits in a 64-unit square, the same grid the favicon uses. Angles
// are degrees, clockwise, 0 at 3 o'clock — so 90 is 6 o'clock and -90 is noon.

export const GRID = 64

export const params = {
  // --- the ones worth touching ---
  stroke: 5,        // line weight. The app's own icons are 1.8 on 24, i.e. 4.8 here
  margin: 8,        // empty band around the mark, per side. Bigger = smaller mark
  barStart: 0.5,    // where the crossbar begins, in radii left of centre (0 = at the left stem, 1 = at the circle)
  openFrom: -90,    // the ring's gap starts here (-90 = noon)
  openTo: 0,        // ...and ends here (0 = 3 o'clock). Widen it and the G opens up
  rightStemTo: 0,   // how far the right stem runs below centre, in radii (0 = stops on the bar, 1 = full height)
  // Rounds the inside corners where two lines meet, roughly this radius; 0 keeps
  // them sharp, which is what the mark ships with. Set it and run `npm run icons`
  // and everything follows — the generator switches the favicon from four
  // strokes to a traced outline on its own, because a fillet belongs to no
  // single stroke. 2 is about the most the counters take before they close up.
  fillet: 0,

  // --- shape of the tile the mark sits on ---
  tileRadius: 14,   // corner rounding of the favicon's tile. The phone icons are square: iOS and Android round them themselves

  // --- colour: the app's own two grounds, nothing of its own ---
  light: { tile: '#f6f7f9', mark: '#14161f' },
  dark: { tile: '#0f1117', mark: '#eef0f5' }
}

// Everything else follows from those. The radius is whatever is left once the
// margin and half the line weight are taken off, so the mark's outer edge lands
// exactly on the margin no matter what you set.
//
// Every line is round-capped, and the numbers below are the ends of the lines
// themselves, not of their caps: each cap then reaches half a stroke further.
// That is what makes the joins disappear. Where a stem meets the ring, its cap
// is a small circle sitting entirely inside the ring's own stroke, touching the
// outside edge at exactly one point — so the silhouette there is the ring's
// curve and nothing else. A flat end would instead cut straight across it and
// leave a step, which is precisely what it used to do.
export function geometry(p = params) {
  const cx = GRID / 2, cy = GRID / 2
  const r = GRID / 2 - p.margin - p.stroke / 2
  const reach = p.stroke / 2          // how far past its end a cap reaches
  return {
    cx, cy, r, reach,
    stroke: p.stroke,
    top: cy - r,
    bottom: cy + r,
    rightX: cx + r,
    rightStemBottom: cy + p.rightStemTo * r,
    barX: cx - p.barStart * r + reach,  // barStart is where the ink starts, cap included
    barEnd: cx + r,
    openFrom: p.openFrom,
    openTo: p.openTo
  }
}

const rad = d => d * Math.PI / 180
const at = (g, deg) => [g.cx + g.r * Math.cos(rad(deg)), g.cy + g.r * Math.sin(rad(deg))]
const n = v => Number(v.toFixed(4)).toString()

// The four strokes, as SVG path data. The ring is drawn the long way round: from
// the far edge of the gap, clockwise, back to its near edge.
export function paths(p = params) {
  const g = geometry(p)
  const [sx, sy] = at(g, g.openTo)
  const [ex, ey] = at(g, g.openFrom)
  const sweep = ((g.openFrom - g.openTo) % 360 + 360) % 360   // how much ring is left
  return [
    `M${n(sx)} ${n(sy)}A${n(g.r)} ${n(g.r)} 0 ${sweep > 180 ? 1 : 0} 1 ${n(ex)} ${n(ey)}`,
    `M${n(g.cx)} ${n(g.top)}V${n(g.bottom)}`,
    `M${n(g.rightX)} ${n(g.top)}V${n(g.rightStemBottom)}`,
    `M${n(g.barX)} ${n(g.cy)}H${n(g.barEnd)}`
  ]
}

// Blend two distances instead of just taking the nearer one. Where they are
// within k of each other — which is to say, near a corner where two lines meet —
// the result dips below both, and the ink swells to fill the corner with a
// radius of about k. Everywhere else it is plain min, so nothing else moves.
// This is the only honest way to round an inside corner: a cap can't do it, it
// is the meeting itself that has to be softened.
function smin(a, b, k) {
  if (!(k > 0)) return Math.min(a, b)
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

// The same four strokes as a distance field, for the png rasteriser: how far a
// point is from the nearest bit of ink, before the line weight is taken off.
// Round caps everywhere, so past the end of a stroke the distance is measured
// to its endpoint — that rounded corner is the cap.
export function distanceField(p = params) {
  const g = geometry(p)

  // An end that dies inside another line is pulled back half a line, so its cap
  // sits within that line instead of reaching its far edge. Touching edges are
  // the whole problem: to the blend, two boundaries that meet read as a corner,
  // and it rounds a corner that was never there.
  //
  // Only ends that are genuinely buried get tucked — the left stem's two ends,
  // which die inside the ring; the ring's own end at noon, which dies inside
  // that stem; and the crossbar's right end, which dies inside the right stem.
  // Everything else is holding up the silhouette and has to stay put: the top of
  // the right stem, the left end of the bar, the ring's end at 3 o'clock, and
  // the foot of the right stem, which is the mark's own right edge. Pull one of
  // those back and you don't remove a bump, you dig a dent.
  //
  // With sharp corners there is no blend to protect against, so nothing moves.
  const tuck = p.fillet > 0 ? g.reach : 0

  const segments = [
    [g.cx, g.top + tuck, g.cx, g.bottom - tuck],
    [g.rightX, g.top, g.rightX, g.rightStemBottom],
    [g.barX, g.cy, g.barEnd - tuck, g.cy]
  ]
  // the ring is tucked the same way at noon, as an angle: half a line of arc
  const from = rad(g.openFrom) - tuck / g.r, to = rad(g.openTo) + tuck / g.r
  const ends = [
    [g.cx + g.r * Math.cos(from), g.cy + g.r * Math.sin(from)],
    [g.cx + g.r * Math.cos(to), g.cy + g.r * Math.sin(to)]
  ]

  const seg = (x, y, ax, ay, bx, by) => {
    const vx = bx - ax, vy = by - ay
    const wx = x - ax, wy = y - ay
    const len2 = vx * vx + vy * vy
    const t = len2 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2)) : 0
    const dx = wx - vx * t, dy = wy - vy * t
    return Math.sqrt(dx * dx + dy * dy)
  }

  return (x, y) => {
    const dx = x - g.cx, dy = y - g.cy
    const a = Math.atan2(dy, dx)                    // 0 = right, +pi/2 = down
    let d = a > from && a < to
      // inside the gap there is no ring, only the round cap at either end of it
      ? Math.min(Math.hypot(x - ends[0][0], y - ends[0][1]),
                 Math.hypot(x - ends[1][0], y - ends[1][1]))
      : Math.abs(Math.sqrt(dx * dx + dy * dy) - g.r)
    for (const s of segments) d = smin(d, seg(x, y, ...s), p.fillet)
    return d
  }
}

// The favicon: one tile, four strokes, and a media query so the mark follows the
// reader's theme instead of carrying a colour of its own. Valid only while the
// corners are sharp — see toOutlineSVG for why a fillet can't be stroked.
export function toSVG(p = params) {
  const d = paths(p).map(s => `    <path d="${s}"/>`).join('\n')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}" role="img" aria-label="GameHub">
  <!-- Generated by scripts/gen-icons.mjs from scripts/logo.mjs — don't edit by
       hand, change the numbers there and run \`npm run icons\`. -->
  <style>
    .tile { fill: ${p.light.tile} }
    .mark { stroke: ${p.light.mark} }
    @media (prefers-color-scheme: dark) {
      .tile { fill: ${p.dark.tile} }
      .mark { stroke: ${p.dark.mark} }
    }
  </style>
  <rect class="tile" width="${GRID}" height="${GRID}" rx="${p.tileRadius}"/>
  <g class="mark" fill="none" stroke-width="${p.stroke}" stroke-linecap="round">
${d}
  </g>
</svg>
`
}

// ---- tracing the outline ----------------------------------------------------
// With fillet: 0 the mark is four strokes and the svg above says exactly that.
// A fillet, though, is not a property of any one stroke — it lives in the way
// two of them meet — so there is no stroke to write it on. The shape has to be
// described as its own outline instead: walk the distance field, find where it
// crosses zero, and emit that boundary as a filled path.
//
// Marching squares: sample the field on a grid, and in every cell where some
// corners are inside the ink and some are outside, cut the cell with a segment
// whose ends sit where the field crosses zero along the cell's edges.
const CASES = [
  [], [[3, 0]], [[0, 1]], [[3, 1]], [[1, 2]], [[3, 0], [1, 2]], [[0, 2]], [[3, 2]],
  [[2, 3]], [[2, 0]], [[0, 1], [2, 3]], [[2, 1]], [[1, 3]], [[1, 0]], [[0, 3]], []
]

function contours(p, samples) {
  const field = distanceField(p)
  const half = p.stroke / 2
  const step = GRID / samples
  const n = samples + 1
  const v = new Float64Array(n * n)
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) v[j * n + i] = field(i * step, j * step) - half

  // where along an edge the field hits zero, in grid coordinates
  const cut = (ax, ay, bx, by) => {
    const va = v[ay * n + ax], vb = v[by * n + bx]
    const t = va / (va - vb)
    return [(ax + (bx - ax) * t) * step, (ay + (by - ay) * t) * step]
  }
  // Name a crossing by the cell edge it sits on, not by its coordinates: two
  // neighbouring cells then agree on it exactly, with nothing to round off.
  const edgeKey = (i, j, e) =>
    e === 0 ? `h${i},${j}` :
    e === 1 ? `v${i + 1},${j}` :
    e === 2 ? `h${i},${j + 1}` :
              `v${i},${j}`

  // one entry per segment, keyed by the edge it starts on, so they chain up
  const next = new Map()
  for (let j = 0; j < samples; j++) for (let i = 0; i < samples; i++) {
    const c = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]]
    let idx = 0
    for (let k = 0; k < 4; k++) if (v[c[k][1] * n + c[k][0]] < 0) idx |= 1 << k
    for (const [a, b] of CASES[idx]) {
      next.set(edgeKey(i, j, a), { from: cut(...c[a], ...c[(a + 1) % 4]), to: edgeKey(i, j, b) })
    }
  }

  // follow each chain from edge to edge until it comes back on itself
  const loops = []
  const seen = new Set()
  for (const [start, seg] of next) {
    if (seen.has(start)) continue
    const loop = []
    let key = start, cur = seg, guard = next.size + 1
    while (cur && !seen.has(key) && guard-- > 0) {
      seen.add(key)
      loop.push(cur.from)
      key = cur.to
      cur = next.get(key)
    }
    if (loop.length > 8) loops.push(loop)
  }
  return loops
}

// Douglas-Peucker: drop every point that sits closer than `tol` to the line
// between the ones that survive around it.
function simplify(points, tol) {
  const keep = (lo, hi, out) => {
    const [ax, ay] = points[lo], [bx, by] = points[hi]
    let worst = -1, at = -1
    const vx = bx - ax, vy = by - ay, len = Math.hypot(vx, vy) || 1
    for (let i = lo + 1; i < hi; i++) {
      const [x, y] = points[i]
      const d = Math.abs((x - ax) * vy - (y - ay) * vx) / len
      if (d > worst) { worst = d; at = i }
    }
    if (worst > tol) { keep(lo, at, out); keep(at, hi, out) }
    else out.push(points[hi])
  }
  if (points.length < 3) return points
  const out = [points[0]]
  const mid = Math.floor(points.length / 2)
  keep(0, mid, out)
  keep(mid, points.length - 1, out)
  return out
}

const r2 = v => Number(v.toFixed(2)).toString()

// The outline as svg path data. evenodd so the counters come out as holes
// without having to care which way round each loop was traced.
export function outlinePath(p = params, { samples = 1024, tolerance = 0.035 } = {}) {
  return contours(p, samples)
    .map(loop => simplify(loop, tolerance))
    .map(loop => 'M' + loop.map(([x, y]) => `${r2(x)} ${r2(y)}`).join('L') + 'Z')
    .join('')
}

// The filleted mark as an svg: one filled outline instead of four strokes.
export function toOutlineSVG(p = params) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}" role="img" aria-label="GameHub">
  <!-- Generated by scripts/gen-icons.mjs from scripts/logo.mjs — don't edit by
       hand. This one is traced rather than stroked, because its inside corners
       are rounded and a rounded corner belongs to no single line. -->
  <style>
    .tile { fill: ${p.light.tile} }
    .mark { fill: ${p.light.mark} }
    @media (prefers-color-scheme: dark) {
      .tile { fill: ${p.dark.tile} }
      .mark { fill: ${p.dark.mark} }
    }
  </style>
  <rect class="tile" width="${GRID}" height="${GRID}" rx="${p.tileRadius}"/>
  <path class="mark" fill-rule="evenodd" d="${outlinePath(p)}"/>
</svg>
`
}
