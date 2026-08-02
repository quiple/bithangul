import type {ComponentType} from '$lib/types'

export const CHOSUNG_COUNT = 19
export const JUNGSUNG_COUNT = 21
export const JONGSUNG_COUNT = 28
export const HANGUL_START_CODE_POINT = 0xac00
export const SYLLABLES_PER_CHOSUNG = JUNGSUNG_COUNT * JONGSUNG_COUNT
export const HANGUL_SYLLABLE_COUNT = CHOSUNG_COUNT * JUNGSUNG_COUNT * JONGSUNG_COUNT

export const CHOSUNG = [
  'ㄱ',
  'ㄲ',
  'ㄴ',
  'ㄷ',
  'ㄸ',
  'ㄹ',
  'ㅁ',
  'ㅂ',
  'ㅃ',
  'ㅅ',
  'ㅆ',
  'ㅇ',
  'ㅈ',
  'ㅉ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ',
]

export const JUNGSUNG = [
  'ㅏ',
  'ㅐ',
  'ㅑ',
  'ㅒ',
  'ㅓ',
  'ㅔ',
  'ㅕ',
  'ㅖ',
  'ㅗ',
  'ㅘ',
  'ㅙ',
  'ㅚ',
  'ㅛ',
  'ㅜ',
  'ㅝ',
  'ㅞ',
  'ㅟ',
  'ㅠ',
  'ㅡ',
  'ㅢ',
  'ㅣ',
]

export const JONGSUNG = [
  '',
  'ㄱ',
  'ㄲ',
  'ㄳ',
  'ㄴ',
  'ㄵ',
  'ㄶ',
  'ㄷ',
  'ㄹ',
  'ㄺ',
  'ㄻ',
  'ㄼ',
  'ㄽ',
  'ㄾ',
  'ㄿ',
  'ㅀ',
  'ㅁ',
  'ㅂ',
  'ㅄ',
  'ㅅ',
  'ㅆ',
  'ㅇ',
  'ㅈ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ',
] // Note: empty string for no jongsung (index 0)

export const COMPONENT_TYPES: readonly ComponentType[] = ['chosung', 'jungsung', 'jongsung']

export const COMPONENT_TYPE_LABELS: Record<ComponentType, string> = {
  chosung: '초성',
  jungsung: '중성',
  jongsung: '종성',
}

export const JAMO_BY_TYPE: Record<ComponentType, readonly string[]> = {
  chosung: CHOSUNG,
  jungsung: JUNGSUNG,
  jongsung: JONGSUNG,
}

/** 조합 조건에는 종성 없음(0)이 포함되므로 전체 자모 인덱스 범위를 사용합니다. */
export const JAMO_INDICES: Record<ComponentType, readonly number[]> = {
  chosung: Array.from({length: CHOSUNG_COUNT}, (_, index) => index),
  jungsung: Array.from({length: JUNGSUNG_COUNT}, (_, index) => index),
  jongsung: Array.from({length: JONGSUNG_COUNT}, (_, index) => index),
}

/** 실제 편집 컴포넌트에는 종성 없음(0)이 존재하지 않습니다. */
export const COMPONENT_INDICES: Record<ComponentType, readonly number[]> = {
  chosung: JAMO_INDICES.chosung,
  jungsung: JAMO_INDICES.jungsung,
  jongsung: JAMO_INDICES.jongsung.slice(1),
}

export const TYPE_COUNTS: Record<ComponentType, number> = {
  chosung: CHOSUNG_COUNT,
  jungsung: JUNGSUNG_COUNT,
  jongsung: JONGSUNG_COUNT,
}

export function getJamoLabel(type: ComponentType, index: number, emptyJongsungLabel = '') {
  return type === 'jongsung' && index === 0 ? emptyJongsungLabel : JAMO_BY_TYPE[type][index]
}

export function decomposeHangul(char: string) {
  const code = char.charCodeAt(0)
  if (code < HANGUL_START_CODE_POINT || code >= HANGUL_START_CODE_POINT + HANGUL_SYLLABLE_COUNT) {
    return null
  }
  const s = code - HANGUL_START_CODE_POINT
  const cho = Math.floor(s / SYLLABLES_PER_CHOSUNG)
  const jung = Math.floor((s % SYLLABLES_PER_CHOSUNG) / JONGSUNG_COUNT)
  const jong = s % JONGSUNG_COUNT
  return {cho, jung, jong}
}

export function composeHangul(cho: number, jung: number, jong: number) {
  return String.fromCharCode(HANGUL_START_CODE_POINT + cho * SYLLABLES_PER_CHOSUNG + jung * JONGSUNG_COUNT + jong)
}
