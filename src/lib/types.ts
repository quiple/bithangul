export type ComponentType = 'chosung' | 'jungsung' | 'jongsung'

export interface JamoGroup {
  id: string
  name: string
  items: number[]
  appliesTo?: ComponentType[] // Which component types this group affects. If undefined, applies to all other types.
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
  groups: GroupsStructure
  components: PixelComponent[]
  deletedComponentKeys?: string[]
}
