import { deflateSync, inflateSync } from 'node:zlib'

// Just enough PNG to compose the screens' idle background: decode an 8-bit
// RGB or RGBA image, place it on a black canvas, encode the result as RGB.

export interface RgbImage {
  width: number
  height: number
  /** 3 bytes per pixel, rows from the top. */
  rgb: Uint8Array
}

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

export function decodePng(data: Uint8Array): RgbImage {
  const buf = Buffer.from(data)
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG file')

  let width = 0
  let height = 0
  let channels = 0
  const idat: Buffer[] = []
  for (let i = 8; i + 8 <= buf.length;) {
    const length = buf.readUInt32BE(i)
    const type = buf.toString('latin1', i + 4, i + 8)
    const body = buf.subarray(i + 8, i + 8 + length)
    if (type === 'IHDR') {
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
      const [bitDepth, colorType, , , interlace] = body.subarray(8, 13)
      if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6) || interlace !== 0) {
        throw new Error(`unsupported PNG: bit depth ${bitDepth}, colour type ${colorType}, interlace ${interlace}`)
      }
      channels = colorType === 6 ? 4 : 3
    } else if (type === 'IDAT') {
      idat.push(body)
    } else if (type === 'IEND') {
      break
    }
    i += 12 + length
  }
  if (!channels || width === 0 || height === 0) throw new Error('PNG has no image header')

  // Undo the per-row filters (PNG spec, section 9).
  const stride = width * channels
  const raw = inflateSync(Buffer.concat(idat))
  if (raw.length < (stride + 1) * height) throw new Error('PNG image data is truncated')
  const px = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const src = y * (stride + 1) + 1
    const row = y * stride
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? px[row + x - channels] : 0
      const b = y > 0 ? px[row - stride + x] : 0
      const c = x >= channels && y > 0 ? px[row - stride + x - channels] : 0
      let predicted = 0
      if (filter === 1) predicted = a
      else if (filter === 2) predicted = b
      else if (filter === 3) predicted = (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        predicted = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      } else if (filter !== 0) throw new Error(`bad PNG row filter ${filter}`)
      px[row + x] = (raw[src + x] + predicted) & 255
    }
  }

  if (channels === 3) return { width, height, rgb: px }
  // Transparent parts show black, like the LED.
  const rgb = Buffer.alloc(width * height * 3)
  for (let i = 0, j = 0; i < px.length; i += 4, j += 3) {
    const alpha = px[i + 3] / 255
    rgb[j] = Math.round(px[i] * alpha)
    rgb[j + 1] = Math.round(px[i + 1] * alpha)
    rgb[j + 2] = Math.round(px[i + 2] * alpha)
  }
  return { width, height, rgb }
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 255] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, body: Buffer): Buffer {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(body.length, 0)
  head.write(type, 4, 'latin1')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0)
  return Buffer.concat([head, body, crc])
}

export function encodePng({ width, height, rgb }: RgbImage): Buffer {
  const stride = width * 3
  const raw = Buffer.alloc((stride + 1) * height)   // filter byte 0 (none) on every row
  for (let y = 0; y < height; y++) raw.set(rgb.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1)
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 2   // RGB
  return Buffer.concat([SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

/** A black canvas of the given size with the image in its top-left corner, cut off if it doesn't fit. */
export function placeTopLeft(image: RgbImage, width: number, height: number): RgbImage {
  const rgb = new Uint8Array(width * height * 3)
  const copyWidth = Math.min(image.width, width) * 3
  for (let y = 0; y < Math.min(image.height, height); y++) {
    rgb.set(image.rgb.subarray(y * image.width * 3, y * image.width * 3 + copyWidth), y * width * 3)
  }
  return { width, height, rgb }
}
