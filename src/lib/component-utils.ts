import type {ComponentType, GroupsStructure, JamoGroup, PixelComponent} from '#lib/types.js'

import {COMPONENT_TYPES, JAMO_INDICES} from '#lib/hangul.js'

/** 컴포넌트 종류별 바리에이션 조건 정렬 우선순위입니다. */
export const VARIATION_CONDITION_ORDER: Record<ComponentType, readonly ComponentType[]> = {
  chosung: ['jongsung', 'jungsung'],
  jungsung: ['jongsung', 'chosung'],
  jongsung: ['jungsung', 'chosung'],
}

const COMPONENT_TYPE_ORDER = new Map(COMPONENT_TYPES.map((type, index) => [type, index]))

function compareIndexLists(first: readonly number[], second: readonly number[]) {
  const comparableLength = Math.min(first.length, second.length)
  for (let index = 0; index < comparableLength; index++) {
    if (first[index] !== second[index]) return first[index] - second[index]
  }
  return first.length - second.length
}

function getSortedConditionItems(group: JamoGroup, conditionType: ComponentType) {
  const items = group.conditions[conditionType]
  return items ? [...items].sort((first, second) => first - second) : JAMO_INDICES[conditionType]
}

export function compareVariationGroups(type: ComponentType, first: JamoGroup, second: JamoGroup) {
  for (const conditionType of VARIATION_CONDITION_ORDER[type]) {
    const result = compareIndexLists(
      getSortedConditionItems(first, conditionType),
      getSortedConditionItems(second, conditionType),
    )
    if (result !== 0) return result
  }
  return 0
}

export function sortVariationGroups(type: ComponentType, groups: readonly JamoGroup[]) {
  return [...groups].sort((first, second) => compareVariationGroups(type, first, second))
}

export function sortGroups(groups: GroupsStructure): GroupsStructure {
  return {
    chosung: sortVariationGroups('chosung', groups.chosung),
    jungsung: sortVariationGroups('jungsung', groups.jungsung),
    jongsung: sortVariationGroups('jongsung', groups.jongsung),
  }
}

export function getActiveVariationId(component: Pick<PixelComponent, 'conditions'>) {
  return Object.keys(component.conditions || {}).find((groupId) => component.conditions[groupId])
}

export function getConditionKey(conditions: Record<string, boolean>) {
  return Object.keys(conditions || {})
    .filter((groupId) => conditions[groupId])
    .sort()
    .join(',')
}

export function getComponentKey(component: Pick<PixelComponent, 'type' | 'typeIndex' | 'conditions'>) {
  return `${component.type}:${component.typeIndex}:${getConditionKey(component.conditions)}`
}

/** 타입 → 자모 → 바리에이션 조건 순서로 컴포넌트를 정렬합니다. */
export function sortComponents(components: readonly PixelComponent[], groups: GroupsStructure) {
  const variationRanks = new Map<string, number>()
  for (const type of COMPONENT_TYPES) {
    sortVariationGroups(type, groups[type]).forEach((group, index) => {
      variationRanks.set(`${type}:${group.id}`, index)
    })
  }

  return [...components].sort((first, second) => {
    const typeDifference = COMPONENT_TYPE_ORDER.get(first.type)! - COMPONENT_TYPE_ORDER.get(second.type)!
    if (typeDifference !== 0) return typeDifference

    const indexDifference = first.typeIndex - second.typeIndex
    if (indexDifference !== 0) return indexDifference

    const firstRank =
      variationRanks.get(`${first.type}:${getActiveVariationId(first) || ''}`) ?? Number.MAX_SAFE_INTEGER
    const secondRank =
      variationRanks.get(`${second.type}:${getActiveVariationId(second) || ''}`) ?? Number.MAX_SAFE_INTEGER
    return firstRank - secondRank
  })
}
