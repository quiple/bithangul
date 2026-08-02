<script lang="ts">
  import type {PixelComponent, ComponentType} from '$lib/types'

  import {getBorderColor, flattenBitmap} from '$lib/bitmap'
  import {checkConditionMatch} from '$lib/conditions'
  import {CHOSUNG_COUNT, JUNGSUNG_COUNT, JONGSUNG_COUNT} from '$lib/hangul'
  import {projectState} from '$lib/state.svelte'

  interface Props {
    component: PixelComponent
  }

  let {component}: Props = $props()

  const INTERNAL_GLYPH = 32
  const INTERNAL_BORDER = 1
  const INTERNAL_CELL = INTERNAL_GLYPH + INTERNAL_BORDER // 33
  const PIXEL_SCALE = 2 // 16px glyph -> 32px rendering

  let canvas: HTMLCanvasElement = $state(undefined!)
  let containerWidth = $state(0)

  function matchCondition(cho: number, jung: number, jong: number, conditions: Record<string, boolean>) {
    return checkConditionMatch(cho, jung, jong, conditions, projectState.project.groups)
  }

  let previewComponents = $derived(
    projectState.project.components.map((candidate) => (candidate.id === component.id ? component : candidate)),
  )

  let componentLookup = $derived.by(() => {
    const lookup = new Map<string, PixelComponent[]>()
    for (const candidate of previewComponents) {
      const key = `${candidate.type}:${candidate.typeIndex}`
      const list = lookup.get(key) || []
      list.push(candidate)
      lookup.set(key, list)
    }
    return lookup
  })

  function getBestMatch(type: ComponentType, typeIndex: number, cho: number, jung: number, jong: number) {
    let best: PixelComponent | undefined
    let bestSpecificity = -1
    for (const candidate of componentLookup.get(`${type}:${typeIndex}`) || []) {
      if (!matchCondition(cho, jung, jong, candidate.conditions || {})) continue
      const specificity = Object.values(candidate.conditions || {}).filter(Boolean).length
      if (specificity > bestSpecificity) {
        best = candidate
        bestSpecificity = specificity
      }
    }
    return best
  }

  // Only show syllables where this variation wins over broader fallback variations.
  let affectedIndices = $derived.by(() => {
    const indices: number[] = []
    for (let cho = 0; cho < CHOSUNG_COUNT; cho++) {
      if (component.type === 'chosung' && component.typeIndex !== cho) continue
      for (let jung = 0; jung < JUNGSUNG_COUNT; jung++) {
        if (component.type === 'jungsung' && component.typeIndex !== jung) continue
        for (let jong = 0; jong < JONGSUNG_COUNT; jong++) {
          if (component.type === 'jongsung' && component.typeIndex !== jong) continue
          if (getBestMatch(component.type, component.typeIndex, cho, jung, jong)?.id === component.id) {
            indices.push(cho * 588 + jung * 28 + jong)
          }
        }
      }
    }
    return indices
  })

  // Recompose affected characters
  let previewData = $derived.by(() => {
    if (affectedIndices.length === 0) return null

    const buffer = new ArrayBuffer(affectedIndices.length * 32)
    const view = new DataView(buffer)
    const result = new Uint16Array(16)

    for (let i = 0; i < affectedIndices.length; i++) {
      const charIdx = affectedIndices[i]
      const cho = Math.floor(charIdx / 588)
      const jung = Math.floor((charIdx % 588) / 28)
      const jong = charIdx % 28

      for (let r = 0; r < 16; r++) result[r] = 0

      // Find the correctly matching components for this exact syllable
      const applyComponent = (type: ComponentType, idx: number) => {
        const matched = getBestMatch(type, idx, cho, jung, jong)
        if (matched) {
          const bmp = flattenBitmap(matched.bitmap)
          for (let r = 0; r < 16; r++) {
            result[r] |= bmp[r]
          }
        }
      }

      applyComponent('chosung', cho)
      applyComponent('jungsung', jung)
      if (jong > 0) applyComponent('jongsung', jong)

      const offset = i * 32
      for (let r = 0; r < 16; r++) {
        view.setUint16(offset + r * 2, result[r], false)
      }
    }

    return buffer
  })

  // Calculate layout based on container width
  let cols = $derived(Math.max(1, Math.floor((containerWidth - INTERNAL_CELL / 2) / INTERNAL_CELL)))
  let rows = $derived(Math.ceil(affectedIndices.length / cols))

  let canvasWidth = $derived(cols * INTERNAL_CELL + INTERNAL_BORDER)
  let canvasHeight = $derived(Math.max(INTERNAL_CELL + INTERNAL_BORDER, rows * INTERNAL_CELL + INTERNAL_BORDER))

  function draw() {
    if (!canvas || !previewData) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw grid lines
    const borderColor = getBorderColor(canvas)
    ctx.fillStyle = borderColor

    // Draw vertical lines
    for (let c = 0; c <= cols; c++) {
      ctx.fillRect(c * INTERNAL_CELL, 0, INTERNAL_BORDER, canvas.height)
    }
    // Draw horizontal lines
    for (let r = 0; r <= rows; r++) {
      ctx.fillRect(0, r * INTERNAL_CELL, canvas.width, INTERNAL_BORDER)
    }

    // Draw glyphs
    const view = new DataView(previewData)
    ctx.fillStyle = '#000'

    for (let i = 0; i < affectedIndices.length; i++) {
      const offset = i * 32
      if (offset + 32 > previewData.byteLength) continue

      const col = i % cols
      const row = Math.floor(i / cols)

      const cellX = col * INTERNAL_CELL + INTERNAL_BORDER
      const cellY = row * INTERNAL_CELL + INTERNAL_BORDER

      for (let r = 0; r < 16; r++) {
        const rowVal = view.getUint16(offset + r * 2, false)
        if (rowVal === 0) continue
        for (let c = 0; c < 16; c++) {
          if ((rowVal >> (15 - c)) & 1) {
            ctx.fillRect(cellX + c * PIXEL_SCALE, cellY + r * PIXEL_SCALE, PIXEL_SCALE, PIXEL_SCALE)
          }
        }
      }
    }
  }

  import {onDestroy} from 'svelte'

  $effect(() => {
    // Redraw whenever relevant dependencies change
    if (canvas && previewData && affectedIndices && cols && rows && canvasWidth && canvasHeight) {
      requestAnimationFrame(draw)
    }
  })

  onDestroy(() => {
    if (canvas) {
      canvas.width = 0
      canvas.height = 0
    }
  })
</script>

<div class="flex flex-col gap-2" bind:clientWidth={containerWidth}>
  <h3 class="truncate pl-2 font-medium">미리보기 ({affectedIndices.length}자)</h3>

  {#if previewData}
    <div class="h-[calc(100vh-37.75rem)] overflow-hidden rounded border bg-white" style="overflow-y: auto;">
      <canvas
        bind:this={canvas}
        width={canvasWidth}
        height={canvasHeight}
        class="-m-px block"
        style="width: {canvasWidth}px; height: {canvasHeight}px; --border-color: var(--border, #e5e5e5);"
      ></canvas>
    </div>
  {:else}
    <div class="rounded border p-4 text-center text-sm text-muted-foreground">조건에 맞는 자모가 없습니다.</div>
  {/if}
</div>
