/**
 * 프로젝트 직렬화/역직렬화 유틸리티
 * bitmap 데이터를 hex 문자열로 변환하여 JSON 크기를 줄입니다.
 */
import type {ComponentType, FontProject, GroupsStructure, JamoGroup} from '#lib/types.js'

import {bitmapToHex, hexToBitmap} from '#lib/bitmap.js'
import {getConditionKey, sortComponents, sortGroups} from '#lib/component-utils.js'
import {getFontSettings} from '#lib/font-settings.js'
import {COMPONENT_INDICES, COMPONENT_TYPES, COMPONENT_TYPE_LABELS, JAMO_INDICES} from '#lib/hangul.js'

function sameItems(first: number[], second: number[]) {
  if (first.length !== second.length) return false
  const secondItems = new Set(second)
  return first.every((item) => secondItems.has(item))
}

function mergeVariationNames(first: string, second: string) {
  const firstParts = first.split(', ')
  const secondParts = second.split(', ')
  const commonParts = firstParts.filter((part) => secondParts.includes(part))
  const uniqueParts = [
    ...firstParts.filter((part) => !commonParts.includes(part)),
    ...secondParts.filter((part) => !commonParts.includes(part)),
  ]
  if (uniqueParts.length === 0) return first
  return commonParts.length > 0 ? [...uniqueParts, ...commonParts].join(', ') : `${first} / ${second}`
}

function mergeDuplicateVariations(data: any, groups: GroupsStructure) {
  const removedGroupIds = new Set<string>()

  for (const targetType of COMPONENT_TYPES) {
    const conditionTypes = COMPONENT_TYPES.filter((type) => type !== targetType)
    const expectedRows = COMPONENT_INDICES[targetType].length
    const componentsByGroup = new Map<string, any[]>()
    for (const group of groups[targetType]) componentsByGroup.set(group.id, [])
    for (const component of data.components || []) {
      if (component.type !== targetType) continue
      for (const groupId of Object.keys(component.conditions || {})) {
        if (component.conditions[groupId]) componentsByGroup.get(groupId)?.push(component)
      }
    }

    const bitmapSignatures = new Map<string, string>()
    for (const [groupId, components] of componentsByGroup) {
      if (components.length !== expectedRows) continue
      bitmapSignatures.set(
        groupId,
        [...components]
          .sort((first, second) => first.typeIndex - second.typeIndex)
          .map((component) => `${component.typeIndex}:${bitmapToHex(component.bitmap)}`)
          .join('|'),
      )
    }

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
                first.conditions[type] || [...JAMO_INDICES[type]],
                second.conditions[type] || [...JAMO_INDICES[type]],
              ),
          )
          if (differingTypes.length !== 1) continue

          const firstSignature = bitmapSignatures.get(first.id)
          if (!firstSignature || firstSignature !== bitmapSignatures.get(second.id)) continue

          const differingType = differingTypes[0]
          const firstItems = first.conditions[differingType] || JAMO_INDICES[differingType]
          const secondItems = second.conditions[differingType] || JAMO_INDICES[differingType]
          first.conditions[differingType] = [...new Set([...firstItems, ...secondItems])].sort((a, b) => a - b)
          first.name = mergeVariationNames(first.name, second.name)
          targetGroups.splice(secondIndex, 1)
          componentsByGroup.delete(second.id)
          bitmapSignatures.delete(second.id)
          removedGroupIds.add(second.id)
          merged = true
          break pairLoop
        }
      }
    }
  }

  if (removedGroupIds.size > 0) {
    data.components = (data.components || []).filter(
      (component: any) => !Object.keys(component.conditions || {}).some((groupId) => removedGroupIds.has(groupId)),
    )
  }
}

/** 기존 ‘조건 자모 그룹’ 프로젝트를 ‘컴포넌트 바리에이션 그룹’ 구조로 변환합니다. */
function migrateLegacyGroupModel(data: any) {
  if (data.groupModelVersion === 2) return

  const legacyGroups = (data.groups || {chosung: [], jungsung: [], jongsung: []}) as Record<
    ComponentType,
    Array<{id: string; name: string; items: number[]}>
  >
  const legacyGroupLookup = new Map<string, {type: ComponentType; name: string; items: number[]}>()
  for (const type of COMPONENT_TYPES) {
    for (const group of legacyGroups[type] || []) legacyGroupLookup.set(group.id, {type, ...group})
  }

  const groups: GroupsStructure = {chosung: [], jungsung: [], jongsung: []}
  const groupIdsByCondition = new Map<ComponentType, Map<string, string>>(
    COMPONENT_TYPES.map((type) => [type, new Map()]),
  )

  for (const component of data.components || []) {
    const targetType = component.type as ComponentType
    const conditionKey = getConditionKey(component.conditions || {})
    const existingGroupId = groupIdsByCondition.get(targetType)!.get(conditionKey)
    if (existingGroupId) {
      component.conditions = {[existingGroupId]: true}
      continue
    }

    const activeLegacyGroups = Object.keys(component.conditions || {})
      .filter((groupId) => component.conditions[groupId])
      .map((groupId) => legacyGroupLookup.get(groupId))
      .filter((group): group is NonNullable<typeof group> => Boolean(group))
    const activeGroupsByType = new Map<ComponentType, typeof activeLegacyGroups>(
      COMPONENT_TYPES.map((type) => [type, activeLegacyGroups.filter((group) => group.type === type)]),
    )
    const conditions: JamoGroup['conditions'] = {}
    for (const conditionType of COMPONENT_TYPES) {
      if (conditionType === targetType) continue
      conditions[conditionType] = JAMO_INDICES[conditionType].filter((index: number) =>
        activeGroupsByType.get(conditionType)!.every((group) => group.items.includes(index)),
      )
    }

    const groupId = `variation_${targetType}_${groups[targetType].length + 1}`
    groups[targetType].push({
      id: groupId,
      name: activeLegacyGroups.map((group) => group.name).join(', ') || `기본 ${COMPONENT_TYPE_LABELS[targetType]}`,
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
  const sortedGroups = sortGroups(proj.groups)
  const sortedComponents = sortComponents(proj.components, sortedGroups)

  return {
    name: proj.name,
    baseline: getFontSettings(proj).baseline,
    width: getFontSettings(proj).width,
    height: getFontSettings(proj).height,
    fontInfo: proj.fontInfo ? {...proj.fontInfo} : undefined,
    groupModelVersion: proj.groupModelVersion,
    groups: Object.fromEntries(
      COMPONENT_TYPES.map((type) => [
        type,
        sortedGroups[type].map((group) => ({
          id: group.id,
          name: group.name,
          splitOperationId: group.splitOperationId,
          conditions: Object.fromEntries(
            Object.entries(group.conditions).map(([conditionType, items]) => [
              conditionType,
              items ? [...items] : items,
            ]),
          ),
        })),
      ]),
    ),
    components: sortedComponents.map((component) => ({
      id: component.id,
      type: component.type,
      typeIndex: component.typeIndex,
      conditions: {...component.conditions},
      bitmap: bitmapToHex(component.bitmap),
    })),
    deletedComponentKeys: proj.deletedComponentKeys ? [...proj.deletedComponentKeys] : [],
  }
}

/**
 * JSON에서 읽어온 데이터를 FontProject로 역직렬화합니다.
 * hex 문자열 bitmap을 2D 배열로 복원하고, 레거시 targets 형식을 conditions로 마이그레이션합니다.
 */
export function deserializeProject(data: any): FontProject {
  const settings = getFontSettings(data)
  data.width = settings.width
  data.height = settings.height
  data.baseline = settings.baseline
  if (data.components) {
    for (const c of data.components) {
      if (typeof c.bitmap === 'string') {
        c.bitmap = hexToBitmap(c.bitmap, settings.width, settings.height)
      }

      // Legacy 'targets' migration to 'conditions' & 'groups'
      if ((c as any).targets && !c.conditions) {
        if (!data.groups) data.groups = {chosung: [], jungsung: [], jongsung: []}
        c.conditions = {}
        const targets = (c as any).targets
        for (const tType of COMPONENT_TYPES) {
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
  for (const type of COMPONENT_TYPES) {
    for (const group of data.groups[type]) {
      group.name =
        group.name
          .split(/\s*[·,]\s*/)
          .filter((part: string) => part && part !== '받침 없음')
          .join(', ') || `기본 ${COMPONENT_TYPE_LABELS[type]}`
    }
  }
  mergeDuplicateVariations(data, data.groups)
  data.groups = sortGroups(data.groups)
  data.components = sortComponents(data.components || [], data.groups)
  return data as FontProject
}
