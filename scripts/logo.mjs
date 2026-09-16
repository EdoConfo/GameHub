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

// The same four strokes as a distance field, for the png rasteriser: how far a
// point is from the nearest bit of ink, before the line weight is taken off.
// Round caps everywhere, so past the end of a stroke the distance is measured
// to its endpoint — that rounded corner is the cap.
export function distanceField(p = params) {
  const g = geometry(p)
  const segments = [
    [g.cx, g.top, g.cx, g.bottom],
    [g.rightX, g.top, g.rightX, g.rightStemBottom],
    [g.barX, g.cy, g.barEnd, g.cy]
  ]
  const from = rad(g.openFrom), to = rad(g.openTo)
  const ends = [at(g, g.openFrom), at(g, g.openTo)]

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
    for (const s of segments) d = Math.min(d, seg(x, y, ...s))
    return d
  }
}

// The favicon: one tile, four strokes, and a media query so the mark follows the
// reader's theme instead of carrying a colour of its own.
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
