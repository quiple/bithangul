/** 픽셀 편집기와 BDF 내보내기가 공유하는 수직 글꼴 메트릭입니다. */
export const FONT_ASCENT = 14
export const FONT_DESCENT = 2

export function normalizeBaseline(value: unknown, height = 16): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(height, Math.round(value)))
    : Math.min(FONT_ASCENT, height)
}
