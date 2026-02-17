<script lang="ts">
  import { cn } from "$lib/utils";

  export let bitmap: number[][]; // 16x16
  export let onUpdate: (newBitmap: number[][]) => void;

  let isDrawing = false;
  let drawMode = 1; // 1 = draw, 0 = erase

  function handlePointerDown(r: number, c: number, e: PointerEvent) {
    e.preventDefault(); // Prevent scroll on touch
    // Determine draw mode based on current pixel or modifier?
    // Let's say: left click toggles the clicked pixel, then subsequent drag sets to that value.
    const currentVal = bitmap[r][c];
    drawMode = currentVal === 1 ? 0 : 1;
    isDrawing = true;
    updatePixel(r, c, drawMode);
    
    // Capture pointer to handle out of bounds or swift movement?
    // (e.target as HTMLElement).setPointerCapture(e.pointerId);
    // Actually explicit capture on container might be better but let's just use window listener or container events.
  }

  function handlePointerEnter(r: number, c: number, e: PointerEvent) {
    if (isDrawing) {
      updatePixel(r, c, drawMode);
    }
  }

  function handlePointerUp() {
    isDrawing = false;
  }

  function updatePixel(r: number, c: number, val: number) {
    if (bitmap[r][c] !== val) {
      const newBitmap = bitmap.map(row => [...row]);
      newBitmap[r][c] = val;
      onUpdate(newBitmap);
    }
  }
</script>

<svelte:window on:pointerup={handlePointerUp} />

<div 
  class="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-[1px] bg-border border border-border w-full max-w-[400px] aspect-square select-none touch-none"
  on:contextmenu|preventDefault
>
  {#each bitmap as row, r}
    {#each row as cell, c}
      <button
        class={cn(
          "w-full h-full cursor-pointer transition-colors duration-75",
          cell ? "bg-primary" : "bg-background hover:bg-muted"
        )}
        on:pointerdown={(e) => handlePointerDown(r, c, e)}
        on:pointerenter={(e) => handlePointerEnter(r, c, e)}
        aria-label={`Pixel ${r},${c}`}
      ></button>
    {/each}
  {/each}
</div>
