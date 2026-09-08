// Generate placeholder PWA icons with zero dependencies.
// Draws an indigo gradient square with a 2x2 grid of white dots.
// Run: npm run icons  (already committed output; re-run only to regenerate)
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

function makeIcon(size, { rounded }) {
  const buf = Buffer.alloc(size * size * 4)
  const radius = size * 0.22
  const dotR = size * 0.11
  const centers = [0.34, 0.66]
  const px = (x, y, r, g, b, a) => {
    const i = (y * size + x) * 4
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // vertical gradient #6d5efc -> #4b3fd6
      const t = y / size
      let r = Math.round(0x6d + (0x4b - 0x6d) * t)
      let g = Math.round(0x5e + (0x3f - 0x5e) * t)
      let b = Math.round(0xfc + (0xd6 - 0xfc) * t)
      let a = 255

      // white dots
      for (const cx of centers) {
        for (const cy of centers) {
          const dx = x - cx * size
          const dy = y - cy * size
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < dotR) { r = 255; g = 255; b = 255 }
          else if (d < dotR + 1.5) {
            const k = (dotR + 1.5 - d) / 1.5
            r = Math.round(r + (255 - r) * k)
            g = Math.round(g + (255 - g) * k)
            b = Math.round(b + (255 - b) * k)
          }
        }
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
      px(x, y, r, g, b, a)
    }
  }
  return encodePNG(size, size, buf)
}

writeFileSync(join(OUT, 'icon-192.png'), makeIcon(192, { rounded: true }))
writeFileSync(join(OUT, 'icon-512.png'), makeIcon(512, { rounded: true }))
writeFileSync(join(OUT, 'maskable-512.png'), makeIcon(512, { rounded: false }))
console.log('Icons written to', OUT)
