<script lang="ts">
  import {onDestroy} from 'svelte'

  let {bitmap, size = 32, class: className = ''}: {bitmap?: number[][]; size?: number; class?: string} = $props()

  const BITMAP_SIZE = 16
  let canvas: HTMLCanvasElement = $state(undefined!)

  onDestroy(() => {
    if (canvas) {
      canvas.width = 0
      canvas.height = 0
    }
  })

  $effect(() => {
    if (!bitmap || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rows = Math.min(bitmap.length, BITMAP_SIZE)
    const cols = Math.min(bitmap[0]?.length ?? 0, BITMAP_SIZE)
    if (rows === 0 || cols === 0) return

    ctx.clearRect(0, 0, BITMAP_SIZE, BITMAP_SIZE)
    ctx.fillStyle = 'black'

    for (let r = 0; r < rows; r++) {
      const row = bitmap[r]
      for (let c = 0; c < cols; c++) {
        if (row[c]) ctx.fillRect(c, r, 1, 1)
      }
    }
  })
</script>

<canvas
  bind:this={canvas}
  width={BITMAP_SIZE}
  height={BITMAP_SIZE}
  style={`width: ${size}px; height: ${size}px;`}
  class="block bg-background {className}"
></canvas>
