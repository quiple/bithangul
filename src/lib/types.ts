export type ComponentType = 'chosung' | 'jungsung' | 'jongsung'

export interface JamoGroup {
  id: string
  name: string
  /** 자형이 사용되는 초·중·종성 조합. 그룹이 속한 컴포넌트 타입은 생략합니다. */
  conditions: Partial<Record<ComponentType, number[]>>
  splitOperationId?: string // Groups created together by a component split share this id.
}

export interface GroupsStructure {
  chosung: JamoGroup[]
  jungsung: JamoGroup[]
  jongsung: JamoGroup[]
}

export interface PixelComponent {
  id: string
  bitmap: number[][] // 16x16 binary array (0: off, 1: on)
  type: ComponentType
  typeIndex: number
  conditions: Record<string, boolean>
}

export interface FontProject {
  name: string
  baseline?: number
  groupModelVersion?: 2
  groups: GroupsStructure
  components: PixelComponent[]
  deletedComponentKeys?: string[]
}
