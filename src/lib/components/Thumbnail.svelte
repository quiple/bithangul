<script lang="ts">
  import { onMount } from "svelte";

  let { bitmap, size = 32 }: { bitmap?: number[][]; size?: number } = $props();

  let canvas: HTMLCanvasElement;

  $effect(() => {
    if (bitmap) draw();
  });

  function draw() {
    if (!canvas || !bitmap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const cw = w / 16;
    const ch = h / 16;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "black"; // Always black pixels

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
  class="block bg-background border"
></canvas>
