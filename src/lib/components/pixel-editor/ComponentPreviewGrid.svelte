<script lang="ts">
  import {VStack, StackItem, Heading, Text} from '@astryx-svelte/core'

  import type {PixelComponent, ComponentType} from '#lib/types.js'

  import {flattenBitmap, bytesPerRow} from '#lib/bitmap.js'
  import {checkConditionMatch, createVariationGroupLookup, getConditionSpecificity} from '#lib/conditions.js'
  import {CHOSUNG_COUNT, JUNGSUNG_COUNT, JONGSUNG_COUNT} from '#lib/hangul.js'
  import {observeSize} from '#lib/observe-size.js'
  import {projectState} from '#lib/state.svelte.js'

  interface Props {
    component: PixelComponent
  }

  let {component}: Props = $props()

  const width = $derived(component.bitmap[0]?.length ?? 16)
  const height = $derived(component.bitmap.length)
  const rowBytes = $derived(bytesPerRow(width))
  const stride = $derived(rowBytes * height)
  const internalCellWidth = $derived(width)
  const internalCellHeight = $derived(height)
  const displayCellWidth = $derived(width * 2)
  const displayCellHeight = $derived(height * 2)

  let canvas: HTMLCanvasElement = $state(undefined!)
  let containerWidth = $state(0)
  let containerHeight = $state(0)
  let scrollTop = $state(0)
  let scrollFrame = 0

  function handleScroll(event: Event) {
    const element = event.currentTarget as HTMLElement
    if (scrollFrame) cancelAnimationFrame(scrollFrame)
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0
      scrollTop = element.scrollTop
    })
  }

  interface MatchedGlyph {
    components: PixelComponent[]
  }

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
            components: components.filter((candidate): candidate is PixelComponent => Boolean(candidate)),
          })
        }
      }
    }
    return glyphs
  })

  const glyphCount = $derived(matchedGlyphs.length)

  // Only rebuild the unchanged components when the project or matching rules change.
  const baseData = $derived.by(() => {
    const view = new Uint8Array(glyphCount * stride)
    const bitmaps = new Map<string, Uint8Array>()
    for (let i = 0; i < matchedGlyphs.length; i++) {
      for (const matched of matchedGlyphs[i].components) {
        if (matched.id === component.id) continue
        let bitmap = bitmaps.get(matched.id)
        if (!bitmap) {
          bitmap = flattenBitmap(matched.bitmap, width, height)
          bitmaps.set(matched.id, bitmap)
        }
        for (let byte = 0; byte < stride; byte++) view[i * stride + byte] |= bitmap[byte]
      }
    }
    return view
  })

  // Keep only the edited component packed; combine it with the cached base
  // at draw time, without copying every affected glyph after each stroke.
  const editedBitmap = $derived(flattenBitmap(component.bitmap, width, height))

  // Calculate layout based on container width
  let cols = $derived(Math.max(1, Math.floor(containerWidth / displayCellWidth)))
  let rows = $derived(Math.ceil(glyphCount / cols))

  const startRow = $derived(Math.max(0, Math.min(rows - 1, Math.floor(scrollTop / displayCellHeight) - 2)))
  const endRow = $derived(Math.min(rows, startRow + Math.ceil(containerHeight / displayCellHeight) + 4))
  const visibleRowCount = $derived(endRow - startRow)
  const totalDisplayHeight = $derived(rows * displayCellHeight)

  let canvasWidth = $derived(cols * internalCellWidth)
  let canvasHeight = $derived(Math.max(height, visibleRowCount * internalCellHeight))
  let canvasDisplayWidth = $derived(cols * displayCellWidth)
  let canvasDisplayHeight = $derived(Math.max(height * 2, visibleRowCount * displayCellHeight))

  function draw() {
    if (!canvas || !glyphCount) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Theme surfaces may be translucent: painting over the old frame leaves ghosts.
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw glyphs
    ctx.fillStyle = getComputedStyle(canvas).color

    for (let i = startRow * cols; i < Math.min(glyphCount, endRow * cols); i++) {
      const offset = i * stride

      const col = i % cols
      const row = Math.floor(i / cols) - startRow

      const cellX = col * internalCellWidth
      const cellY = row * internalCellHeight

      for (let r = 0; r < height; r++) {
        for (let byte = 0; byte < rowBytes; byte++) {
          const index = r * rowBytes + byte
          const pixels = baseData[offset + index] | editedBitmap[index]
          if (!pixels) continue
          const start = byte * 8
          for (let bit = 0; bit < Math.min(8, width - start); bit++) {
            if (pixels & (0x80 >> bit)) ctx.fillRect(cellX + start + bit, cellY + r, 1, 1)
          }
        }
      }
    }
  }

  import {onDestroy} from 'svelte'

  let drawFrame = 0

  $effect(() => {
    // Redraw whenever relevant dependencies change
    if (canvas && glyphCount && cols && rows && canvasWidth && canvasHeight) {
      void baseData
      void editedBitmap
      void startRow
      void endRow
      drawFrame = requestAnimationFrame(draw)
      return () => cancelAnimationFrame(drawFrame)
    }
  })

  onDestroy(() => {
    if (scrollFrame) cancelAnimationFrame(scrollFrame)
    if (canvas) {
      canvas.width = 0
      canvas.height = 0
    }
  })
</script>

<VStack minHeight={128} gap={2} class="min-w-0 flex-1">
  <Heading level={4} accessibilityLevel={3}>미리보기 ({glyphCount}자)</Heading>
  {#if glyphCount > 0}
    <StackItem
      size="fill"
      isScrollable
      onscroll={handleScroll}
      class="overflow-x-hidden border border-border bg-glyph-grid"
      {...observeSize((element) => {
        containerWidth = element.clientWidth
        containerHeight = element.clientHeight
      })}
    >
      <VStack height={startRow * displayCellHeight} aria-hidden="true" />
      <VStack width={canvasDisplayWidth} height={canvasDisplayHeight} class="relative">
        <canvas
          bind:this={canvas}
          width={canvasWidth}
          height={canvasHeight}
          class="block h-full w-full border-border text-primary pixelated"
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
              ...Array.from(
                {length: visibleRowCount - 1},
                (_, i) => `M0 ${(i + 1) * internalCellHeight} H${canvasWidth}`,
              ),
              ...(endRow < rows ? [`M0 ${canvasHeight - 0.25} H${canvasWidth}`] : []),
              // Inset by half a screen pixel so the 1px stroke stays inside the SVG viewport.
              ...(canvasDisplayWidth < containerWidth
                ? [`M${canvasWidth - canvasWidth / canvasDisplayWidth / 2} 0 V${canvasHeight}`]
                : []),
              ...(endRow === rows && totalDisplayHeight < containerHeight
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
      <VStack height={(rows - endRow) * displayCellHeight} aria-hidden="true" />
    </StackItem>
  {:else}<Text type="supporting">조건에 맞는 자모가 없습니다.</Text>{/if}
</VStack>
