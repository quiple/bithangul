/**
 * 프로젝트 직렬화/역직렬화 유틸리티
 * bitmap 데이터를 hex 문자열로 변환하여 JSON 크기를 줄입니다.
 */
import type {ComponentType, FontProject, GroupsStructure, JamoGroup} from '$lib/types'

import {bitmapToHex, hexToBitmap} from '$lib/bitmap'
import {CHOSUNG_COUNT, JUNGSUNG_COUNT, JONGSUNG_COUNT} from '$lib/hangul'

const TYPES: ComponentType[] = ['chosung', 'jungsung', 'jongsung']
const TYPE_COUNTS: Record<ComponentType, number> = {
  chosung: CHOSUNG_COUNT,
  jungsung: JUNGSUNG_COUNT,
  jongsung: JONGSUNG_COUNT,
}
const TYPE_LABELS: Record<ComponentType, string> = {chosung: '초성', jungsung: '중성', jongsung: '종성'}

function sameItems(first: number[], second: number[]) {
  return first.length === second.length && first.every((item, index) => item === second[index])
}

function mergeVariationNames(first: string, second: string) {
  const firstParts = first.split(' · ')
  const secondParts = second.split(' · ')
  const commonParts = firstParts.filter((part) => secondParts.includes(part))
  const uniqueParts = [
    ...firstParts.filter((part) => !commonParts.includes(part)),
    ...secondParts.filter((part) => !commonParts.includes(part)),
  ]
  if (uniqueParts.length === 0) return first
  return commonParts.length > 0 ? `${uniqueParts.join('·')} · ${commonParts.join(' · ')}` : `${first} / ${second}`
}

function mergeDuplicateVariations(data: any, groups: GroupsStructure) {
  for (const targetType of TYPES) {
    const conditionTypes = TYPES.filter((type) => type !== targetType)
    const expectedRows = targetType === 'jongsung' ? JONGSUNG_COUNT - 1 : TYPE_COUNTS[targetType]
    let merged = true

    while (merged) {
      merged = false
      const targetGroups = groups[targetType]

      pairLoop: for (let firstIndex = 0; firstIndex < targetGroups.length; firstIndex++) {
        for (let secondIndex = firstIndex + 1; secondIndex < targetGroups.length; secondIndex++) {
          const first = targetGroups[firstIndex]
          const second = targetGroups[secondIndex]
          const differingTypes = conditionTypes.filter(
            (type) =>
              !sameItems(
                first.conditions[type] || Array.from({length: TYPE_COUNTS[type]}, (_, index) => index),
                second.conditions[type] || Array.from({length: TYPE_COUNTS[type]}, (_, index) => index),
              ),
          )
          if (differingTypes.length !== 1) continue

          const firstComponents = (data.components || []).filter(
            (component: any) => component.type === targetType && component.conditions[first.id],
          )
          const secondComponents = (data.components || []).filter(
            (component: any) => component.type === targetType && component.conditions[second.id],
          )
          if (firstComponents.length !== expectedRows || secondComponents.length !== expectedRows) continue

          const secondByRow = new Map(secondComponents.map((component: any) => [component.typeIndex, component]))
          const hasSameBitmaps = firstComponents.every((component: any) => {
            const other = secondByRow.get(component.typeIndex) as any
            return other && JSON.stringify(component.bitmap) === JSON.stringify(other.bitmap)
          })
          if (!hasSameBitmaps) continue

          const differingType = differingTypes[0]
          const firstItems =
            first.conditions[differingType] || Array.from({length: TYPE_COUNTS[differingType]}, (_, index) => index)
          const secondItems =
            second.conditions[differingType] || Array.from({length: TYPE_COUNTS[differingType]}, (_, index) => index)
          first.conditions[differingType] = [...new Set([...firstItems, ...secondItems])].sort((a, b) => a - b)
          first.name = mergeVariationNames(first.name, second.name)
          groups[targetType] = targetGroups.filter((group) => group.id !== second.id)
          data.components = data.components.filter(
            (component: any) => !(component.type === targetType && component.conditions[second.id]),
          )
          merged = true
          break pairLoop
        }
      }
    }
  }
}

function getLegacyConditionKey(conditions: Record<string, boolean>) {
  return Object.keys(conditions || {})
    .filter((groupId) => conditions[groupId])
    .sort()
    .join(',')
}

/** 기존 ‘조건 자모 그룹’ 프로젝트를 ‘컴포넌트 바리에이션 그룹’ 구조로 변환합니다. */
function migrateLegacyGroupModel(data: any) {
  if (data.groupModelVersion === 2) return

  const legacyGroups = (data.groups || {chosung: [], jungsung: [], jongsung: []}) as Record<
    ComponentType,
    Array<{id: string; name: string; items: number[]}>
  >
  const legacyGroupLookup = new Map<string, {type: ComponentType; name: string; items: number[]}>()
  for (const type of TYPES) {
    for (const group of legacyGroups[type] || []) legacyGroupLookup.set(group.id, {type, ...group})
  }

  const groups: GroupsStructure = {chosung: [], jungsung: [], jongsung: []}
  const groupIdsByCondition = new Map<ComponentType, Map<string, string>>(TYPES.map((type) => [type, new Map()]))

  for (const component of data.components || []) {
    const targetType = component.type as ComponentType
    const conditionKey = getLegacyConditionKey(component.conditions || {})
    const existingGroupId = groupIdsByCondition.get(targetType)!.get(conditionKey)
    if (existingGroupId) {
      component.conditions = {[existingGroupId]: true}
      continue
    }

    const activeLegacyGroups = Object.keys(component.conditions || {})
      .filter((groupId) => component.conditions[groupId])
      .map((groupId) => legacyGroupLookup.get(groupId))
      .filter((group): group is NonNullable<typeof group> => Boolean(group))
    const conditions: JamoGroup['conditions'] = {}
    for (const conditionType of TYPES) {
      if (conditionType === targetType) continue
      conditions[conditionType] = Array.from({length: TYPE_COUNTS[conditionType]}, (_, index) => index).filter(
        (index) =>
          activeLegacyGroups
            .filter((group) => group.type === conditionType)
            .every((group) => group.items.includes(index)),
      )
    }

    const groupId = `variation_${targetType}_${groups[targetType].length + 1}`
    groups[targetType].push({
      id: groupId,
      name: activeLegacyGroups.map((group) => group.name).join(' · ') || `기본 ${TYPE_LABELS[targetType]}`,
      conditions,
    })
    groupIdsByCondition.get(targetType)!.set(conditionKey, groupId)
    component.conditions = {[groupId]: true}
  }

  data.groupModelVersion = 2
  data.groups = groups
  data.deletedComponentKeys = []
}

/**
 * FontProject를 JSON-직렬화 가능한 형태로 변환합니다.
 * 2D 배열 bitmap을 hex 문자열로 압축합니다.
 */
export function serializeProject(proj: FontProject): any {
  const clone = structuredClone(proj) as any
  for (const c of clone.components) {
    if (Array.isArray(c.bitmap)) {
      c.bitmap = bitmapToHex(c.bitmap)
    }
  }
  return clone
}

/**
 * JSON에서 읽어온 데이터를 FontProject로 역직렬화합니다.
 * hex 문자열 bitmap을 2D 배열로 복원하고, 레거시 targets 형식을 conditions로 마이그레이션합니다.
 */
export function deserializeProject(data: any): FontProject {
  if (data.components) {
    for (const c of data.components) {
      if (typeof c.bitmap === 'string') {
        c.bitmap = hexToBitmap(c.bitmap)
      }

      // Legacy 'targets' migration to 'conditions' & 'groups'
      if ((c as any).targets && !c.conditions) {
        if (!data.groups) data.groups = {chosung: [], jungsung: [], jongsung: []}
        c.conditions = {}
        const targets = (c as any).targets
        for (const tType of ['chosung', 'jungsung', 'jongsung'] as const) {
          if (tType === c.type) continue
          if (targets[tType] && targets[tType].length > 0) {
            const itemsArr = [...targets[tType]].sort((a: number, b: number) => a - b)
            // Exclude the 'no_jongsung' scenario if it's [0] for jongsung
            if (tType === 'jongsung' && itemsArr.length === 1 && itemsArr[0] === 0) {
              c.conditions['no_jongsung'] = true
            } else {
              const str = itemsArr.join(',')
              let existingPattern = data.groups[tType].find(
                (g: any) => [...g.items].sort((a: number, b: number) => a - b).join(',') === str,
              )
              if (!existingPattern) {
                existingPattern = {
                  id: crypto.randomUUID(),
                  name: `Group ${data.groups[tType].length + 1}`,
                  items: itemsArr,
                }
                data.groups[tType].push(existingPattern)
              }
              c.conditions[existingPattern.id] = true
            }
          }
        }
      }
    }
  }
  migrateLegacyGroupModel(data)
  mergeDuplicateVariations(data, data.groups)
  return data as FontProject
}
