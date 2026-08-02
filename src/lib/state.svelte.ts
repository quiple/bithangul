import type {FontProject, PixelComponent, ComponentType, JamoGroup} from '$lib/types'

import {createEmptyBitmap} from '$lib/bitmap'
import {CHOSUNG, CHOSUNG_COUNT, JUNGSUNG, JUNGSUNG_COUNT, JONGSUNG, JONGSUNG_COUNT} from '$lib/hangul'

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

  constructor() {}

  get selectedComponent() {
    return this.project.components.find((c) => c.id === this.selectedComponentId)
  }

  selectComponent(id: string | null) {
    this.selectedComponentId = id
  }

  updateComponent(id: string, updated: PixelComponent) {
    const index = this.project.components.findIndex((c) => c.id === id)
    if (index !== -1) {
      this.project.components[index] = updated
    }
  }

  private getConditionKey(conditions: Record<string, boolean>) {
    return Object.keys(conditions || {})
      .filter((id) => conditions[id])
      .sort()
      .join(',')
  }

  private getComponentKey(component: Pick<PixelComponent, 'type' | 'typeIndex' | 'conditions'>) {
    return `${component.type}:${component.typeIndex}:${this.getConditionKey(component.conditions)}`
  }

  private getSplitGroupName(type: ComponentType, conditions: Partial<Record<ComponentType, number[]>>) {
    const typeLabels: Record<ComponentType, string> = {chosung: '초성', jungsung: '중성', jongsung: '종성'}
    const chars: Record<ComponentType, string[]> = {chosung: CHOSUNG, jungsung: JUNGSUNG, jongsung: JONGSUNG}
    const parts: string[] = []
    for (const conditionType of ['chosung', 'jungsung', 'jongsung'] as ComponentType[]) {
      if (
        conditionType === type ||
        !conditions[conditionType] ||
        conditions[conditionType]!.length === chars[conditionType].length
      )
        continue
      const labels = conditions[conditionType]!.map((index) =>
        conditionType === 'jongsung' && index === 0 ? '받침 없음' : chars[conditionType][index],
      )
      const preview = labels.slice(0, 3).join('·')
      parts.push(`${typeLabels[conditionType]} ${preview}${labels.length > 3 ? ` 외 ${labels.length - 3}개` : ''}`)
    }
    return `${typeLabels[type]} ${parts.join(' · ')}`
  }

  splitComponent(id: string, selections: Partial<Record<ComponentType, number[]>>) {
    const source = this.project.components.find((component) => component.id === id)
    if (!source) return null

    const sourceGroupId = Object.keys(source.conditions || {}).find(
      (groupId) => source.conditions[groupId] && this.project.groups[source.type].some((group) => group.id === groupId),
    )
    const sourceGroup = this.project.groups[source.type].find((group) => group.id === sourceGroupId)
    if (!sourceGroup) return null

    const nextGroupConditions = Object.fromEntries(
      Object.entries(sourceGroup.conditions).map(([type, items]) => [type, [...items]]),
    ) as Partial<Record<ComponentType, number[]>>
    let hasNarrowerCondition = false
    for (const type of ['chosung', 'jungsung', 'jongsung'] as ComponentType[]) {
      if (type === source.type || !selections[type]?.length) continue
      nextGroupConditions[type] = [...selections[type]!]
      hasNarrowerCondition = true
    }
    if (!hasNarrowerCondition) return null

    const splitOperationId = crypto.randomUUID()
    const newGroup: JamoGroup = {
      id: crypto.randomUUID(),
      name: this.getSplitGroupName(source.type, nextGroupConditions),
      conditions: nextGroupConditions,
      splitOperationId,
    }
    this.project.groups[source.type].push(newGroup)
    this.syncComponents()

    const typeInfo = {
      chosung: {start: 0, count: CHOSUNG_COUNT},
      jungsung: {start: 0, count: JUNGSUNG_COUNT},
      jongsung: {start: 1, count: JONGSUNG_COUNT},
    }[source.type]
    for (let typeIndex = typeInfo.start; typeIndex < typeInfo.count; typeIndex++) {
      const sourceComponent = this.project.components.find(
        (component) =>
          component.type === source.type && component.typeIndex === typeIndex && component.conditions[sourceGroup.id],
      )
      const targetComponent = this.project.components.find(
        (component) =>
          component.type === source.type && component.typeIndex === typeIndex && component.conditions[newGroup.id],
      )
      if (sourceComponent && targetComponent) {
        targetComponent.bitmap = sourceComponent.bitmap.map((row) => [...row])
      }
    }

    return (
      this.project.components.find(
        (component) =>
          component.type === source.type &&
          component.typeIndex === source.typeIndex &&
          component.conditions[newGroup.id],
      ) || null
    )
  }

  getComponentDeletionPlan(id: string) {
    const component = this.project.components.find((candidate) => candidate.id === id)
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
        candidate.type === component.type && [...groupIds].some((groupId) => candidate.conditions[groupId]),
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

  syncComponents() {
    // Normalize existing components' conditions
    for (const c of this.project.components) {
      this.normalizeConditions(c)
    }

    const deletedKeys = new Set(this.project.deletedComponentKeys || [])
    const newComponents: PixelComponent[] = []
    const typeInfo: Record<ComponentType, {count: number; start: number}> = {
      chosung: {count: CHOSUNG_COUNT, start: 0},
      jungsung: {count: JUNGSUNG_COUNT, start: 0},
      jongsung: {count: JONGSUNG_COUNT, start: 1},
    }

    const typeTypes: ComponentType[] = ['chosung', 'jungsung', 'jongsung']

    for (const type of typeTypes) {
      const info = typeInfo[type]
      const validConditions = this.project.groups[type].map((group) => ({[group.id]: true}))

      for (let i = info.start; i < info.count; i++) {
        const existingForJamo = this.project.components.filter((c) => c.type === type && c.typeIndex === i)

        for (const cond of validConditions) {
          const componentKey = this.getComponentKey({type, typeIndex: i, conditions: cond})
          if (deletedKeys.has(componentKey)) continue
          const matchedComp = existingForJamo.find((component) => this.getComponentKey(component) === componentKey)

          if (matchedComp) {
            newComponents.push({...matchedComp, conditions: cond})
          } else {
            newComponents.push({
              id: crypto.randomUUID(),
              bitmap: createEmptyBitmap(),
              type,
              typeIndex: i,
              conditions: cond,
            })
          }
        }
      }
    }

    this.project.components = newComponents
    if (this.selectedComponentId && !this.project.components.find((c) => c.id === this.selectedComponentId)) {
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
