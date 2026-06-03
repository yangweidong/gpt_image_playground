import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from '../types'
import {
  GREEN_KEY_COLOR,
  MAGENTA_KEY_COLOR,
  buildTransparentPrompt,
  createTransparentOutputMeta,
  getTransparentRequestParams,
  pickTransparentKeyColor,
  removeKeyedBackgroundFromPixels,
} from './transparentImage'

describe('transparent image prompt and params', () => {
  it('uses green key color for ordinary prompts', () => {
    expect(pickTransparentKeyColor('红色马克杯，产品图')).toBe(GREEN_KEY_COLOR)
  })

  it('uses magenta key color when the subject likely contains green', () => {
    expect(pickTransparentKeyColor('绿色树叶游戏图标')).toBe(MAGENTA_KEY_COLOR)
    expect(pickTransparentKeyColor('a mint green sticker')).toBe(MAGENTA_KEY_COLOR)
  })

  it('builds a fixed transparent workflow prompt', () => {
    const prompt = buildTransparentPrompt('一只红色机器人', GREEN_KEY_COLOR)

    expect(prompt).toContain('一只红色机器人')
    expect(prompt).toContain(GREEN_KEY_COLOR)
    expect(prompt).toContain('纯色')
    expect(prompt).toContain('不要把背景色用于主体')
  })

  it('forces transparent requests to PNG without mutating the original params', () => {
    const params = {
      ...DEFAULT_PARAMS,
      output_format: 'jpeg' as const,
      output_compression: 80,
      transparent_output: true,
    }
    const next = getTransparentRequestParams(params)

    expect(next).toMatchObject({
      output_format: 'png',
      output_compression: null,
      transparent_output: true,
    })
    expect(params.output_format).toBe('jpeg')
    expect(params.output_compression).toBe(80)
  })

  it('creates task metadata with the effective prompt and key color', () => {
    const meta = createTransparentOutputMeta('绿色产品贴纸')

    expect(meta.transparentOutput).toBe(true)
    expect(meta.transparentKeyColor).toBe(MAGENTA_KEY_COLOR)
    expect(meta.effectivePrompt).toContain(MAGENTA_KEY_COLOR)
  })
})

describe('transparent image chroma key removal', () => {
  it('removes disconnected green background islands between foreground strands', () => {
    const pixels = createImagePixels(5, 5, [0, 255, 0, 255])
    setPixel(pixels, 2, 0, 5, [180, 20, 20, 255])
    setPixel(pixels, 2, 1, 5, [185, 26, 20, 255])
    setPixel(pixels, 1, 2, 5, [176, 22, 18, 255])
    setPixel(pixels, 3, 2, 5, [176, 22, 18, 255])
    setPixel(pixels, 2, 3, 5, [185, 26, 20, 255])
    setPixel(pixels, 2, 4, 5, [180, 20, 20, 255])

    removeKeyedBackgroundFromPixels(pixels, 5, 5, GREEN_KEY_COLOR)

    expect(getPixel(pixels, 2, 2, 5)[3]).toBe(0)
    expect(getPixel(pixels, 0, 0, 5)[3]).toBe(0)
    expect(getPixel(pixels, 2, 1, 5)[3]).toBeGreaterThan(0)
    expect(getPixel(pixels, 2, 1, 5)[1]).toBeLessThan(80)
  })

  it('keeps green foreground opaque when magenta is the key color', () => {
    const pixels = createImagePixels(3, 3, [255, 0, 255, 255])
    setPixel(pixels, 1, 1, 3, [20, 190, 60, 255])

    removeKeyedBackgroundFromPixels(pixels, 3, 3, MAGENTA_KEY_COLOR)

    expect(getPixel(pixels, 0, 0, 3)[3]).toBe(0)
    expect(getPixel(pixels, 1, 1, 3)[3]).toBe(255)
    expect(getPixel(pixels, 1, 1, 3).slice(0, 3)).toEqual([20, 190, 60])
  })

  it('reduces green spill on semi-mixed red foreground edges', () => {
    const pixels = createImagePixels(3, 3, [0, 255, 0, 255])
    setPixel(pixels, 1, 1, 3, [95, 120, 15, 255])

    removeKeyedBackgroundFromPixels(pixels, 3, 3, GREEN_KEY_COLOR)

    const edge = getPixel(pixels, 1, 1, 3)
    expect(edge[3]).toBeGreaterThan(0)
    expect(edge[1]).toBeLessThan(80)
  })
})

function createImagePixels(width: number, height: number, rgba: [number, number, number, number]) {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let index = 0; index < width * height; index += 1) {
    pixels.set(rgba, index * 4)
  }
  return pixels
}

function setPixel(
  pixels: Uint8ClampedArray,
  x: number,
  y: number,
  width: number,
  rgba: [number, number, number, number],
) {
  pixels.set(rgba, (y * width + x) * 4)
}

function getPixel(pixels: Uint8ClampedArray, x: number, y: number, width: number) {
  return Array.from(pixels.slice((y * width + x) * 4, (y * width + x) * 4 + 4))
}
