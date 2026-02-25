import type {FontProject, PixelComponent, ComponentType, JamoGroup} from '$lib/types'

import {createEmptyBitmap} from '$lib/bitmap'
import {CHOSUNG_COUNT, JUNGSUNG_COUNT, JONGSUNG_COUNT} from '$lib/hangul'

class ProjectState {
  project = $state<FontProject>({
    name: 'My Font',
    groups: {
      chosung: [],
      jungsung: [],
      jongsung: [{id: 'no_jongsung', name: '받침 없음', items: [0]}],
    },
    components: [],
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

  // --- Group Management ---

  updateGroups(type: ComponentType, newGroups: JamoGroup[]) {
    this.project.groups[type] = newGroups
    this.syncComponents()
  }

  private getGroupStatesForType(type: ComponentType, groups: JamoGroup[], count: number, startIndex: number = 0) {
    const states: Record<string, boolean>[] = []
    const seen = new Set<string>()

    for (let i = startIndex; i < count; i++) {
      const state: Record<string, boolean> = {}
      // To ensure consistent property order in JSON stringify, sort keys
      const sortedGroups = [...groups].sort((a, b) => a.id.localeCompare(b.id))
      for (const g of sortedGroups) {
        if (g.items.includes(i)) {
          state[g.id] = true
        }
      }
      const key = JSON.stringify(state)
      if (!seen.has(key)) {
        seen.add(key)
        states.push(state)
      }
    }
    return states
  }

  private getCombinations(types: ComponentType[], targetType: ComponentType) {
    const typeInfo = {
      chosung: {count: CHOSUNG_COUNT, startIndex: 0},
      jungsung: {count: JUNGSUNG_COUNT, startIndex: 0},
      jongsung: {count: JONGSUNG_COUNT, startIndex: 0}, // jongsung 0 is valid ('no jongsung')
    }

    let result: Record<string, boolean>[] = [{}]

    for (const type of types) {
      const info = typeInfo[type]
      const applicableGroups = this.project.groups[type].filter((g) => !g.appliesTo || g.appliesTo.includes(targetType))
      const validStates = this.getGroupStatesForType(type, applicableGroups, info.count, info.startIndex)

      const nextResult: Record<string, boolean>[] = []
      for (const res of result) {
        for (const state of validStates) {
          nextResult.push({...res, ...state})
        }
      }
      result = nextResult
    }

    const filtered = result.filter((c) => Object.keys(c).length > 0)
    return filtered
  }

  private getConditionDistance(c1: Record<string, boolean>, c2: Record<string, boolean>) {
    let dist = 0
    for (const k in c1) {
      if (!c2[k]) dist++
    }
    for (const k in c2) {
      if (!c1[k]) dist++
    }
    return dist
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

    // Completely strip out `{}` from components if the project has grown to have other valid conditions.
    // If a type has groups defined, it shouldn't hold onto empty conditions.

    const newComponents: PixelComponent[] = []
    const typeInfo: Record<ComponentType, {count: number; start: number; otherTypes: ComponentType[]}> = {
      chosung: {count: CHOSUNG_COUNT, start: 0, otherTypes: ['jungsung', 'jongsung']},
      jungsung: {count: JUNGSUNG_COUNT, start: 0, otherTypes: ['chosung', 'jongsung']},
      jongsung: {count: JONGSUNG_COUNT, start: 1, otherTypes: ['chosung', 'jungsung']},
    }

    const typeTypes: ComponentType[] = ['chosung', 'jungsung', 'jongsung']

    for (const type of typeTypes) {
      const info = typeInfo[type]
      const validConditions = this.getCombinations(info.otherTypes, type)

      for (let i = info.start; i < info.count; i++) {
        const existingForJamo = this.project.components.filter((c) => c.type === type && c.typeIndex === i)

        const pairs: {cond: Record<string, boolean>; comp: PixelComponent; dist: number}[] = []

        for (const cond of validConditions) {
          for (const comp of existingForJamo) {
            pairs.push({
              cond,
              comp,
              dist: this.getConditionDistance(cond, comp.conditions),
            })
          }
        }

        pairs.sort((a, b) => a.dist - b.dist)

        const assignedConds = new Set<Record<string, boolean>>()
        const assignedComps = new Set<PixelComponent>()
        const condToComp = new Map<Record<string, boolean>, PixelComponent>()

        for (const pair of pairs) {
          if (!assignedConds.has(pair.cond) && !assignedComps.has(pair.comp)) {
            assignedConds.add(pair.cond)
            assignedComps.add(pair.comp)
            condToComp.set(pair.cond, pair.comp)
          }
        }

        for (const cond of validConditions) {
          const matchedComp = condToComp.get(cond)

          if (matchedComp) {
            newComponents.push({...matchedComp, conditions: cond})
          } else {
            // If it's a newly created variation without a matched existing component, create an empty component
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
    if (this.selectedComponentId && !newComponents.find((c) => c.id === this.selectedComponentId)) {
      this.selectedComponentId = null
    }
  }

  loadProject(data: FontProject) {
    if (!data.groups) {
      data.groups = {chosung: [], jungsung: [], jongsung: []}
    }
    // Ensure "no_jongsung" group exists
    if (!data.groups.jongsung.find((g) => g.id === 'no_jongsung')) {
      data.groups.jongsung.push({id: 'no_jongsung', name: '받침 없음', items: [0]})
    }
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
