export type WatermarkPosition = 'nw' | 'n' | 'ne' | 'w' | 'center' | 'e' | 'sw' | 's' | 'se'

/** 九宫格定位：返回 fillText 的锚点（textBaseline='top' 语义），x/y 距边 padding */
export function computeWatermarkPosition(
  position: WatermarkPosition,
  canvasW: number,
  canvasH: number,
  textW: number,
  textH: number,
  padding: number,
): { x: number; y: number } {
  const x = position.endsWith('w')
    ? padding
    : position.endsWith('e')
      ? canvasW - textW - padding
      : (canvasW - textW) / 2
  const y = position.startsWith('n')
    ? padding
    : position.startsWith('s')
      ? canvasH - textH - padding
      : (canvasH - textH) / 2
  return { x, y }
}
