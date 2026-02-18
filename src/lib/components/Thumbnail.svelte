<script lang="ts">
  import { onMount } from 'svelte';

  let { bitmap, size = 32, class: className = '' }: { bitmap?: number[][]; size?: number; class?: string } = $props();

  let canvas: HTMLCanvasElement = $state(undefined!);

  // 비트맵 내용 기반 키: 실제로 픽셀이 바뀔 때만 문자열 생성
  let bitmapKey = $derived(bitmap ? bitmap.map((r) => r.join('')).join('|') : '');

  $effect(() => {
    // bitmapKey를 구독 → 키가 바뀔 때만 실행
    void bitmapKey;
    if (bitmap && canvas) draw(bitmap);
  });

  function draw(bmp: number[][]) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const cw = w / bmp[0].length;
    const ch = h / bmp.length;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'black';

    for (let r = 0; r < bmp.length; r++) {
      for (let c = 0; c < bmp[0].length; c++) {
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

<canvas bind:this={canvas} width={size} height={size} class="block bg-background border {className}"></canvas>
