import type { FontProject, PixelComponent } from '$lib/types'

class ProjectState {
  project = $state<FontProject>({
    name: 'My Font',
    components: [],
  })

  selectedComponentId = $state<string | null>(null)

  constructor() { }

  addComponent() {
    const newComponent: PixelComponent = {
      id: crypto.randomUUID(),
      bitmap: Array(16)
        .fill(0)
        .map(() => Array(16).fill(0)),
      targets: {
        chosung: [],
        jungsung: [],
        jongsung: [],
      },
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
      this.selectedComponentId = this.project.components[0]?.id ?? null
    }
  }

  loadProject(data: FontProject) {
    this.project = data
    // 로드 후 목록 화면이 먼저 보이도록 선택 해제
    this.selectedComponentId = null
  }
}

export const projectState = new ProjectState()
