<script lang="ts">
  import {VStack, StackItem, Heading, Text} from '@astryx-svelte/core'

  import type {PixelComponent, ComponentType} from '#lib/types.js'

  import {flattenBitmap, bytesPerRow, packedPixel} from '#lib/bitmap.js'
  import {checkConditionMatch, createVariationGroupLookup, getConditionSpecificity} from '#lib/conditions.js'
  import {CHOSUNG_COUNT, JUNGSUNG_COUNT, JONGSUNG_COUNT, SYLLABLES_PER_CHOSUNG} from '#lib/hangul.js'
  import {observeSize} from '#lib/observe-size.js'
  import {projectState} from '#lib/state.svelte.js'

  interface Props {
    component: PixelComponent
  }

  let {component}: Props = $props()

  const width = $derived(component.bitmap[0]?.length ?? 16)
  const height = $derived(component.bitmap.length)
  const stride = $derived(bytesPerRow(width) * height)
  const INTERNAL_BORDER = 1
  const internalCellWidth = $derived(width + INTERNAL_BORDER)
  const internalCellHeight = $derived(height + INTERNAL_BORDER)
  const displayCellWidth = $derived(width * 2 + INTERNAL_BORDER)
  const displayCellHeight = $derived(height * 2 + INTERNAL_BORDER)

  let canvas: HTMLCanvasElement = $state(undefined!)
  let containerWidth = $state(0)

  interface MatchedGlyph {
    index: number
    components: PixelComponent[]
  }

  const bitmapCache = new Map<string, {bitmap: number[][]; flattened: Uint8Array}>()

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

    const buffer = new ArrayBuffer(matchedGlyphs.length * stride)
    const view = new Uint8Array(buffer)
    const result = new Uint8Array(stride)

    for (let i = 0; i < matchedGlyphs.length; i++) {
      result.fill(0)
      for (const matched of matchedGlyphs[i].components) {
        const bitmap = getFlattenedBitmap(matched)
        for (let row = 0; row < stride; row++) result[row] |= bitmap[row]
      }

      view.set(result, i * stride)
    }

    return buffer
  })

  // Calculate layout based on container width
  let cols = $derived(Math.max(1, Math.floor((containerWidth - INTERNAL_BORDER) / displayCellWidth)))
  let rows = $derived(Math.ceil(affectedIndices.length / cols))

  let canvasWidth = $derived(cols * internalCellWidth + INTERNAL_BORDER)
  let canvasHeight = $derived(
    Math.max(internalCellHeight + INTERNAL_BORDER, rows * internalCellHeight + INTERNAL_BORDER),
  )
  let canvasDisplayWidth = $derived(cols * displayCellWidth + INTERNAL_BORDER)
  let canvasDisplayHeight = $derived(
    Math.max(displayCellHeight + INTERNAL_BORDER, rows * displayCellHeight + INTERNAL_BORDER),
  )

  function draw() {
    if (!canvas || !previewData) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = getComputedStyle(canvas).backgroundColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw grid lines
    const borderColor = getComputedStyle(canvas).borderColor
    ctx.fillStyle = borderColor

    // Draw vertical lines
    for (let c = 0; c <= cols; c++) {
      ctx.fillRect(c * internalCellWidth, 0, INTERNAL_BORDER, canvas.height)
    }
    // Draw horizontal lines
    for (let r = 0; r <= rows; r++) {
      ctx.fillRect(0, r * internalCellHeight, canvas.width, INTERNAL_BORDER)
    }

    // Draw glyphs
    const view = new Uint8Array(previewData)
    ctx.fillStyle = getComputedStyle(canvas).color

    for (let i = 0; i < affectedIndices.length; i++) {
      const offset = i * stride
      if (offset + stride > previewData.byteLength) continue

      const col = i % cols
      const row = Math.floor(i / cols)

      const cellX = col * internalCellWidth + INTERNAL_BORDER
      const cellY = row * internalCellHeight + INTERNAL_BORDER

      for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
          if (packedPixel(view, width, r, c, offset)) {
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

<VStack minHeight={128} gap={2} class="min-w-0 flex-1">
  <Heading level={4} accessibilityLevel={3}>미리보기 ({affectedIndices.length}자)</Heading>
  {#if previewData}
    <StackItem
      size="fill"
      isScrollable
      class="overflow-x-hidden rounded-lg border border-border bg-surface"
      {...observeSize((element) => (containerWidth = element.clientWidth))}
    >
      <VStack width={canvasDisplayWidth} height={canvasDisplayHeight}>
        <canvas
          bind:this={canvas}
          width={canvasWidth}
          height={canvasHeight}
          class="block h-full w-full border-border bg-surface text-primary pixelated"
          aria-label="조합 글자 미리보기"
        ></canvas>
      </VStack>
    </StackItem>
  {:else}<Text type="supporting">조건에 맞는 자모가 없습니다.</Text>{/if}
</VStack>
