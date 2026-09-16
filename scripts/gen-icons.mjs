// Draw every icon the app ships from the one description of the mark in
// logo.mjs: the three PWA pngs, the iOS touch icon, and the svg favicon.
// Zero dependencies — the png encoder is right here.
// Run: npm run icons  (output is committed; re-run after changing logo.mjs)
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { GRID, params, geometry, distanceField, toSVG } from './logo.mjs'

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const OUT = join(PUBLIC, 'icons')
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

// The mark itself lives in logo.mjs; here we only need to know how far any
// point is from its ink, and what the dark palette is in bytes.
const distMark = distanceField()
const HALF = params.stroke / 2
const byte = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
const DARK = { bg: byte(params.dark.tile), fg: byte(params.dark.mark) }

// Always square, always opaque, corner to corner. iOS and Android round the
// icon with their own mask; an icon that ships with its corners already cut has
// transparent ones, and they come back as white slivers wherever the platform's
// curve does not match the one baked into the png.
function makeIcon(size, { scale = 1, palette = DARK } = {}) {
  const buf = Buffer.alloc(size * size * 4)
  const unit = size / GRID           // one grid unit, in pixels
  const half = HALF * unit
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
// ...and the favicon, from the same numbers, so the tab and the home screen can
// never drift apart.
writeFileSync(join(PUBLIC, 'favicon.svg'), toSVG())
console.log('Icone e favicon riscritte da scripts/logo.mjs')
