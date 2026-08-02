/**
 * 비트맵 관련 공통 유틸리티 함수들
 */

/**
 * 16x16 2차원 비트맵 배열을 16-element Uint16Array로 플래튼합니다.
 * 각 행의 16비트를 하나의 uint16 값으로 팩킹합니다.
 */
function packBitmapRow(row: number[] | undefined) {
  let value = 0
  for (let column = 0; column < 16; column++) {
    if (row?.[column]) value |= 1 << (15 - column)
  }
  return value
}

export function flattenBitmap(bitmap: number[][]): Uint16Array {
  const arr = new Uint16Array(16)
  for (let row = 0; row < 16; row++) arr[row] = packBitmapRow(bitmap[row])
  return arr
}

/**
 * 16x16 비트맵을 64자의 hex 문자열로 직렬화합니다.
 */
export function bitmapToHex(bitmap: number[][]): string {
  let hex = ''
  for (let row = 0; row < 16; row++) hex += packBitmapRow(bitmap[row]).toString(16).padStart(4, '0')
  return hex
}

export function cloneBitmap(bitmap: number[][]) {
  return bitmap.map((row) => [...row])
}

/**
 * 64자의 hex 문자열을 16x16 비트맵 2차원 배열로 역직렬화합니다.
 */
export function hexToBitmap(hex: string): number[][] {
  const bitmap: number[][] = []
  for (let r = 0; r < 16; r++) {
    const val = parseInt(hex.substring(r * 4, r * 4 + 4), 16)
    const row: number[] = []
    for (let col = 0; col < 16; col++) {
      row.push((val >> (15 - col)) & 1)
    }
    bitmap.push(row)
  }
  return bitmap
}

/**
 * 빈 16x16 비트맵을 생성합니다.
 */
export function createEmptyBitmap(): number[][] {
  return Array.from({length: 16}, () => Array(16).fill(0))
}

/**
 * Canvas에서 CSS 변수로부터 border 색상을 읽어옵니다.
 */
export function getBorderColor(canvas: HTMLCanvasElement): string {
  const style = getComputedStyle(canvas)
  return style.getPropertyValue('--border-color').trim() || '#e5e5e5'
}
