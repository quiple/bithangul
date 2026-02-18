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

  // data와 index 모두 의존성에 포함 → 생성 완료 시 즉시 재렌더링
  $: canvas && index >= 0 && data !== undefined && draw();
  onMount(draw);
</script>

<div
  class="max-w-full"
  title="{char} (U+{(0xAC00 + index).toString(16).toUpperCase()})"
>
  <canvas bind:this={canvas} width={32} height={32} class="block max-w-full"></canvas>
</div>
