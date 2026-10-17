import type {FontSettings} from './font-settings'

import {bytesPerRow, packedPixel} from './bitmap'
import {HANGUL_START_CODE_POINT, HANGUL_SYLLABLE_COUNT} from './hangul'

export type FontExportType = 'bdf' | 'hex' | 'glyphs'
const hex = (value: number, digits = 4) => value.toString(16).toUpperCase().padStart(digits, '0')
const bytesHex = (bytes: Uint8Array) => Array.from(bytes, (byte) => hex(byte, 2)).join('')
const bdfString = (text: string) => `"${text.replace(/[\r\n\0]/g, ' ').replaceAll('"', '""')}"`

function validateBuffer(buffer: ArrayBuffer, settings: FontSettings) {
  const size = bytesPerRow(settings.width) * settings.height * HANGUL_SYLLABLE_COUNT
  if (buffer.byteLength !== size) throw new Error('글꼴 크기가 변경되었습니다. 미리보기 생성 후 다시 내보내 주세요.')
  return new Uint8Array(buffer)
}

export function exportBDF(buffer: ArrayBuffer, settings: FontSettings) {
  const data = validateBuffer(buffer, settings)
  const {width, height, baseline, name, copyright} = settings
  const rowBytes = bytesPerRow(width)
  const stride = rowBytes * height
  const descent = height - baseline
  const safeName = name.replace(/[^a-zA-Z0-9가-힣_]/g, '_').toLowerCase()
  const properties = [
    `FONT_ASCENT ${baseline}`,
    `FONT_DESCENT ${descent}`,
    'CHARSET_REGISTRY "ISO10646"',
    'CHARSET_ENCODING "1"',
    `FAMILY_NAME ${bdfString(name)}`,
    `FACE_NAME ${bdfString(settings.styleName)}`,
  ]
  if (copyright) properties.push(`COPYRIGHT ${bdfString(copyright)}`)
  const lines = [
    'STARTFONT 2.1',
    `FONT -misc-${safeName}-medium-r-normal--${height}-${height * 10}-75-75-c-${width * 10}-iso10646-1`,
    `SIZE ${height} 75 75`,
    `FONTBOUNDINGBOX ${width} ${height} 0 ${-descent}`,
    `STARTPROPERTIES ${properties.length}`,
    ...properties,
    'ENDPROPERTIES',
    `CHARS ${HANGUL_SYLLABLE_COUNT}`,
  ]
  for (let i = 0; i < HANGUL_SYLLABLE_COUNT; i++) {
    const code = HANGUL_START_CODE_POINT + i
    lines.push(
      `STARTCHAR U+${hex(code)}`,
      `ENCODING ${code}`,
      `SWIDTH ${Math.round((width / height) * 1000)} 0`,
      `DWIDTH ${width} 0`,
      `BBX ${width} ${height} 0 ${-descent}`,
      'BITMAP',
    )
    for (let row = 0; row < height; row++) {
      const start = i * stride + row * rowBytes
      lines.push(bytesHex(data.subarray(start, start + rowBytes)))
    }
    lines.push('ENDCHAR')
  }
  lines.push('ENDFONT')
  return lines.join('\n')
}

export function canExportHEX(settings: Pick<FontSettings, 'width' | 'height'>) {
  return settings.height === 16 && (settings.width === 8 || settings.width === 16)
}

export function exportHEX(buffer: ArrayBuffer, settings: FontSettings) {
  if (!canExportHEX(settings)) throw new Error('GNU Unifont HEX는 8×16 또는 16×16 픽셀에서 지원합니다.')
  const data = validateBuffer(buffer, settings)
  const stride = bytesPerRow(settings.width) * settings.height
  return Array.from(
    {length: HANGUL_SYLLABLE_COUNT},
    (_, i) => `${hex(HANGUL_START_CODE_POINT + i)}:${bytesHex(data.subarray(i * stride, (i + 1) * stride))}`,
  ).join('\n')
}

// Glyphs 3 uses OpenStep property lists; Unicode strings remain UTF-8.
function plist(value: unknown): string {
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return JSON.stringify(value).replace(/\\u([0-9a-f]{4})/gi, '\\U$1')
  if (Array.isArray(value)) return `(\n${value.map(plist).join(',\n')}\n)`
  if (value && typeof value === 'object') {
    return `{\n${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${plist(key)} = ${plist(entry)};`)
      .join('\n')}\n}`
  }
  throw new Error('지원하지 않는 Glyphs 데이터입니다.')
}

export function exportGlyphs(buffer: ArrayBuffer, settings: FontSettings) {
  const data = validateBuffer(buffer, settings)
  const {width, height, baseline, pixelSize, unitsPerEm, styleName} = settings
  const stride = bytesPerRow(width) * height
  const masterId = 'BITHANGUL-REGULAR'
  const advance = width * pixelSize
  const layer = (shapes: unknown[], glyphWidth = advance) => ({layerId: masterId, shapes, width: glyphWidth})
  const pixelShape = {
    closed: 1,
    nodes: [
      [0, 0, 'l'],
      [0, pixelSize, 'l'],
      [pixelSize, pixelSize, 'l'],
      [pixelSize, 0, 'l'],
    ],
  }
  const glyphs: unknown[] = [
    {glyphname: '.notdef', layers: [layer([])]},
    {glyphname: 'space', unicode: 32, layers: [layer([])]},
    {glyphname: 'pixel', export: 0, layers: [layer([pixelShape], pixelSize)]},
  ]
  for (let i = 0; i < HANGUL_SYLLABLE_COUNT; i++) {
    const code = HANGUL_START_CODE_POINT + i
    const shapes = []
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        if (packedPixel(data, width, row, col, i * stride)) {
          shapes.push({ref: 'pixel', alignment: -1, pos: [col * pixelSize, (baseline - row - 1) * pixelSize]})
        }
      }
    }
    glyphs.push({
      glyphname: `uni${hex(code)}`,
      unicode: code,
      script: 'hangul',
      category: 'Letter',
      layers: [layer(shapes)],
    })
  }
  const properties: unknown[] = []
  const localized = {
    designer: 'designers',
    manufacturer: 'manufacturers',
    copyright: 'copyrights',
    license: 'licenses',
    description: 'descriptions',
  } as const
  for (const [field, key] of Object.entries(localized)) {
    const value = settings[field as keyof typeof localized]
    if (value) properties.push({key, values: [{language: 'dflt', value}]})
  }
  for (const key of ['designerURL', 'manufacturerURL', 'licenseURL'] as const) {
    if (settings[key]) properties.push({key, value: settings[key]})
  }
  return plist({
    '.appVersion': '3335',
    '.formatVersion': 3,
    familyName: settings.name,
    unitsPerEm,
    versionMajor: settings.versionMajor,
    versionMinor: settings.versionMinor,
    axes: [{name: 'Weight', tag: 'wght'}],
    fontMaster: [
      {
        id: masterId,
        name: styleName,
        axesValues: [100],
        metricValues: [
          {pos: baseline * pixelSize},
          {pos: baseline * pixelSize},
          {pos: Math.round(baseline * 0.7) * pixelSize},
          {pos: (baseline - height) * pixelSize},
        ],
      },
    ],
    metrics: [{type: 'ascender'}, {type: 'cap height'}, {type: 'x-height'}, {type: 'descender'}],
    glyphs,
    properties,
    instances: [{name: styleName, axesValues: [100], exports: 1}],
    settings: {gridLength: pixelSize, gridSubDivision: 1, disablesAutomaticAlignment: 1, disablesNiceNames: 1},
    userData: {
      'com.bithangul.gridWidth': width,
      'com.bithangul.gridHeight': height,
      'com.bithangul.baseline': baseline,
    },
  })
}
