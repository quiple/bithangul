import type {FontProject, PixelComponent, ComponentType, JamoGroup} from '$lib/types'

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

  private getCombinations(types: ComponentType[]) {
    const typeInfo = {
      chosung: {count: CHOSUNG_COUNT, startIndex: 0},
      jungsung: {count: JUNGSUNG_COUNT, startIndex: 0},
      jongsung: {count: JONGSUNG_COUNT, startIndex: 0}, // jongsung 0 is valid ('no jongsung')
    }

    let result: Record<string, boolean>[] = [{}]

    for (const type of types) {
      const info = typeInfo[type]
      const validStates = this.getGroupStatesForType(type, this.project.groups[type], info.count, info.startIndex)

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

  private conditionsMatch(c1: Record<string, boolean>, c2: Record<string, boolean>) {
    const keys1 = Object.keys(c1)
    const keys2 = Object.keys(c2)
    if (keys1.length !== keys2.length) return false
    for (const key of keys1) {
      if (c1[key] !== c2[key]) return false
    }
    return true
  }

  // Finds best existing component comparing keys
  private findBestComponent(existingComps: PixelComponent[], newCond: Record<string, boolean>) {
    if (existingComps.length === 0) return null
    let bestComp = existingComps[0]
    let maxMatches = -1

    for (const cand of existingComps) {
      let matches = 0
      for (const key in newCond) {
        if (cand.conditions[key] === newCond[key]) {
          matches++
        }
      }
      if (matches > maxMatches) {
        maxMatches = matches
        bestComp = cand
      }
    }
    return bestComp
  }

  syncComponents() {
    // Normalize existing components' conditions by removing `false` entries
    // to migrate older projects smoothly
    for (const c of this.project.components) {
      if (!c.conditions) c.conditions = {}
      for (const k in c.conditions) {
        if (c.conditions[k] === false) {
          delete c.conditions[k]
        }
      }
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
      const validConditions = this.getCombinations(info.otherTypes)

      for (let i = info.start; i < info.count; i++) {
        const existingForJamo = this.project.components.filter((c) => c.type === type && c.typeIndex === i)

        for (const cond of validConditions) {
          // Find an exact match if possible
          const exactMatch = existingForJamo.find((c) => this.conditionsMatch(c.conditions, cond))
          if (exactMatch) {
            newComponents.push({...exactMatch, conditions: cond})
            continue
          }

          // fallback: try best match
          const bestMatch = this.findBestComponent(existingForJamo, cond)
          newComponents.push({
            id: crypto.randomUUID(),
            bitmap: bestMatch
              ? bestMatch.bitmap.map((row) => [...row])
              : Array(16)
                  .fill(0)
                  .map(() => Array(16).fill(0)),
            type,
            typeIndex: i,
            conditions: cond,
          })
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
    // Update old components: ensure conditions object exists and remove `false` entries
    for (const c of data.components) {
      if (!c.conditions) c.conditions = {}
      for (const k in c.conditions) {
        if (c.conditions[k] === false) {
          delete c.conditions[k]
        }
      }
    }
    this.project = data
    this.selectedComponentId = null
    this.syncComponents()
  }
}

export const projectState = new ProjectState()
