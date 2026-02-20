import type {FontProject} from '../types'

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

  // ── 최적화 1: 비트맵을 Uint16Array로 평탄화 ──
  // ── 최적화 2: targets를 비트마스크로 전처리 (includes() O(n) → bitwise AND O(1)) ──
  const compCount = project.components.length
  const compBitmaps: Uint16Array[] = new Array(compCount)
  // 비트마스크: chosung 19비트, jungsung 21비트, jongsung 28비트 → 각각 Uint32 1개면 충분
  const compChoMask: Uint32Array = new Uint32Array(compCount)
  const compJungMask: Uint32Array = new Uint32Array(compCount)
  const compJongMask: Uint32Array = new Uint32Array(compCount)

  for (let ci = 0; ci < compCount; ci++) {
    const comp = project.components[ci]
    compBitmaps[ci] = flattenBitmap(comp.bitmap)

    // targets 배열 → 비트마스크
    let choMask = 0
    for (const idx of comp.targets.chosung) choMask |= 1 << idx
    compChoMask[ci] = choMask

    let jungMask = 0
    for (const idx of comp.targets.jungsung) jungMask |= 1 << idx
    compJungMask[ci] = jungMask

    let jongMask = 0
    for (const idx of comp.targets.jongsung) jongMask |= 1 << idx
    compJongMask[ci] = jongMask
  }

  // ── 글리프 합성 ──
  const result = new Uint16Array(16)

  for (let i = 0; i < TOTAL_SYLLABLES; i++) {
    // 한글 분해 인라인 (함수 호출 오버헤드 제거)
    const cho = (i / 588) | 0
    const jung = ((i % 588) / 28) | 0
    const jong = i % 28

    // 이 음절에 해당하는 비트마스크
    const choBit = 1 << cho
    const jungBit = 1 << jung
    const jongBit = 1 << jong

    // 결과 비트맵 초기화
    for (let r = 0; r < 16; r++) result[r] = 0

    for (let ci = 0; ci < compCount; ci++) {
      // 비트 AND로 매칭 확인 (O(1))
      if (compChoMask[ci] & choBit && compJungMask[ci] & jungBit && compJongMask[ci] & jongBit) {
        const bmp = compBitmaps[ci]
        for (let r = 0; r < 16; r++) {
          result[r] |= bmp[r]
        }
      }
    }

    // Big Endian으로 버퍼에 기록
    const offset = i * BYTES_PER_CHAR
    for (let r = 0; r < 16; r++) {
      view.setUint16(offset + r * 2, result[r], false)
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
