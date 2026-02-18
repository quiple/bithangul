<script lang="ts">
  import { onMount } from 'svelte';

  export let index: number;
  export let data: ArrayBuffer | null;

  $: char = String.fromCharCode(0xAC00 + index);

  let canvas: HTMLCanvasElement;

  function draw() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 32, 32);

    if (!data) return;

    const offset = index * 32;
    if (offset + 32 > data.byteLength) return;

    const view = new DataView(data);
    ctx.fillStyle = '#000';

    for (let r = 0; r < 16; r++) {
      const rowVal = view.getUint16(offset + r * 2, false);
      for (let c = 0; c < 16; c++) {
        if ((rowVal >> (15 - c)) & 1) {
          ctx.fillRect(c * 2, r * 2, 2, 2);
        }
      }
    }
  }

  $: if (canvas && index >= 0) draw();
  onMount(draw);
</script>

<div
  class="group relative flex flex-col items-center justify-center size-full cursor-default p-0"
  title="{char} (U+{(0xAC00 + index).toString(16).toUpperCase()})"
>
  <canvas bind:this={canvas} width={32} height={32} class="block"></canvas>
</div>
