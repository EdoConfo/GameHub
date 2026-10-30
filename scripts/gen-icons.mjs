// Draw every icon the app ships from the one description of the mark in
// logo.mjs: the three PWA pngs, the iOS touch icon, and the svg favicon.
// Zero dependencies — the png encoder is right here.
// Run: npm run icons  (output is committed; re-run after changing logo.mjs)
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { GRID, params, distanceField, toSVG, toOutlineSVG } from './logo.mjs'

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const OUT = join(PUBLIC, 'icons')
// the dev site's set: the same icons with DEV on them (see vite.config.js)
const OUT_DEV = join(PUBLIC, 'icons-dev')
mkdirSync(OUT, { recursive: true })
mkdirSync(OUT_DEV, { recursive: true })

// ---- CRC32 for PNG chunks ----
const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 6   // color type RGBA
  // rest 0
  // raw scanlines with filter byte 0
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// The mark itself lives in logo.mjs; here we only need to know how far any
// point is from its ink, and what the dark palette is in bytes.
const byte = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
const paletteOf = p => ({ bg: byte(p.dark.tile), fg: byte(p.dark.mark) })
const DARK = paletteOf(params)

// ---- the DEV tag ----
// Three letters drawn as strokes on a small grid, so they need no font: each
// one a polyline, 3 units wide and 5 tall, 1.6 units apart.
const GLYPHS = [
  [[[0, 0], [2.1, 0], [3, 0.9], [3, 4.1], [2.1, 5], [0, 5], [0, 0]]],          // D
  [[[3, 0], [0, 0], [0, 5], [3, 5]], [[0, 2.5], [2.4, 2.5]]],                  // E
  [[[0, 0], [1.5, 5], [3, 0]]]                                                 // V
]
const TEXT_W = 3 * 3 + 2 * 1.6, TEXT_H = 5

function segDist(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}

// Distance from (x, y), in text units, to the nearest stroke of DEV.
function textDist(x, y) {
  let d = Infinity
  GLYPHS.forEach((lines, i) => {
    const ox = i * (3 + 1.6)
    for (const line of lines) {
      for (let k = 1; k < line.length; k++) {
        const a = [line[k - 1][0] + ox, line[k - 1][1]], b = [line[k][0] + ox, line[k][1]]
        d = Math.min(d, segDist(x, y, a, b))
      }
    }
  })
  return d
}

// Signed distance to a rounded box centred on (cx, cy): negative inside.
function boxDist(x, y, cx, cy, hw, hh, r) {
  const qx = Math.abs(x - cx) - hw + r, qy = Math.abs(y - cy) - hh + r
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}

// The tag as a painter: given a pixel, what goes on top of the icon there.
//   at: where its centre sits, as a fraction of the icon; w: its width, too
// It is a pill in the mark's own white with the letters in the tile's colour,
// and a ring of the tile round it so it reads as stuck on, not merged into the
// monogram.
function devTag(size, { at = [0.7, 0.82], w = 0.46 } = {}) {
  const hw = (w * size) / 2, hh = hw * 0.42
  const cx = at[0] * size, cy = at[1] * size
  const ring = size * 0.02
  const unit = (hh * 1.05) / TEXT_H // the letters fill about half the pill's height
  const tx = cx - (TEXT_W * unit) / 2, ty = cy - (TEXT_H * unit) / 2
  const half = unit * 0.55
  return (x, y) => {
    const box = boxDist(x, y, cx, cy, hw, hh, hh)
    if (box > ring + 1) return null
    const cover = k => Math.max(0, Math.min(1, 0.5 - k))
    const text = textDist((x - tx) / unit, (y - ty) / unit) * unit - half
    return { ring: cover(box - ring), pill: cover(box), text: cover(text) }
  }
}

// Always square, always opaque, corner to corner. iOS and Android round the
// icon with their own mask; an icon that ships with its corners already cut has
// transparent ones, and they come back as white slivers wherever the platform's
// curve does not match the one baked into the png.
// ---- the look iOS gives the real icon ----
// Added to the Home screen, the real icon doesn't stay as drawn: iOS turns it
// into its own glass — a neutral grey background darkening downwards, the mark
// a soft white that dims the same way. It leaves an icon with the DEV tag on it
// alone, though (tried: without the tag the dev icon went grey too; neither a
// shaded nor a grainy background changed that). So the dev icon is drawn the
// way iOS shows the real one — measured off a Home screen — and the two sit
// side by side looking the same, tag aside.
//   t: 0 at the top of the icon, 1 at the bottom
const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t))
// Measured twice: iOS still lays a faint sheen of its own over the dev icon
// (a little lighter behind, a little duller on top), so these sit that much
// the other way — side by side on the Home screen, the two then match.
const IOS_GLASS = t => ({ bg: lerp([31, 31, 31], [12, 12, 12], t), fg: lerp([244, 245, 249], [207, 208, 211], t) })

function makeIcon(size, { scale = 1, palette = DARK, field = distanceField(), half = params.stroke / 2, tag = null, look = null } = {}) {
  const buf = Buffer.alloc(size * size * 4)
  const unit = size / GRID           // one grid unit, in pixels
  const halfPx = half * unit
  const aa = 0.8                     // edge softening, in pixels
  for (let y = 0; y < size; y++) {
    // a look that changes down the icon replaces the flat palette, row by row
    if (look) palette = look(y / (size - 1))
    for (let x = 0; x < size; x++) {
      let [r, g, b] = palette.bg
      let a = 255

      // the white monogram over it
      const gx = ((x + 0.5) / unit - GRID / 2) / scale + GRID / 2
      const gy = ((y + 0.5) / unit - GRID / 2) / scale + GRID / 2
      const d = field(gx, gy) * unit * scale - halfPx * scale
      if (d < aa) {
        const k = d <= -aa ? 1 : (aa - d) / (2 * aa)
        r = Math.round(r + (palette.fg[0] - r) * k)
        g = Math.round(g + (palette.fg[1] - g) * k)
        b = Math.round(b + (palette.fg[2] - b) * k)
      }

      // the DEV tag on top, for the dev site's set
      const over = tag && tag(x + 0.5, y + 0.5)
      if (over) {
        const mix = (c, k) => { r = Math.round(r + (c[0] - r) * k); g = Math.round(g + (c[1] - g) * k); b = Math.round(b + (c[2] - b) * k) }
        mix(palette.bg, over.ring)
        mix(palette.fg, over.pill)
        mix(palette.bg, over.text * over.pill)
      }

      const i = (y * size + x) * 4
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a
    }
  }
  return encodePNG(size, size, buf)
}

writeFileSync(join(OUT, 'icon-192.png'), makeIcon(192))
writeFileSync(join(OUT, 'icon-512.png'), makeIcon(512))
// iOS asks for 180 and resamples anything else; give it that size exactly.
writeFileSync(join(OUT, 'apple-touch-icon.png'), makeIcon(180))
// Android may mask a maskable icon down to a circle: keep the mark inside the
// safe zone (the middle 80%) instead of letting the stems get clipped.
writeFileSync(join(OUT, 'maskable-512.png'), makeIcon(512, { scale: 0.78 }))
// The dev site's set: the same, with DEV in the bottom-right corner — inside
// it, since iOS and Android round the corner off. A maskable icon may be cut
// down to a circle, so there the tag moves to the bottom middle, in the safe zone.
// Drawn in the look iOS gives the real icon (IOS_GLASS above).
for (const size of [192, 512]) writeFileSync(join(OUT_DEV, `icon-${size}.png`), makeIcon(size, { tag: devTag(size), look: IOS_GLASS }))
writeFileSync(join(OUT_DEV, 'apple-touch-icon.png'), makeIcon(180, { tag: devTag(180), look: IOS_GLASS }))
writeFileSync(join(OUT_DEV, 'maskable-512.png'), makeIcon(512, { scale: 0.78, tag: devTag(512, { at: [0.5, 0.76], w: 0.36 }), look: IOS_GLASS }))
// ...and the favicon, from the same numbers, so the tab and the home screen can
// never drift apart. Four strokes while the corners are sharp; a traced outline
// once they are rounded, because a fillet belongs to no single stroke.
const svg = p => (p.fillet > 0 ? toOutlineSVG(p) : toSVG(p))
writeFileSync(join(PUBLIC, 'favicon.svg'), svg(params))

console.log('Icone e favicon riscritte da scripts/logo.mjs')
