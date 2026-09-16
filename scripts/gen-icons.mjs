// Generate the PWA icons with zero dependencies: the same GH monogram as
// public/favicon.svg, rasterised by hand so the SVG stays the single source of
// the shape and nobody has to open a design tool to rebuild a png.
// Run: npm run icons  (output is committed; re-run only after changing the mark)
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
mkdirSync(OUT, { recursive: true })

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

// ---- the mark, in the favicon's own 64-unit grid ----
// Keep these in step with public/favicon.svg, which is where the shape is
// documented: one circle open in the top-right quadrant, the H's two stems on
// the circle's centre line and right extreme, a crossbar from half a radius out
// to the stem. Butt caps everywhere.
const GRID = 64
const STROKE = 5
const CX = 32, CY = 32
const R = 32 - 8 - STROKE / 2   // margin 8, measured to the outside of the stroke
const REACH = STROKE / 2        // stems and bar reach the mark's own edge
const TOP = CY - R - REACH, BOT = CY + R + REACH
const RIGHT = CX + R
const BAR = CX - R / 2
const END = CX + R + REACH

// The app's own two grounds — no colour of its own. A png can't follow the
// phone's theme the way the svg favicon does, so the home screen gets the dark
// one: it sits well on either wallpaper.
const DARK = { bg: [0x0f, 0x11, 0x17], fg: [0xee, 0xf0, 0xf5] }

// Distance to a butt-capped stroke: perpendicular distance inside the segment's
// own span, nothing at all outside it.
function distSegment(x, y, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay
  const wx = x - ax, wy = y - ay
  const len2 = vx * vx + vy * vy
  const t = len2 ? (wx * vx + wy * vy) / len2 : 0
  if (t < 0 || t > 1) return Infinity
  const dx = wx - vx * t, dy = wy - vy * t
  return Math.sqrt(dx * dx + dy * dy)
}

// The ring is drawn everywhere except the top-right quadrant: that missing
// quarter is what makes the circle read as a G, and below the crossbar the
// right-hand side is nothing but arc.
function distArc(x, y) {
  const dx = x - CX, dy = y - CY
  const a = Math.atan2(dy, dx)                       // 0 = right, +pi/2 = down
  if (a > -Math.PI / 2 && a < 0) return Infinity     // the open quadrant
  return Math.abs(Math.sqrt(dx * dx + dy * dy) - R)
}

function distMark(x, y) {
  return Math.min(
    distArc(x, y),
    distSegment(x, y, CX, TOP, CX, BOT),
    distSegment(x, y, RIGHT, TOP, RIGHT, CY),   // only down to the crossbar
    distSegment(x, y, BAR, CY, END, CY)
  )
}

function makeIcon(size, { rounded, scale = 1, palette = DARK }) {
  const buf = Buffer.alloc(size * size * 4)
  const unit = size / GRID           // one grid unit, in pixels
  const half = (STROKE / 2) * unit
  const radius = size * 0.22
  const aa = 0.8                     // edge softening, in pixels
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let [r, g, b] = palette.bg
      let a = 255

      // the white monogram over it
      const gx = ((x + 0.5) / unit - GRID / 2) / scale + GRID / 2
      const gy = ((y + 0.5) / unit - GRID / 2) / scale + GRID / 2
      const d = distMark(gx, gy) * unit * scale - half * scale
      if (d < aa) {
        const k = d <= -aa ? 1 : (aa - d) / (2 * aa)
        r = Math.round(r + (palette.fg[0] - r) * k)
        g = Math.round(g + (palette.fg[1] - g) * k)
        b = Math.round(b + (palette.fg[2] - b) * k)
      }

      // rounded corners (alpha) for the "any" icons; maskable stays full-bleed
      if (rounded) {
        const insetX = Math.min(x, size - 1 - x)
        const insetY = Math.min(y, size - 1 - y)
        if (insetX < radius && insetY < radius) {
          const dcx = radius - insetX
          const dcy = radius - insetY
          const dd = Math.sqrt(dcx * dcx + dcy * dcy)
          if (dd > radius) a = 0
          else if (dd > radius - 1.5) a = Math.round(255 * (radius - dd) / 1.5)
        }
      }
      const i = (y * size + x) * 4
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a
    }
  }
  return encodePNG(size, size, buf)
}

writeFileSync(join(OUT, 'icon-192.png'), makeIcon(192, { rounded: true }))
writeFileSync(join(OUT, 'icon-512.png'), makeIcon(512, { rounded: true }))
// Android may mask a maskable icon down to a circle: keep the mark inside the
// safe zone (the middle 80%) instead of letting the stems get clipped.
writeFileSync(join(OUT, 'maskable-512.png'), makeIcon(512, { rounded: false, scale: 0.78 }))
console.log('Icons written to', OUT)
