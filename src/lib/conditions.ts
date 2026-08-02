/**
 * 조건 매칭 로직: 주어진 초/중/종성 인덱스가 컴포넌트의 conditions에 부합하는지 확인합니다.
 */
import type {ComponentType, GroupsStructure, JamoGroup} from '$lib/types'

import {COMPONENT_TYPES, HANGUL_SYLLABLE_COUNT, TYPE_COUNTS} from '$lib/hangul'

export type VariationGroupLookup = ReadonlyMap<string, {type: ComponentType; group: JamoGroup}>

export function createVariationGroupLookup(groups: GroupsStructure): VariationGroupLookup {
  const lookup = new Map<string, {type: ComponentType; group: JamoGroup}>()
  for (const type of COMPONENT_TYPES) {
    for (const group of groups[type]) lookup.set(group.id, {type, group})
  }
  return lookup
}

export function findVariationGroup(groups: GroupsStructure, groupId: string, lookup?: VariationGroupLookup) {
  if (lookup) return lookup.get(groupId) || null
  for (const type of COMPONENT_TYPES) {
    const group = groups[type].find((candidate) => candidate.id === groupId)
    if (group) return {type, group}
  }
  return null
}

export function checkVariationGroupMatch(cho: number, jung: number, jong: number, group: JamoGroup): boolean {
  const indices: Record<ComponentType, number> = {chosung: cho, jungsung: jung, jongsung: jong}
  return COMPONENT_TYPES.every((type) => {
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
  lookup?: VariationGroupLookup,
): boolean {
  for (const [groupId, expected] of Object.entries(conditions)) {
    const found = findVariationGroup(groups, groupId, lookup)
    const isIncluded = found ? checkVariationGroupMatch(cho, jung, jong, found.group) : false

    if (isIncluded !== expected) return false
  }
  return true
}

/** 겹치는 바리에이션 중 더 좁은 조합 범위를 우선하기 위한 점수입니다. */
export function getConditionSpecificity(
  conditions: Record<string, boolean>,
  groups: GroupsStructure,
  lookup?: VariationGroupLookup,
): number {
  let best = 0
  for (const [groupId, expected] of Object.entries(conditions)) {
    if (!expected) continue
    const found = findVariationGroup(groups, groupId, lookup)
    if (!found) continue

    let coverage = 1
    for (const type of COMPONENT_TYPES) {
      if (type === found.type) continue
      coverage *= found.group.conditions[type]?.length ?? TYPE_COUNTS[type]
    }
    best = Math.max(best, HANGUL_SYLLABLE_COUNT - coverage)
  }
  return best
}
