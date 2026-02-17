export interface PixelComponent {
  id: string
  bitmap: number[][] // 16x16 binary array (0: off, 1: on)
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
