import type {FontProject, PixelComponent, ComponentType} from '$lib/types'

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
    this.selectedComponentId = newComponent.id
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
