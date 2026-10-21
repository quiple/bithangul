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
  const internalCellWidth = $derived(width)
  const internalCellHeight = $derived(height)
  const displayCellWidth = $derived(width * 2)
  const displayCellHeight = $derived(height * 2)

  let canvas: HTMLCanvasElement = $state(undefined!)
  let containerWidth = $state(0)
  let containerHeight = $state(0)

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
  let cols = $derived(Math.max(1, Math.floor(containerWidth / displayCellWidth)))
  let rows = $derived(Math.ceil(affectedIndices.length / cols))

  let canvasWidth = $derived(cols * internalCellWidth)
  let canvasHeight = $derived(Math.max(height, rows * internalCellHeight))
  let canvasDisplayWidth = $derived(cols * displayCellWidth)
  let canvasDisplayHeight = $derived(Math.max(height * 2, rows * displayCellHeight))

  function draw() {
    if (!canvas || !previewData) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Theme surfaces may be translucent: painting over the old frame leaves ghosts.
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw glyphs
    const view = new Uint8Array(previewData)
    ctx.fillStyle = getComputedStyle(canvas).color

    for (let i = 0; i < affectedIndices.length; i++) {
      const offset = i * stride
      if (offset + stride > previewData.byteLength) continue

      const col = i % cols
      const row = Math.floor(i / cols)

      const cellX = col * internalCellWidth
      const cellY = row * internalCellHeight

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
      class="overflow-x-hidden border border-border bg-surface"
      {...observeSize((element) => {
        containerWidth = element.clientWidth
        containerHeight = element.clientHeight
      })}
    >
      <VStack width={canvasDisplayWidth} height={canvasDisplayHeight} class="relative">
        <canvas
          bind:this={canvas}
          width={canvasWidth}
          height={canvasHeight}
          class="block h-full w-full border-border bg-surface text-primary pixelated"
          aria-label="조합 글자 미리보기"
        ></canvas>
        <svg
          class="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d={[
              ...Array.from({length: cols - 1}, (_, i) => `M${(i + 1) * internalCellWidth} 0 V${canvasHeight}`),
              ...Array.from({length: rows - 1}, (_, i) => `M0 ${(i + 1) * internalCellHeight} H${canvasWidth}`),
              // Inset by half a screen pixel so the 1px stroke stays inside the SVG viewport.
              ...(canvasDisplayWidth < containerWidth
                ? [`M${canvasWidth - canvasWidth / canvasDisplayWidth / 2} 0 V${canvasHeight}`]
                : []),
              ...(canvasDisplayHeight < containerHeight
                ? [`M0 ${canvasHeight - canvasHeight / canvasDisplayHeight / 2} H${canvasWidth}`]
                : []),
            ].join(' ')}
            fill="none"
            stroke="var(--color-border)"
            stroke-width={1}
            vector-effect="non-scaling-stroke"
          />
        </svg>
      </VStack>
    </StackItem>
  {:else}<Text type="supporting">조건에 맞는 자모가 없습니다.</Text>{/if}
</VStack>
