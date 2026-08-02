/**
 * 조건 매칭 로직: 주어진 초/중/종성 인덱스가 컴포넌트의 conditions에 부합하는지 확인합니다.
 */
import type {ComponentType, GroupsStructure, JamoGroup} from '$lib/types'

import {CHOSUNG_COUNT, JUNGSUNG_COUNT, JONGSUNG_COUNT} from '$lib/hangul'

const TYPES: ComponentType[] = ['chosung', 'jungsung', 'jongsung']
const TYPE_COUNTS: Record<ComponentType, number> = {
  chosung: CHOSUNG_COUNT,
  jungsung: JUNGSUNG_COUNT,
  jongsung: JONGSUNG_COUNT,
}

export function findVariationGroup(groups: GroupsStructure, groupId: string) {
  for (const type of TYPES) {
    const group = groups[type].find((candidate) => candidate.id === groupId)
    if (group) return {type, group}
  }
  return null
}

export function checkVariationGroupMatch(cho: number, jung: number, jong: number, group: JamoGroup): boolean {
  const indices: Record<ComponentType, number> = {chosung: cho, jungsung: jung, jongsung: jong}
  return TYPES.every((type) => {
    const selectedItems = group.conditions[type]
    return !selectedItems || selectedItems.includes(indices[type])
  })
}

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
    const found = findVariationGroup(groups, groupId)
    const isIncluded = found ? checkVariationGroupMatch(cho, jung, jong, found.group) : false

    if (isIncluded !== expected) return false
  }
  return true
}

/** 겹치는 바리에이션 중 더 좁은 조합 범위를 우선하기 위한 점수입니다. */
export function getConditionSpecificity(conditions: Record<string, boolean>, groups: GroupsStructure): number {
  let best = 0
  for (const [groupId, expected] of Object.entries(conditions)) {
    if (!expected) continue
    const found = findVariationGroup(groups, groupId)
    if (!found) continue

    let coverage = 1
    for (const type of TYPES) {
      if (type === found.type) continue
      coverage *= found.group.conditions[type]?.length ?? TYPE_COUNTS[type]
    }
    best = Math.max(best, CHOSUNG_COUNT * JUNGSUNG_COUNT * JONGSUNG_COUNT - coverage)
  }
  return best
}
