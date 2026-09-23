import { describe, expect, it } from 'vitest'
import { computeTargetSize } from './resize'

describe('computeTargetSize', () => {
  it('mode none 原样返回', () => {
    expect(computeTargetSize(1000, 500, { mode: 'none', value: 1280 })).toEqual({ width: 1000, height: 500 })
  })

  it('按宽缩放保持纵横比', () => {
    expect(computeTargetSize(1000, 500, { mode: 'width', value: 800 })).toEqual({ width: 800, height: 400 })
  })

  it('按高缩放保持纵横比', () => {
    expect(computeTargetSize(1000, 500, { mode: 'height', value: 300 })).toEqual({ width: 600, height: 300 })
  })

  it('按百分比缩放', () => {
    expect(computeTargetSize(1000, 500, { mode: 'percent', value: 50 })).toEqual({ width: 500, height: 250 })
  })

  it('结果四舍五入', () => {
    expect(computeTargetSize(1000, 501, { mode: 'width', value: 333 })).toEqual({ width: 333, height: 167 })
  })

  it('极小值钳制到 1，避免 0 尺寸', () => {
    expect(computeTargetSize(100, 50, { mode: 'width', value: 0.4 })).toEqual({ width: 1, height: 1 })
  })
})
