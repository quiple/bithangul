/**
 * BDF / HEX 내보내기를 메인 스레드 블로킹 없이 처리하는 Web Worker.
 * 11,172자 × 16행의 대용량 문자열 생성을 백그라운드에서 수행합니다.
 */

import {HANGUL_START_CODE_POINT, HANGUL_SYLLABLE_COUNT} from '../hangul'

interface ExportMessage {
  type: 'bdf' | 'hex'
  buffer: ArrayBuffer
  fontName?: string
}

self.onmessage = (e: MessageEvent<ExportMessage>) => {
  const {type, buffer, fontName} = e.data

  let result: string
  if (type === 'bdf') {
    result = exportBDF(buffer, fontName || 'bithangul')
  } else {
    result = exportHEX(buffer)
  }

  ;(self as unknown as Worker).postMessage({type, result})
}

// 공통 Hex 변환 유틸리티 (모듈 최상위에 한 번만 정의)
const HEX = '0123456789ABCDEF'
function toHex4(val: number): string {
  return HEX[(val >> 12) & 0xf] + HEX[(val >> 8) & 0xf] + HEX[(val >> 4) & 0xf] + HEX[val & 0xf]
}

function exportBDF(buffer: ArrayBuffer, fontName: string): string {
  const view = new DataView(buffer)
  const safeName = fontName.replace(/[^a-zA-Z0-9가-힣_-]/g, '_').toLowerCase()

  const lineCount = 12 + HANGUL_SYLLABLE_COUNT * 23
  const lines: string[] = Array.from({length: lineCount})
  let lineIdx = 0

  // ── 파일 헤더 ──
  lines[lineIdx++] = 'STARTFONT 2.1'
  lines[lineIdx++] = `FONT -misc-${safeName}-medium-r-normal--16-160-75-75-c-160-iso10646-1`
  lines[lineIdx++] = 'SIZE 16 75 75'
  lines[lineIdx++] = 'FONTBOUNDINGBOX 16 16 0 -2'
  lines[lineIdx++] = 'STARTPROPERTIES 4'
  lines[lineIdx++] = 'FONT_ASCENT 14'
  lines[lineIdx++] = 'FONT_DESCENT 2'
  lines[lineIdx++] = 'DEFAULT_CHAR 0'
  lines[lineIdx++] = 'CHARSET_REGISTRY "ISO10646"'
  lines[lineIdx++] = 'ENDPROPERTIES'
  lines[lineIdx++] = `CHARS ${HANGUL_SYLLABLE_COUNT}`

  for (let i = 0; i < HANGUL_SYLLABLE_COUNT; i++) {
    const codePoint = HANGUL_START_CODE_POINT + i
    const offset = i * 32

    lines[lineIdx++] = `STARTCHAR U+${toHex4(codePoint)}`
    lines[lineIdx++] = `ENCODING ${codePoint}`
    lines[lineIdx++] = 'SWIDTH 1000 0'
    lines[lineIdx++] = 'DWIDTH 16 0'
    lines[lineIdx++] = 'BBX 16 16 0 -2'
    lines[lineIdx++] = 'BITMAP'

    for (let r = 0; r < 16; r++) {
      const rowVal = view.getUint16(offset + r * 2, false)
      lines[lineIdx++] = toHex4(rowVal)
    }

    lines[lineIdx++] = 'ENDCHAR'
  }

  lines[lineIdx++] = 'ENDFONT'
  return lines.join('\n')
}

function exportHEX(buffer: ArrayBuffer): string {
  const view = new DataView(buffer)

  const lines: string[] = Array.from({length: HANGUL_SYLLABLE_COUNT})

  for (let i = 0; i < HANGUL_SYLLABLE_COUNT; i++) {
    const codePoint = HANGUL_START_CODE_POINT + i
    const offset = i * 32

    let hexBitmap = ''
    for (let r = 0; r < 16; r++) {
      const rowVal = view.getUint16(offset + r * 2, false)
      hexBitmap += toHex4(rowVal)
    }

    lines[i] = `${toHex4(codePoint)}:${hexBitmap}`
  }

  return lines.join('\n')
}
