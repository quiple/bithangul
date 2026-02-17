import type {FontProject, PixelComponent} from '../types'

import {decomposeHangul} from '../hangul'

interface GenerationResult {
  // 11,172 chars * 32 bytes (16 rows * 2 bytes)
  buffer: ArrayBuffer
}

self.onmessage = (e: MessageEvent<FontProject>) => {
  const project = e.data
  const result = generateFont(project)
  ;(self as unknown as Worker).postMessage(result, [result.buffer]) // Transfer buffer
}

function generateFont(project: FontProject): GenerationResult {
  const TOTAL_SYLLABLES = 11172
  const BYTES_PER_CHAR = 32 // 16 rows * 2 bytes
  const buffer = new ArrayBuffer(TOTAL_SYLLABLES * BYTES_PER_CHAR)
  const view = new DataView(buffer)

  // Optimize components: flatten 2D array to 16x uint16
  const optimizedComponents = project.components.map((comp) => ({
    targets: comp.targets,
    bitmap: flattenBitmap(comp.bitmap),
  }))

  for (let i = 0; i < TOTAL_SYLLABLES; i++) {
    // Unicode value for Hangul Syllable starts at 0xAC00
    const charCode = 0xac00 + i
    const char = String.fromCharCode(charCode)
    const parts = decomposeHangul(char)

    if (!parts) continue

    const {cho, jung, jong} = parts

    // Start with empty bitmap (0)
    let matchedBitmap = new Uint16Array(16) // 16 rows of 0

    for (const comp of optimizedComponents) {
      // Check match
      const matchCho = comp.targets.chosung.includes(cho)
      const matchJung = comp.targets.jungsung.includes(jung)
      const matchJong = comp.targets.jongsung.includes(jong)

      if (matchCho && matchJung && matchJong) {
        // OR operation
        for (let r = 0; r < 16; r++) {
          matchedBitmap[r] |= comp.bitmap[r]
        }
      }
    }

    // Write to buffer (Big Endian for standard view?)
    // Let's use Big Endian so byte 0 is top-left 8 bits, byte 1 is top-right 8 bits?
    // 16x16: row 0 is 16 bits.
    // If row 0 is [1, 0, ..., 0], value is 0x8000.
    // DataView setUint16(..., val, false) -> Big Endian.
    const offset = i * BYTES_PER_CHAR
    for (let r = 0; r < 16; r++) {
      view.setUint16(offset + r * 2, matchedBitmap[r], false) // Big Endian
    }
  }

  return {buffer}
}

function flattenBitmap(bitmap: number[][]): Uint16Array {
  const arr = new Uint16Array(16)
  for (let r = 0; r < 16; r++) {
    let val = 0
    for (let c = 0; c < 16; c++) {
      if (bitmap[r][c]) {
        val |= 1 << (15 - c) // MSB at index 0
      }
    }
    arr[r] = val
  }
  return arr
}
