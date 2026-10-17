import type {FontProject, PixelComponent, ComponentType, JamoGroup} from '#lib/types.js'

import {cloneBitmap, createEmptyBitmap} from '#lib/bitmap.js'
import {getActiveVariationId, getComponentKey, sortGroups, sortVariationGroups} from '#lib/component-utils.js'
import {COMPONENT_INDICES, COMPONENT_TYPES, JAMO_INDICES} from '#lib/hangul.js'
import {getVariationGroupName} from '#lib/variation-utils.js'

class ProjectState {
  project = $state<FontProject>({
    name: 'My Font',
    groupModelVersion: 2,
    groups: {
      chosung: [{id: 'default_chosung', name: '기본 초성', conditions: {}}],
      jungsung: [{id: 'default_jungsung', name: '기본 중성', conditions: {}}],
      jongsung: [{id: 'default_jongsung', name: '기본 종성', conditions: {}}],
    },
    components: [],
    deletedComponentKeys: [],
  })

  selectedComponentId = $state<string | null>(null)

  private componentById = new Map<string, PixelComponent>()
  private componentIndexById = new Map<string, number>()
  private componentRevision = $state(0)

  get selectedComponent() {
    void this.componentRevision
    return this.selectedComponentId ? this.componentById.get(this.selectedComponentId) : undefined
  }

  selectComponent(id: string | null) {
    this.selectedComponentId = id
  }

  updateComponent(id: string, updated: PixelComponent) {
    const index = this.componentIndexById.get(id)
    if (index === undefined) return

    const previous = this.project.components[index]
    this.project.components[index] = updated
    const next = this.project.components[index]
    this.componentById.set(id, next)

    if (previous.type === next.type && previous.typeIndex === next.typeIndex) {
      this.componentRevision++
    } else {
      this.rebuildComponentIndex()
    }
  }

  splitComponent(id: string, selections: Partial<Record<ComponentType, number[]>>, customName?: string) {
    const source = this.componentById.get(id)
    if (!source) return null

    const sourceGroupId = getActiveVariationId(source)
    const groups = this.project.groups[source.type]
    const sourceGroup = groups.find((group) => group.id === sourceGroupId)
    if (!sourceGroup) return null

    const conditionTypes = COMPONENT_TYPES.filter((type) => type !== source.type)
    const sourceDomains: Partial<Record<ComponentType, number[]>> = {}
    const selectedDomains: Partial<Record<ComponentType, number[]>> = {}
    const narrowedTypes: ComponentType[] = []

    for (const type of conditionTypes) {
      const sourceDomain = [...(sourceGroup.conditions[type] || JAMO_INDICES[type])]
      const sourceItems = new Set(sourceDomain)
      const selected = [...new Set(selections[type] || [])].filter((item) => sourceItems.has(item))

      sourceDomains[type] = sourceDomain
      if (selected.length > 0 && selected.length < sourceDomain.length) {
        selectedDomains[type] = selected
        narrowedTypes.push(type)
      } else {
        selectedDomains[type] = [...sourceDomain]
      }
    }
    if (narrowedTypes.length === 0) return null

    const nextGroupConditions = Object.fromEntries(
      conditionTypes.map((type) => [type, [...selectedDomains[type]!]]),
    ) as Partial<Record<ComponentType, number[]>>

    // A rectangular combination split can require multiple rectangular remainder groups.
    // Example: (all initial × all final) - (ㄱ × no-final)
    // = (not-ㄱ × all final) + (ㄱ × with-final).
    const narrowedTypeOrder = new Map(narrowedTypes.map((type, index) => [type, index]))
    const remainderConditions = narrowedTypes.map((narrowedType, narrowedIndex) => {
      const excludedItems = new Set(selectedDomains[narrowedType]!)
      return Object.fromEntries(
        conditionTypes.map((type) => {
          const typeOrder = narrowedTypeOrder.get(type)
          if (type === narrowedType) {
            return [type, sourceDomains[type]!.filter((item) => !excludedItems.has(item))]
          }
          if (typeOrder !== undefined && typeOrder < narrowedIndex) {
            return [type, [...selectedDomains[type]!]]
          }
          return [type, [...sourceDomains[type]!]]
        }),
      ) as Partial<Record<ComponentType, number[]>>
    })

    const sourceBitmaps = new Map<number, number[][]>()
    for (const component of this.project.components) {
      if (component.type === source.type && component.conditions[sourceGroup.id]) {
        sourceBitmaps.set(component.typeIndex, component.bitmap)
      }
    }

    const splitOperationId = crypto.randomUUID()
    const newGroup: JamoGroup = {
      id: crypto.randomUUID(),
      name: customName?.trim() || getVariationGroupName(source.type, nextGroupConditions),
      conditions: nextGroupConditions,
      splitOperationId,
    }
    sourceGroup.conditions = remainderConditions[0]

    const additionalRemainderGroups = remainderConditions.slice(1).map((conditions) => ({
      id: crypto.randomUUID(),
      name: getVariationGroupName(source.type, conditions),
      conditions,
    }))
    const sourceGroupIndex = groups.indexOf(sourceGroup)
    groups.splice(sourceGroupIndex + 1, 0, ...additionalRemainderGroups, newGroup)
    this.project.groups[source.type] = sortVariationGroups(source.type, groups)
    this.syncComponents()

    const copiedGroupIds = new Set([...additionalRemainderGroups.map((group) => group.id), newGroup.id])
    let selectedComponent: PixelComponent | null = null
    for (const targetComponent of this.project.components) {
      if (
        targetComponent.type !== source.type ||
        !Object.keys(targetComponent.conditions).some((groupId) => copiedGroupIds.has(groupId))
      )
        continue
      const sourceBitmap = sourceBitmaps.get(targetComponent.typeIndex)
      if (sourceBitmap) targetComponent.bitmap = cloneBitmap(sourceBitmap)
      if (targetComponent.conditions[newGroup.id] && targetComponent.typeIndex === source.typeIndex) {
        selectedComponent = targetComponent
      }
    }
    this.rebuildComponentIndex()

    return selectedComponent
  }

  getComponentDeletionPlan(id: string) {
    const component = this.componentById.get(id)
    if (!component) return null

    const activeGroup = this.project.groups[component.type].find((group) => component.conditions[group.id])
    if (!activeGroup) return {component, groups: [], affectedComponentCount: 0}

    const groups = this.project.groups[component.type]
      .filter(
        (group) =>
          group.id === activeGroup.id ||
          (activeGroup.splitOperationId && group.splitOperationId === activeGroup.splitOperationId),
      )
      .map((group) => ({sourceType: component.type, group}))
    const groupIds = new Set(groups.map(({group}) => group.id))
    const affectedComponentCount = this.project.components.filter(
      (candidate) =>
        candidate.type === component.type && Object.keys(candidate.conditions).some((groupId) => groupIds.has(groupId)),
    ).length

    return {component, groups, affectedComponentCount}
  }

  deleteComponent(id: string) {
    const plan = this.getComponentDeletionPlan(id)
    if (!plan || plan.groups.length === 0) return null

    const targetType = plan.component.type
    for (const {sourceType, group} of plan.groups) {
      if (sourceType !== targetType) continue
      this.project.groups[sourceType] = this.project.groups[sourceType].filter((candidate) => candidate.id !== group.id)
    }

    const removedGroupIds = new Set(plan.groups.map(({group}) => group.id))
    this.project.deletedComponentKeys = (this.project.deletedComponentKeys || []).filter((key) => {
      const conditionIds = key.split(':').at(-1)?.split(',') || []
      return !conditionIds.some((conditionId) => removedGroupIds.has(conditionId))
    })
    this.syncComponents()
    return plan
  }

  // --- Group Management ---

  updateGroups(type: ComponentType, newGroups: JamoGroup[]) {
    this.project.groups[type] = sortVariationGroups(type, newGroups)
    this.syncComponents()
  }

  /**
   * conditions 객체에서 `false` 엔트리를 제거하여 정규화합니다.
   */
  private normalizeConditions(comp: PixelComponent) {
    if (!comp.conditions) comp.conditions = {}
    for (const k in comp.conditions) {
      if (comp.conditions[k] === false) {
        delete comp.conditions[k]
      }
    }
  }

  private rebuildComponentIndex() {
    const componentById = new Map<string, PixelComponent>()
    const componentIndexById = new Map<string, number>()
    for (let index = 0; index < this.project.components.length; index++) {
      const component = this.project.components[index]
      componentById.set(component.id, component)
      componentIndexById.set(component.id, index)
    }
    this.componentById = componentById
    this.componentIndexById = componentIndexById
    this.componentRevision++
  }

  syncComponents() {
    this.project.groups = sortGroups(this.project.groups)

    // Normalize existing components' conditions
    for (const c of this.project.components) {
      this.normalizeConditions(c)
    }

    const deletedKeys = new Set(this.project.deletedComponentKeys || [])
    const newComponents: PixelComponent[] = []
    const existingByKey = new Map<string, PixelComponent>()
    for (const component of this.project.components) {
      const key = getComponentKey(component)
      if (!existingByKey.has(key)) existingByKey.set(key, component)
    }

    for (const type of COMPONENT_TYPES) {
      for (const typeIndex of COMPONENT_INDICES[type]) {
        for (const group of this.project.groups[type]) {
          const conditions = {[group.id]: true}
          const componentKey = getComponentKey({type, typeIndex, conditions})
          if (deletedKeys.has(componentKey)) continue
          const matchedComp = existingByKey.get(componentKey)

          if (matchedComp) {
            newComponents.push({...matchedComp, conditions})
          } else {
            newComponents.push({
              id: crypto.randomUUID(),
              bitmap: createEmptyBitmap(),
              type,
              typeIndex,
              conditions,
            })
          }
        }
      }
    }

    this.project.components = newComponents
    this.rebuildComponentIndex()
    if (this.selectedComponentId && !this.componentById.has(this.selectedComponentId)) {
      this.selectedComponentId = null
    }
  }

  loadProject(data: FontProject) {
    if (!data.groups) {
      data.groups = {chosung: [], jungsung: [], jongsung: []}
    }
    data.groupModelVersion = 2
    data.deletedComponentKeys ||= []
    // Update old components: normalize conditions
    for (const c of data.components) {
      this.normalizeConditions(c)
    }
    this.project = data
    this.selectedComponentId = null
    this.syncComponents()
  }
}

export const projectState = new ProjectState()
