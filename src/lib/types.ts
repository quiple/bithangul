export type ComponentType = 'chosung' | 'jungsung' | 'jongsung'

export interface PixelComponent {
  id: string
  bitmap: number[][] // 16x16 binary array (0: off, 1: on)
  /** 이 컴포넌트가 속하는 자모 종류 */
  type: ComponentType
  /** 이 컴포넌트가 속하는 자모 인덱스 (초성 0~18, 중성 0~20, 종성 1~27) */
  typeIndex: number
  targets: {
    chosung: number[] // Applied chosung indices (0~18)
    jungsung: number[] // Applied jungsung indices (0~20)
    jongsung: number[] // Applied jongsung indices (0~27, 0 is no jongsung)
  }
}

export interface FontProject {
  name: string
  components: PixelComponent[]
}
