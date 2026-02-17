<script lang="ts">
  import { cn } from "$lib/utils"

  let {
    bitmap,
    onUpdate,
  }: {
    bitmap: number[][]
    onUpdate: (newBitmap: number[][]) => void
  } = $props()

  let isDrawing = false
  let drawMode = 1; // 1 = draw, 0 = erase

  function handlePointerDown(r: number, c: number, e: PointerEvent) {
    e.preventDefault(); // Prevent scroll on touch
    // Determine draw mode based on current pixel
    const currentVal = bitmap[r][c]
    drawMode = currentVal === 1 ? 0 : 1
    isDrawing = true
    updatePixel(r, c, drawMode)

    // Use setPointerCapture to track drag even outside the element
    (e.target as Element).setPointerCapture(e.pointerId)
  }

  function handlePointerEnter(r: number, c: number, e: PointerEvent) {
    if (isDrawing) {
      updatePixel(r, c, drawMode)
    }
  }

  function handlePointerUp(e: PointerEvent) {
    isDrawing = false
    // Release capture if needed, though usually automatic on up
    if (
      e.target instanceof Element &&
      e.target.hasPointerCapture(e.pointerId)
    ) {
      e.target.releasePointerCapture(e.pointerId)
    }
  }

  function updatePixel(r: number, c: number, val: number) {
    // console.log('updatePixel', r, c, val, bitmap[r][c])
    if (bitmap[r][c] !== val) {
      const newBitmap = bitmap.map((row) => [...row])
      newBitmap[r][c] = val
      onUpdate(newBitmap)
    }
  }
</script>

<svelte:window onpointerup={handlePointerUp} />

<div
  class="grid grid-cols-16 gap-px bg-border border w-full max-w-100 select-none touch-none aspect-square"
  oncontextmenu={(e) => e.preventDefault()}
  role="grid"
  tabindex="-1"
>
  {#each bitmap as row, r}
    {#each row as cell, c}
      <button
        class={cn(
          "size-full cursor-crosshair transition-colors duration-100 block",
          cell ? "bg-primary" : "bg-background hover:bg-muted",
        )}
        onpointerdown={(e) => handlePointerDown(r, c, e)}
        onpointerenter={(e) => handlePointerEnter(r, c, e)}
        aria-label={`Pixel ${r},${c}`}
        type="button"
      ></button>
    {/each}
  {/each}
</div>
