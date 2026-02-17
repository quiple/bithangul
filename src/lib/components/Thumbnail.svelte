<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';

  export let bitmap: number[][]; // 16x16
  export let size = 32;

  let canvas: HTMLCanvasElement;

  $: if (canvas && bitmap) draw();

  function draw() {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const cw = w / 16;
    const ch = h / 16;
    
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'black'; // text-foreground color in light mode?
    // Use getComputedStyle for color?
    // Let's stick to black for simplicity in thumbnail or 'currentColor'.
    // Actually, canvas doesn't support currentColor easily.
    // Use black.
    
    for (let r = 0; r < 16; r++) {
      for (let c = 0; c < 16; c++) {
        if (bitmap[r][c]) {
          ctx.fillRect(c * cw, r * ch, cw, ch);
        }
      }
    }
  }

  onMount(draw);
</script>

<canvas 
  bind:this={canvas} 
  width={size} 
  height={size} 
  class="block bg-white dark:bg-black border border-muted"
></canvas>
