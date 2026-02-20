<script lang="ts">
  let { bitmap, size = 32, class: className = '' }: { bitmap?: number[][]; size?: number; class?: string } = $props();

  let canvas: HTMLCanvasElement = $state(undefined!);

  $effect(() => {
    if (!bitmap || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const rows = bitmap.length;
    const cols = bitmap[0]?.length ?? 0;
    if (rows === 0 || cols === 0) return;

    const cw = w / cols;
    const ch = h / rows;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'black';

    for (let r = 0; r < rows; r++) {
      const row = bitmap[r];
      for (let c = 0; c < cols; c++) {
        if (row[c]) {
          ctx.fillRect(c * cw, r * ch, cw, ch);
        }
      }
    }
  });
</script>

<canvas bind:this={canvas} width={size} height={size} class="block bg-background {className}"></canvas>
