/** Rows are byte-aligned, most significant bit first (also used by BDF). */
export function bytesPerRow(width: number) {
  return Math.ceil(width / 8)
}

export function flattenBitmap(bitmap: number[][], width = bitmap[0]?.length ?? 16, height = bitmap.length): Uint8Array {
  const stride = bytesPerRow(width)
  const packed = new Uint8Array(stride * height)
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (bitmap[r]?.[c]) packed[r * stride + (c >> 3)] |= 0x80 >> (c & 7)
    }
  }
  return packed
}

export function packedPixel(data: Uint8Array, width: number, row: number, column: number, offset = 0) {
  return (data[offset + row * bytesPerRow(width) + (column >> 3)] & (0x80 >> (column & 7))) !== 0
}

export function bitmapToHex(bitmap: number[][]): string {
  return Array.from(flattenBitmap(bitmap), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function cloneBitmap(bitmap: number[][]) {
  return bitmap.map((row) => [...row])
}

export function hexToBitmap(hex: string, width = 16, height = 16): number[][] {
  const expected = bytesPerRow(width) * height * 2
  if (hex.length !== expected || !/^[0-9a-f]+$/i.test(hex))
    throw new Error('픽셀 크기와 비트맵 데이터가 일치하지 않습니다.')
  const bytes = Uint8Array.from(hex.match(/../g)!, (byte) => parseInt(byte, 16))
  return Array.from({length: height}, (_, r) => Array.from({length: width}, (_, c) => +packedPixel(bytes, width, r, c)))
}

export function createEmptyBitmap(width = 16, height = 16): number[][] {
  return Array.from({length: height}, () => Array(width).fill(0))
}

export function resizeBitmap(bitmap: number[][], width: number, height: number): number[][] {
  return Array.from({length: height}, (_, r) => Array.from({length: width}, (_, c) => (bitmap[r]?.[c] ? 1 : 0)))
}
