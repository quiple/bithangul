import type {FontProject, PixelComponent, ComponentType, JamoGroup} from '$lib/types'

import {cloneBitmap, createEmptyBitmap} from '$lib/bitmap'
import {getActiveVariationId, getComponentKey} from '$lib/component-utils'
import {COMPONENT_INDICES, COMPONENT_TYPES, COMPONENT_TYPE_LABELS, JAMO_BY_TYPE, getJamoLabel} from '$lib/hangul'

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

  private getSplitGroupName(type: ComponentType, conditions: Partial<Record<ComponentType, number[]>>) {
    const parts: string[] = []
    for (const conditionType of COMPONENT_TYPES) {
      if (
        conditionType === type ||
        !conditions[conditionType] ||
        conditions[conditionType]!.length === JAMO_BY_TYPE[conditionType].length
      )
        continue
      const labels = conditions[conditionType]!.map((index) => getJamoLabel(conditionType, index, '받침 없음'))
      const preview = labels.slice(0, 3).join('·')
      parts.push(
        `${COMPONENT_TYPE_LABELS[conditionType]} ${preview}${labels.length > 3 ? ` 외 ${labels.length - 3}개` : ''}`,
      )
    }
    return `${COMPONENT_TYPE_LABELS[type]} ${parts.join(' · ')}`
  }

  splitComponent(id: string, selections: Partial<Record<ComponentType, number[]>>) {
    const source = this.componentById.get(id)
    if (!source) return null

    const sourceGroupId = getActiveVariationId(source)
    const sourceGroup = this.project.groups[source.type].find((group) => group.id === sourceGroupId)
    if (!sourceGroup) return null

    const nextGroupConditions = Object.fromEntries(
      Object.entries(sourceGroup.conditions).map(([type, items]) => [type, [...items]]),
    ) as Partial<Record<ComponentType, number[]>>
    let hasNarrowerCondition = false
    for (const type of COMPONENT_TYPES) {
      if (type === source.type || !selections[type]?.length) continue
      nextGroupConditions[type] = [...selections[type]!]
      hasNarrowerCondition = true
    }
    if (!hasNarrowerCondition) return null

    const sourceBitmaps = new Map<number, number[][]>()
    for (const component of this.project.components) {
      if (component.type === source.type && component.conditions[sourceGroup.id]) {
        sourceBitmaps.set(component.typeIndex, component.bitmap)
      }
    }

    const splitOperationId = crypto.randomUUID()
    const newGroup: JamoGroup = {
      id: crypto.randomUUID(),
      name: this.getSplitGroupName(source.type, nextGroupConditions),
      conditions: nextGroupConditions,
      splitOperationId,
    }
    this.project.groups[source.type].push(newGroup)
    this.syncComponents()

    let selectedComponent: PixelComponent | null = null
    for (const targetComponent of this.project.components) {
      if (targetComponent.type !== source.type || !targetComponent.conditions[newGroup.id]) continue
      const sourceBitmap = sourceBitmaps.get(targetComponent.typeIndex)
      if (sourceBitmap) targetComponent.bitmap = cloneBitmap(sourceBitmap)
      if (targetComponent.typeIndex === source.typeIndex) selectedComponent = targetComponent
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
    this.project.groups[type] = newGroups
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
