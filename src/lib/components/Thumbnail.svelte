<script lang="ts">
  import {onDestroy} from 'svelte'

  let {bitmap, size = 32, class: className = ''}: {bitmap?: number[][]; size?: number; class?: string} = $props()

  const width = $derived(bitmap?.[0]?.length || 16)
  const height = $derived(bitmap?.length || 16)
  const scale = $derived(size / Math.max(width, height))
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

    const rows = height
    const cols = width
    if (rows === 0 || cols === 0) return

    ctx.clearRect(0, 0, width, height)
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
  {width}
  {height}
  style={`width: ${width * scale}px; height: ${height * scale}px;`}
  class="block bg-background {className}"
></canvas>
