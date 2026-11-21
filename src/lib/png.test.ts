import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { decodePng, encodePng, placeTopLeft, type RgbImage } from './png'

function sample(width: number, height: number): RgbImage {
  const rgb = new Uint8Array(width * height * 3)
  for (let i = 0; i < rgb.length; i++) rgb[i] = (i * 37 + (i >> 5)) & 255
  return { width, height, rgb }
}

describe('png', () => {
  it('decodes what it encodes, pixel for pixel', () => {
    const image = sample(13, 7)
    const back = decodePng(encodePng(image))
    expect(back.width).toBe(13)
    expect(back.height).toBe(7)
    expect(Buffer.from(back.rgb).equals(Buffer.from(image.rgb))).toBe(true)
  })

  it('decodes a real filtered PNG made by another encoder', () => {
    // A 1×1 red pixel written by a standard encoder.
    const red = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64')
    expect([...decodePng(red).rgb]).toEqual([255, 0, 0])
  })

  it('puts the image in the top-left of a black canvas', () => {
    const image = sample(4, 2)
    const canvas = placeTopLeft(image, 6, 3)
    expect(canvas.rgb.length).toBe(6 * 3 * 3)
    expect([...canvas.rgb.subarray(0, 12)]).toEqual([...image.rgb.subarray(0, 12)])          // first row, the image
    expect([...canvas.rgb.subarray(12, 18)]).toEqual([0, 0, 0, 0, 0, 0])                      // right of it, black
    expect([...canvas.rgb.subarray(18, 30)]).toEqual([...image.rgb.subarray(12, 24)])        // second row
    expect([...canvas.rgb.subarray(36)].every(v => v === 0)).toBe(true)                        // last row, black
  })

  it('cuts the image off when the canvas is smaller', () => {
    const canvas = placeTopLeft(sample(4, 4), 2, 2)
    expect(canvas.rgb.length).toBe(12)
  })

  it('rejects files it cannot read', () => {
    expect(() => decodePng(Buffer.from('not a png'))).toThrow(/not a PNG/)
  })
})

describe('the GZAD banner', () => {
  const file = join(__dirname, '../../../led-images/gzad-dark-banner-240x80.png')
  it.runIf(existsSync(file))('decodes and lands top-left on a 1280×720 canvas unchanged', () => {
    const banner = decodePng(readFileSync(file))
    expect([banner.width, banner.height]).toEqual([240, 80])
    const out = decodePng(encodePng(placeTopLeft(banner, 1280, 720)))
    const at = (img: RgbImage, x: number, y: number) => [...img.rgb.subarray((y * img.width + x) * 3, (y * img.width + x) * 3 + 3)]
    for (const [x, y] of [[0, 0], [120, 40], [239, 79], [57, 13]]) expect(at(out, x, y)).toEqual(at(banner, x, y))
    expect(at(out, 240, 0)).toEqual([0, 0, 0])
    expect(at(out, 0, 80)).toEqual([0, 0, 0])
  })
})

function existsSync(path: string) {
  try { readFileSync(path); return true } catch { return false }
}
