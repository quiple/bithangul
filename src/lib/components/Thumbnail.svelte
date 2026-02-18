<script lang="ts">
  import { onMount } from 'svelte';

  let { bitmap, size = 32 }: { bitmap?: number[][]; size?: number } = $props();

  let canvas: HTMLCanvasElement = $state(undefined!);
  // bitmap의 직렬화된 값을 추적해서 실제로 변경됐을 때만 다시 그림
  let lastBitmapKey = '';

  $effect(() => {
    if (!bitmap) return;
    // 얕은 비교 대신 내용 기반 키로 불필요한 재렌더 방지
    const key = bitmap.map((r) => r.join('')).join('|');
    if (key === lastBitmapKey) return;
    lastBitmapKey = key;
    draw(bitmap);
  });

  function draw(bmp: number[][]) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const cw = w / 16;
    const ch = h / 16;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'black';

    for (let r = 0; r < 16; r++) {
      for (let c = 0; c < 16; c++) {
        if (bmp[r][c]) {
          ctx.fillRect(c * cw, r * ch, cw, ch);
        }
      }
    }
  }

  onMount(() => {
    if (bitmap) draw(bitmap);
  });
</script>

<canvas bind:this={canvas} width={size} height={size} class="block bg-background border"></canvas>
