<script lang="ts">
  import {VStack, HStack, StackItem, Text} from '@astryx-svelte/core'
  import {onDestroy} from 'svelte'

  import {bytesPerRow, packedPixel} from '#lib/bitmap.js'
  import {
    HANGUL_SYLLABLE_COUNT,
    JUNGSUNG_COUNT,
    JONGSUNG_COUNT,
    SYLLABLES_PER_CHOSUNG,
    composeHangul,
  } from '#lib/hangul.js'
  import {observeSize} from '#lib/observe-size.js'

  let {
    generatedData = null,
    width = 16,
    height = 16,
  }: {
    generatedData: ArrayBuffer | null
    width?: number
    height?: number
  } = $props()

  // 11,172자를 28열(종성 수)로 나누면 399행
  const COLS = JONGSUNG_COUNT
  const TOTAL_ITEMS = HANGUL_SYLLABLE_COUNT
  const TOTAL_ROWS = Math.ceil(TOTAL_ITEMS / COLS) // 399

  // 원본 비트맵과 같은 최소 해상도로 그리고 CSS에서 표시 크기만 확대합니다.
  const CANVAS_W = $derived(COLS * (width + 1) - 1)
  const CANVAS_H = $derived(height + 1)
  const stride = $derived(bytesPerRow(width) * height)

  // 행 레이블 너비 (CSS w-6 = 24px)
  const LABEL_W = 24

  let scrollTop = $state(0)
  let containerHeight = $state(600)
  let containerWidth = $state(800)

  let scrollFrame = 0
  let pendingScrollTop = 0

  let generatedView = $derived(generatedData ? new Uint8Array(generatedData) : null)

  // 패널 너비에서 레이블 너비를 빼고, 28셀에 맞게 CSS 셀 크기 계산
  let cssCanvasWidth = $derived(Math.max(1, containerWidth - LABEL_W))
  let cssRowHeight = $derived((cssCanvasWidth * CANVAS_H) / CANVAS_W)

  // 가상 스크롤: 보이는 행만 렌더링
  let startRow = $derived(Math.min(TOTAL_ROWS - 1, Math.max(0, Math.floor(scrollTop / cssRowHeight) - 2)))
  let visibleRowCount = $derived(Math.ceil(containerHeight / cssRowHeight) + 4)
  let endRow = $derived(Math.min(TOTAL_ROWS, startRow + visibleRowCount))
  let visibleRows = $derived(Array.from({length: endRow - startRow}, (_, i) => startRow + i))

  function onScroll(e: UIEvent) {
    pendingScrollTop = (e.target as HTMLElement).scrollTop
    if (scrollFrame) return
    scrollFrame = requestAnimationFrame(() => {
      scrollTop = pendingScrollTop
      scrollFrame = 0
    })
  }

  onDestroy(() => {
    if (scrollFrame) cancelAnimationFrame(scrollFrame)
  })

  // 행 인덱스 → 해당 행의 첫 글자 (초성+중성 조합 대표)
  function rowLabel(rowIdx: number): string {
    const firstItemIdx = rowIdx * COLS
    if (firstItemIdx >= TOTAL_ITEMS) return ''
    const cho = Math.floor(firstItemIdx / SYLLABLES_PER_CHOSUNG)
    const jung = Math.floor((firstItemIdx % SYLLABLES_PER_CHOSUNG) / JONGSUNG_COUNT)
    return composeHangul(cho, jung, 0)
  }

  // ── 행 단위 canvas 렌더링 (내부 해상도 고정) ──
  function drawRowCanvas(canvas: HTMLCanvasElement, rowIdx: number, view: Uint8Array | null) {
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear instead of compositing a translucent surface over the previous frame.
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
    ctx.fillStyle = getComputedStyle(canvas).borderColor
    ctx.beginPath()
    for (let col = 1; col < COLS; col++) {
      ctx.rect(col * (width + 1) - 1, 0, 1, CANVAS_H)
    }
    if (rowIdx < TOTAL_ROWS - 1) ctx.rect(0, height, CANVAS_W, 1)
    ctx.fill()

    if (!view) return
    const firstIdx = rowIdx * COLS
    ctx.fillStyle = getComputedStyle(canvas).color

    for (let col = 0; col < COLS; col++) {
      const itemIdx = firstIdx + col
      if (itemIdx >= TOTAL_ITEMS) break

      const offset = itemIdx * stride
      if (offset + stride > view.byteLength) break

      const cellX = col * (width + 1)

      for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
          if (packedPixel(view, width, r, c, offset)) {
            ctx.fillRect(cellX + c, r, 1, 1)
          }
        }
      }
    }
  }

  // canvas에 대한 action: rowIdx 또는 data가 바뀌면 다시 그림
  function rowCanvasAction(
    canvas: HTMLCanvasElement,
    params: {rowIdx: number; view: Uint8Array | null; width: number; height: number},
  ) {
    drawRowCanvas(canvas, params.rowIdx, params.view)
    return {
      update(newParams: {rowIdx: number; view: Uint8Array | null; width: number; height: number}) {
        drawRowCanvas(canvas, newParams.rowIdx, newParams.view)
      },
      destroy() {
        if (canvas) {
          canvas.width = 0
          canvas.height = 0
        }
      },
    }
  }
</script>

<VStack height="100%" class="min-h-0 bg-surface">
  <StackItem
    size="fill"
    isScrollable
    class="overflow-x-hidden"
    {...observeSize((element) => {
      containerHeight = element.clientHeight
      containerWidth = element.clientWidth
    })}
    onscroll={onScroll}
  >
    <VStack height={startRow * cssRowHeight} aria-hidden="true" />
    {#each visibleRows as rowIdx (rowIdx)}
      <HStack height={cssRowHeight}>
        <VStack width={LABEL_W} justify="center" align="center" class="shrink-0 bg-muted"
          ><Text type="supporting">{rowLabel(rowIdx)}</Text></VStack
        >
        <VStack width={cssCanvasWidth} height={cssRowHeight} class="shrink-0">
          <canvas
            use:rowCanvasAction={{rowIdx, view: generatedView, width, height}}
            width={CANVAS_W}
            height={CANVAS_H}
            class="block h-full w-full border-border bg-surface text-primary pixelated"
            aria-label={`${rowLabel(rowIdx)} 음절 미리보기`}
          ></canvas>
        </VStack>
      </HStack>
    {/each}
    <VStack height={(TOTAL_ROWS - endRow) * cssRowHeight} aria-hidden="true" />
  </StackItem>
</VStack>
