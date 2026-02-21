<script lang="ts">
    import { projectState } from '$lib/state.svelte';
    import type { PixelComponent } from '$lib/types';

    interface Props {

    component: PixelComponent;
  }

  let { component }: Props = $props();

  const INTERNAL_GLYPH = 32;
  const INTERNAL_BORDER = 1;
  const INTERNAL_CELL = INTERNAL_GLYPH + INTERNAL_BORDER; // 33
  const PIXEL_SCALE = 2; // 16px glyph -> 32px rendering

  let canvas: HTMLCanvasElement = $state(undefined!);
  let containerWidth = $state(0);

  // Flatten bitmap helper
  function flattenBitmap(bitmap: number[][]): Uint16Array {
    const arr = new Uint16Array(16);
    for (let r = 0; r < 16; r++) {
      let val = 0;
      for (let c = 0; c < 16; c++) {
        if (bitmap[r][c]) {
          val |= 1 << (15 - c); // MSB at index 0
        }
      }
      arr[r] = val;
    }
    return arr;
  }

  // Calculate affected indices based on component targets
  let affectedIndices = $derived.by(() => {
    const indices: number[] = [];
    const { type, typeIndex, targets } = component;

    const chosungs = [...targets.chosung].sort((a, b) => a - b);
    const jungsungs = [...targets.jungsung].sort((a, b) => a - b);
    const jongsungs = [...targets.jongsung].sort((a, b) => a - b);

    if (type === 'chosung') {
      const cho = typeIndex;
      for (const jung of jungsungs) {
        for (const jong of jongsungs) {
          indices.push(cho * 588 + jung * 28 + jong);
        }
      }
    } else if (type === 'jungsung') {
      const jung = typeIndex;
      for (const cho of chosungs) {
        for (const jong of jongsungs) {
          indices.push(cho * 588 + jung * 28 + jong);
        }
      }
    } else if (type === 'jongsung') {
      const jong = typeIndex;
      for (const cho of chosungs) {
        for (const jung of jungsungs) {
          indices.push(cho * 588 + jung * 28 + jong);
        }
      }
    }
    return indices;
  });

  // Recompose affected characters
  let previewData = $derived.by(() => {
    if (affectedIndices.length === 0) return null;

    const buffer = new ArrayBuffer(affectedIndices.length * 32);
    const view = new DataView(buffer);
    const result = new Uint16Array(16);

    // Pre-process components
    // We need to use 'component' instead of the one in projectState if IDs match
    const components = projectState.project.components.map(c =>
      c.id === component.id ? component : c
    );

    // Optimize: pre-calculate masks and flattened bitmaps for all components
    const compCount = components.length;
    const compBitmaps = new Array(compCount);
    const compChoMask = new Uint32Array(compCount);
    const compJungMask = new Uint32Array(compCount);
    const compJongMask = new Uint32Array(compCount);

    for (let ci = 0; ci < compCount; ci++) {
      const comp = components[ci];
      compBitmaps[ci] = flattenBitmap(comp.bitmap);

      let choMask = 0;
      for (const idx of comp.targets.chosung) choMask |= 1 << idx;
      compChoMask[ci] = choMask;

      let jungMask = 0;
      for (const idx of comp.targets.jungsung) jungMask |= 1 << idx;
      compJungMask[ci] = jungMask;

      let jongMask = 0;
      for (const idx of comp.targets.jongsung) jongMask |= 1 << idx;
      compJongMask[ci] = jongMask;
    }

    for (let i = 0; i < affectedIndices.length; i++) {
      const charIdx = affectedIndices[i];
      const cho = Math.floor(charIdx / 588);
      const jung = Math.floor((charIdx % 588) / 28);
      const jong = charIdx % 28;

      const choBit = 1 << cho;
      const jungBit = 1 << jung;
      const jongBit = 1 << jong;

      // Reset result
      for (let r = 0; r < 16; r++) result[r] = 0;

      for (let ci = 0; ci < compCount; ci++) {
        if (compChoMask[ci] & choBit && compJungMask[ci] & jungBit && compJongMask[ci] & jongBit) {
          const bmp = compBitmaps[ci];
          for (let r = 0; r < 16; r++) {
            result[r] |= bmp[r];
          }
        }
      }

      const offset = i * 32;
      for (let r = 0; r < 16; r++) {
        view.setUint16(offset + r * 2, result[r], false);
      }
    }

    return buffer;
  });

  // Calculate layout based on container width
  let cols = $derived(Math.max(1, Math.floor((containerWidth - INTERNAL_BORDER) / INTERNAL_CELL)));
  let rows = $derived(Math.ceil(affectedIndices.length / cols));

  let canvasWidth = $derived(cols * INTERNAL_CELL + INTERNAL_BORDER);
  let canvasHeight = $derived(Math.max(INTERNAL_CELL + INTERNAL_BORDER, rows * INTERNAL_CELL + INTERNAL_BORDER));

  // Determine border color from CSS variable
  function getBorderColor(canvas: HTMLCanvasElement): string {
    const style = getComputedStyle(canvas);
    return style.getPropertyValue('--border-color').trim() || '#e5e5e5';
  }

  function draw() {
    if (!canvas || !previewData) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines
    const borderColor = getBorderColor(canvas);
    ctx.fillStyle = borderColor;

    // Draw vertical lines
    for (let c = 0; c <= cols; c++) {
      ctx.fillRect(c * INTERNAL_CELL, 0, INTERNAL_BORDER, canvas.height);
    }
    // Draw horizontal lines
    for (let r = 0; r <= rows; r++) {
      ctx.fillRect(0, r * INTERNAL_CELL, canvas.width, INTERNAL_BORDER);
    }

    // Draw glyphs
    const view = new DataView(previewData);
    ctx.fillStyle = '#000';

    for (let i = 0; i < affectedIndices.length; i++) {
      const offset = i * 32;
      if (offset + 32 > previewData.byteLength) continue;

      const col = i % cols;
      const row = Math.floor(i / cols);

      const cellX = col * INTERNAL_CELL + INTERNAL_BORDER;
      const cellY = row * INTERNAL_CELL + INTERNAL_BORDER;

      for (let r = 0; r < 16; r++) {
        const rowVal = view.getUint16(offset + r * 2, false);
        if (rowVal === 0) continue;
        for (let c = 0; c < 16; c++) {
          if ((rowVal >> (15 - c)) & 1) {
            ctx.fillRect(cellX + c * PIXEL_SCALE, cellY + r * PIXEL_SCALE, PIXEL_SCALE, PIXEL_SCALE);
          }
        }
      }
    }
  }

  $effect(() => {
    // Redraw whenever relevant dependencies change
    if (canvas && previewData && affectedIndices && cols && rows && canvasWidth && canvasHeight) {
       requestAnimationFrame(draw);
    }
  });
</script>

<div
  class="w-full flex flex-col gap-2 mt-4"
  bind:clientWidth={containerWidth}
>
  <div class="flex justify-between items-center">
    <h3 class="font-bold text-sm">미리보기 ({affectedIndices.length}자)</h3>
  </div>

  {#if previewData}
    <div
      class="border rounded overflow-hidden bg-white"
      style="height: {canvasHeight}px; overflow-y: auto;"
    >
      <canvas
        bind:this={canvas}
        width={canvasWidth}
        height={canvasHeight}
        class="block"
        style="width: {canvasWidth}px; height: {canvasHeight}px; --border-color: var(--border, #e5e5e5);"
      ></canvas>
    </div>
  {:else}
    <div class="text-sm text-muted-foreground p-4 border rounded-md text-center bg-muted/20">
      데이터 생성 대기 중...
    </div>
  {/if}
</div>
