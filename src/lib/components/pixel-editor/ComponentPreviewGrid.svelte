<script lang="ts">
  import type {PixelComponent, ComponentType} from '#lib/types.js'

  import {getBorderColor, flattenBitmap} from '#lib/bitmap.js'
  import {checkConditionMatch, createVariationGroupLookup, getConditionSpecificity} from '#lib/conditions.js'
  import {CHOSUNG_COUNT, JUNGSUNG_COUNT, JONGSUNG_COUNT, SYLLABLES_PER_CHOSUNG} from '#lib/hangul.js'
  import {projectState} from '#lib/state.svelte.js'

  interface Props {
    component: PixelComponent
  }

  let {component}: Props = $props()

  const INTERNAL_GLYPH = 16
  const INTERNAL_BORDER = 1
  const INTERNAL_CELL = INTERNAL_GLYPH + INTERNAL_BORDER
  const DISPLAY_GLYPH = 32
  const DISPLAY_CELL = DISPLAY_GLYPH + INTERNAL_BORDER

  let canvas: HTMLCanvasElement = $state(undefined!)
  let containerWidth = $state(0)

  interface MatchedGlyph {
    index: number
    components: PixelComponent[]
  }

  const bitmapCache = new Map<string, {bitmap: number[][]; flattened: Uint16Array}>()

  let groupLookup = $derived(createVariationGroupLookup(projectState.project.groups))

  let componentLookup = $derived.by(() => {
    const lookup = new Map<string, Array<{component: PixelComponent; specificity: number}>>()
    for (const candidate of projectState.project.components) {
      const key = `${candidate.type}:${candidate.typeIndex}`
      const list = lookup.get(key) || []
      list.push({
        component: candidate,
        specificity: getConditionSpecificity(candidate.conditions || {}, projectState.project.groups, groupLookup),
      })
      lookup.set(key, list)
    }
    return lookup
  })

  function getBestMatch(type: ComponentType, typeIndex: number, cho: number, jung: number, jong: number) {
    let best: PixelComponent | undefined
    let bestSpecificity = -1
    for (const entry of componentLookup.get(`${type}:${typeIndex}`) || []) {
      if (
        !checkConditionMatch(
          cho,
          jung,
          jong,
          entry.component.conditions || {},
          projectState.project.groups,
          groupLookup,
        )
      )
        continue
      if (entry.specificity > bestSpecificity) {
        best = entry.component
        bestSpecificity = entry.specificity
      }
    }
    return best
  }

  function getFlattenedBitmap(candidate: PixelComponent) {
    const bitmap = candidate.id === component.id ? component.bitmap : candidate.bitmap
    const cached = bitmapCache.get(candidate.id)
    if (cached?.bitmap === bitmap) return cached.flattened
    const flattened = flattenBitmap(bitmap)
    bitmapCache.set(candidate.id, {bitmap, flattened})
    return flattened
  }

  // 조건 판정은 편집 중인 비트맵과 무관하므로 음절별 승자를 한 번만 계산합니다.
  let matchedGlyphs = $derived.by(() => {
    const glyphs: MatchedGlyph[] = []
    for (let cho = 0; cho < CHOSUNG_COUNT; cho++) {
      if (component.type === 'chosung' && component.typeIndex !== cho) continue
      for (let jung = 0; jung < JUNGSUNG_COUNT; jung++) {
        if (component.type === 'jungsung' && component.typeIndex !== jung) continue
        for (let jong = 0; jong < JONGSUNG_COUNT; jong++) {
          if (component.type === 'jongsung' && component.typeIndex !== jong) continue
          if (getBestMatch(component.type, component.typeIndex, cho, jung, jong)?.id !== component.id) continue

          const components = [
            getBestMatch('chosung', cho, cho, jung, jong),
            getBestMatch('jungsung', jung, cho, jung, jong),
          ]
          if (jong > 0) components.push(getBestMatch('jongsung', jong, cho, jung, jong))
          glyphs.push({
            index: cho * SYLLABLES_PER_CHOSUNG + jung * JONGSUNG_COUNT + jong,
            components: components.filter((candidate): candidate is PixelComponent => Boolean(candidate)),
          })
        }
      }
    }
    return glyphs
  })

  let affectedIndices = $derived(matchedGlyphs.map((glyph) => glyph.index))

  // Recompose affected characters
  let previewData = $derived.by(() => {
    if (affectedIndices.length === 0) return null

    const buffer = new ArrayBuffer(matchedGlyphs.length * 32)
    const view = new DataView(buffer)
    const result = new Uint16Array(16)

    for (let i = 0; i < matchedGlyphs.length; i++) {
      result.fill(0)
      for (const matched of matchedGlyphs[i].components) {
        const bitmap = getFlattenedBitmap(matched)
        for (let row = 0; row < 16; row++) result[row] |= bitmap[row]
      }

      const offset = i * 32
      for (let row = 0; row < 16; row++) view.setUint16(offset + row * 2, result[row], false)
    }

    return buffer
  })

  // Calculate layout based on container width
  let cols = $derived(Math.max(1, Math.floor((containerWidth - DISPLAY_CELL / 2) / DISPLAY_CELL)))
  let rows = $derived(Math.ceil(affectedIndices.length / cols))

  let canvasWidth = $derived(cols * INTERNAL_CELL + INTERNAL_BORDER)
  let canvasHeight = $derived(Math.max(INTERNAL_CELL + INTERNAL_BORDER, rows * INTERNAL_CELL + INTERNAL_BORDER))
  let canvasDisplayWidth = $derived(cols * DISPLAY_CELL + INTERNAL_BORDER)
  let canvasDisplayHeight = $derived(Math.max(DISPLAY_CELL + INTERNAL_BORDER, rows * DISPLAY_CELL + INTERNAL_BORDER))

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
            ctx.fillRect(cellX + c, cellY + r, 1, 1)
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
        style="width: {canvasDisplayWidth}px; height: {canvasDisplayHeight}px; --border-color: var(--border, #e5e5e5);"
      ></canvas>
    </div>
  {:else}
    <div class="rounded border p-4 text-center text-sm text-muted-foreground">조건에 맞는 자모가 없습니다.</div>
  {/if}
</div>
