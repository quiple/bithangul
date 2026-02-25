<script lang="ts">
  import { projectState } from '$lib/state.svelte';
  import type { PixelComponent, ComponentType } from '$lib/types';
  import { CHOSUNG_COUNT, JUNGSUNG_COUNT, JONGSUNG_COUNT } from '$lib/hangul';
  import { getBorderColor, flattenBitmap } from '$lib/bitmap';
  import { checkConditionMatch } from '$lib/conditions';

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

  function matchCondition(cho: number, jung: number, jong: number, conditions: Record<string, boolean>) {
    return checkConditionMatch(cho, jung, jong, conditions, projectState.project.groups);
  }

  // Calculate affected indices based on component conditions
  let affectedIndices = $derived.by(() => {
    const indices: number[] = [];
    const { type, typeIndex, conditions } = component;

    if (type === 'chosung') {
      const cho = typeIndex;
      for (let jung = 0; jung < JUNGSUNG_COUNT; jung++) {
        for (let jong = 0; jong < JONGSUNG_COUNT; jong++) {
          if (matchCondition(cho, jung, jong, conditions)) {
            indices.push(cho * 588 + jung * 28 + jong);
          }
        }
      }
    } else if (type === 'jungsung') {
      const jung = typeIndex;
      for (let cho = 0; cho < CHOSUNG_COUNT; cho++) {
        for (let jong = 0; jong < JONGSUNG_COUNT; jong++) {
          if (matchCondition(cho, jung, jong, conditions)) {
            indices.push(cho * 588 + jung * 28 + jong);
          }
        }
      }
    } else if (type === 'jongsung') {
      const jong = typeIndex;
      for (let cho = 0; cho < CHOSUNG_COUNT; cho++) {
        for (let jung = 0; jung < JUNGSUNG_COUNT; jung++) {
          if (matchCondition(cho, jung, jong, conditions)) {
            indices.push(cho * 588 + jung * 28 + jong);
          }
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

    const components = projectState.project.components.map((c) => (c.id === component.id ? component : c));

    // Group components by type+typeIndex for fast lookup
    const lookup = new Map<string, PixelComponent[]>();
    for (const c of components) {
      const key = `${c.type}:${c.typeIndex}`;
      let list = lookup.get(key);
      if (!list) {
        list = [];
        lookup.set(key, list);
      }
      list.push(c);
    }

    for (let i = 0; i < affectedIndices.length; i++) {
      const charIdx = affectedIndices[i];
      const cho = Math.floor(charIdx / 588);
      const jung = Math.floor((charIdx % 588) / 28);
      const jong = charIdx % 28;

      for (let r = 0; r < 16; r++) result[r] = 0;

      // Find the correctly matching components for this exact syllable
      const applyComponent = (type: ComponentType, idx: number) => {
        const list = lookup.get(`${type}:${idx}`) || [];
        const matched = list.find((c) => matchCondition(cho, jung, jong, c.conditions));
        if (matched) {
          const bmp = flattenBitmap(matched.bitmap);
          for (let r = 0; r < 16; r++) {
            result[r] |= bmp[r];
          }
        }
      };

      applyComponent('chosung', cho);
      applyComponent('jungsung', jung);
      if (jong > 0) applyComponent('jongsung', jong);

      const offset = i * 32;
      for (let r = 0; r < 16; r++) {
        view.setUint16(offset + r * 2, result[r], false);
      }
    }

    return buffer;
  });

  // Calculate layout based on container width
  let cols = $derived(Math.max(1, Math.floor((containerWidth - INTERNAL_CELL / 2) / INTERNAL_CELL)));
  let rows = $derived(Math.ceil(affectedIndices.length / cols));

  let canvasWidth = $derived(cols * INTERNAL_CELL + INTERNAL_BORDER);
  let canvasHeight = $derived(Math.max(INTERNAL_CELL + INTERNAL_BORDER, rows * INTERNAL_CELL + INTERNAL_BORDER));

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

  import { onDestroy } from 'svelte';

  $effect(() => {
    // Redraw whenever relevant dependencies change
    if (canvas && previewData && affectedIndices && cols && rows && canvasWidth && canvasHeight) {
      requestAnimationFrame(draw);
    }
  });

  onDestroy(() => {
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  });
</script>

<div class="flex flex-col gap-2" bind:clientWidth={containerWidth}>
  <h3 class="pl-2 font-medium truncate">미리보기 ({affectedIndices.length}자)</h3>

  {#if previewData}
    <div class="border rounded overflow-hidden bg-white h-[calc(100vh-37.75rem)]" style="overflow-y: auto;">
      <canvas
        bind:this={canvas}
        width={canvasWidth}
        height={canvasHeight}
        class="block -m-px"
        style="width: {canvasWidth}px; height: {canvasHeight}px; --border-color: var(--border, #e5e5e5);"
      ></canvas>
    </div>
  {:else}
    <div class="text-sm text-muted-foreground p-4 border rounded text-center">조건에 맞는 자모가 없습니다.</div>
  {/if}
</div>
