import type {FontProject, PixelComponent, ComponentType} from '$lib/types'

import {CHOSUNG_COUNT, JUNGSUNG_COUNT, JONGSUNG_COUNT} from '$lib/hangul'

class ProjectState {
  project = $state<FontProject>({
    name: 'My Font',
    components: [],
  })

  selectedComponentId = $state<string | null>(null)

  constructor() {}

  addComponent(type: ComponentType, typeIndex: number) {
    // 기본 targets 설정: 해당 자모 타입은 typeIndex로 고정
    const targets: PixelComponent['targets'] = {
      chosung: [],
      jungsung: [],
      jongsung: [0],
    }

    if (type === 'chosung') {
      targets.chosung = [typeIndex]
    } else if (type === 'jungsung') {
      targets.jungsung = [typeIndex]
    } else if (type === 'jongsung') {
      targets.jongsung = [typeIndex]
    }

    const newComponent: PixelComponent = {
      id: crypto.randomUUID(),
      bitmap: Array(16)
        .fill(0)
        .map(() => Array(16).fill(0)),
      type,
      typeIndex,
      targets,
    }
    this.project.components.push(newComponent)
  }

  selectComponent(id: string | null) {
    this.selectedComponentId = id
  }

  get selectedComponent() {
    return this.project.components.find((c) => c.id === this.selectedComponentId)
  }

  updateComponent(id: string, updated: PixelComponent) {
    const index = this.project.components.findIndex((c) => c.id === id)
    if (index !== -1) {
      this.project.components[index] = updated
    }
  }

  duplicateComponent(id: string) {
    const source = this.project.components.find((c) => c.id === id)
    if (!source) return
    const newComponent: PixelComponent = {
      id: crypto.randomUUID(),
      bitmap: source.bitmap.map((row) => [...row]),
      type: source.type,
      typeIndex: source.typeIndex,
      targets: {
        chosung: [...source.targets.chosung],
        jungsung: [...source.targets.jungsung],
        jongsung: [...source.targets.jongsung],
      },
    }
    const index = this.project.components.indexOf(source)
    this.project.components.splice(index + 1, 0, newComponent)
  }

  copyRowToAll(type: ComponentType, sourceTypeIndex: number) {
    const sourceComps = this.project.components.filter((c) => c.type === type && c.typeIndex === sourceTypeIndex)
    if (sourceComps.length === 0) return

    const count = type === 'chosung' ? CHOSUNG_COUNT : type === 'jungsung' ? JUNGSUNG_COUNT : JONGSUNG_COUNT
    const startIndex = type === 'jongsung' ? 1 : 0

    for (let ti = startIndex; ti < count; ti++) {
      if (ti === sourceTypeIndex) continue

      // 대상 행의 기존 컴포넌트 제거
      this.project.components = this.project.components.filter((c) => !(c.type === type && c.typeIndex === ti))

      // 소스 행의 컴포넌트를 복제하여 대상 행에 추가
      for (const src of sourceComps) {
        const newTargets = {
          chosung: [...src.targets.chosung],
          jungsung: [...src.targets.jungsung],
          jongsung: [...src.targets.jongsung],
        }
        // targets에서 소스 typeIndex를 대상 typeIndex로 교체
        newTargets[type] = newTargets[type].map((idx) => (idx === sourceTypeIndex ? ti : idx))

        this.project.components.push({
          id: crypto.randomUUID(),
          bitmap: src.bitmap.map((row) => [...row]),
          type,
          typeIndex: ti,
          targets: newTargets,
        })
      }
    }
  }

  deleteComponent(id: string) {
    this.project.components = this.project.components.filter((c) => c.id !== id)
    if (this.selectedComponentId === id) {
      this.selectedComponentId = null
    }
  }

  loadProject(data: FontProject) {
    this.project = data
    this.selectedComponentId = null
  }
}

export const projectState = new ProjectState()
