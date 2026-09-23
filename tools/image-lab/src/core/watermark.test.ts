import { describe, expect, it } from 'vitest'
import { computeWatermarkPosition } from './watermark'

describe('computeWatermarkPosition', () => {
  it('center 水平垂直居中', () => {
    expect(computeWatermarkPosition('center', 800, 600, 200, 50, 16)).toEqual({ x: 300, y: 275 })
  })

  it('nw 贴左上角，留 padding', () => {
    expect(computeWatermarkPosition('nw', 800, 600, 200, 50, 16)).toEqual({ x: 16, y: 16 })
  })

  it('se 贴右下角', () => {
    expect(computeWatermarkPosition('se', 800, 600, 200, 50, 16)).toEqual({ x: 584, y: 534 })
  })

  it('n 水平居中、贴顶部（单字符方位没有东西语义）', () => {
    expect(computeWatermarkPosition('n', 800, 600, 200, 50, 16)).toEqual({ x: 300, y: 16 })
  })
})
