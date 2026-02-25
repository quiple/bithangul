/**
 * 조건 매칭 로직: 주어진 초/중/종성 인덱스가 컴포넌트의 conditions에 부합하는지 확인합니다.
 */
import type {GroupsStructure} from '$lib/types'

/**
 * 주어진 음절의 초/중/종성 인덱스가 conditions 맵과 일치하는지 확인합니다.
 * Preview, ComponentPreviewGrid 등에서 공통으로 사용됩니다.
 */
export function checkConditionMatch(
  cho: number,
  jung: number,
  jong: number,
  conditions: Record<string, boolean>,
  groups: GroupsStructure,
): boolean {
  for (const [groupId, expected] of Object.entries(conditions)) {
    let isIncluded = false

    const gCho = groups.chosung.find((g) => g.id === groupId)
    if (gCho) {
      isIncluded = gCho.items.includes(cho)
    } else {
      const gJung = groups.jungsung.find((g) => g.id === groupId)
      if (gJung) {
        isIncluded = gJung.items.includes(jung)
      } else {
        const gJong = groups.jongsung.find((g) => g.id === groupId)
        if (gJong) {
          isIncluded = gJong.items.includes(jong)
        }
      }
    }

    if (isIncluded !== expected) return false
  }
  return true
}
