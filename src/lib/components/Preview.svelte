<script lang="ts">
  import {onDestroy} from 'svelte'

  import {
    HANGUL_SYLLABLE_COUNT,
    JUNGSUNG_COUNT,
    JONGSUNG_COUNT,
    SYLLABLES_PER_CHOSUNG,
    composeHangul,
  } from '#lib/hangul.js'

  let {
    generatedData = null,
  }: {
    generatedData: ArrayBuffer | null
  } = $props()

  // 11,172자를 28열(종성 수)로 나누면 399행
  const COLS = JONGSUNG_COUNT
  const TOTAL_ITEMS = HANGUL_SYLLABLE_COUNT
  const TOTAL_ROWS = Math.ceil(TOTAL_ITEMS / COLS) // 399

  // 원본 비트맵과 같은 최소 해상도로 그리고 CSS에서 표시 크기만 확대합니다.
  const INTERNAL_GLYPH = 16
  const CANVAS_W = COLS * INTERNAL_GLYPH
  const CANVAS_H = INTERNAL_GLYPH

  // 행 레이블 너비 (CSS w-6 = 24px)
  const LABEL_W = 24

  let scrollTop = $state(0)
  let containerHeight = $state(600)
  let containerWidth = $state(800)
  let container: HTMLDivElement = $state(undefined!)
  let scrollFrame = 0
  let pendingScrollTop = 0

  let generatedView = $derived(generatedData ? new DataView(generatedData) : null)

  // 패널 너비에서 레이블 너비를 빼고, 28셀에 맞게 CSS 셀 크기 계산
  let cssCanvasWidth = $derived(containerWidth - LABEL_W)
  let cssCellSize = $derived(cssCanvasWidth / COLS)
  let cssRowHeight = $derived(cssCellSize)

  // 가상 스크롤: 보이는 행만 렌더링
  let startRow = $derived(Math.max(0, Math.floor(scrollTop / cssRowHeight) - 2))
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
  function drawRowCanvas(canvas: HTMLCanvasElement, rowIdx: number, view: DataView | null) {
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 배경 (흰색)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    if (!view) return
    const firstIdx = rowIdx * COLS
    ctx.fillStyle = '#000'

    for (let col = 0; col < COLS; col++) {
      const itemIdx = firstIdx + col
      if (itemIdx >= TOTAL_ITEMS) break

      const offset = itemIdx * 32
      if (offset + 32 > view.byteLength) break

      const cellX = col * INTERNAL_GLYPH

      for (let r = 0; r < 16; r++) {
        const rowVal = view.getUint16(offset + r * 2, false)
        if (rowVal === 0) continue
        for (let c = 0; c < 16; c++) {
          if ((rowVal >> (15 - c)) & 1) {
            ctx.fillRect(cellX + c, r, 1, 1)
          }
        }
      }
    }
  }

  // canvas에 대한 action: rowIdx 또는 data가 바뀌면 다시 그림
  function rowCanvasAction(canvas: HTMLCanvasElement, params: {rowIdx: number; view: DataView | null}) {
    drawRowCanvas(canvas, params.rowIdx, params.view)
    return {
      update(newParams: {rowIdx: number; view: DataView | null}) {
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

<div class="flex h-full flex-col bg-background">
  <!-- 스크롤 영역 -->
  <div
    class="relative flex-1 overflow-x-hidden overflow-y-auto"
    bind:this={container}
    bind:clientHeight={containerHeight}
    bind:clientWidth={containerWidth}
    onscroll={onScroll}
  >
    <!-- 전체 높이를 잡아주는 spacer -->
    <div style="height: {TOTAL_ROWS * cssRowHeight}px; position: relative;">
      {#each visibleRows as rowIdx (rowIdx)}
        <div
          style="position: absolute; top: {rowIdx * cssRowHeight}px; left: 0; right: 0; height: {cssRowHeight}px;"
          class="flex items-stretch"
        >
          <!-- 행 레이블: 초성+중성 대표 글자 -->
          <div
            class="flex shrink-0 items-center justify-center bg-muted/30 text-xs font-bold text-muted-foreground"
            style="width: {LABEL_W}px;"
          >
            {rowLabel(rowIdx)}
          </div>

          <!-- 글리프는 최소 해상도 canvas에, 1px 격자선은 CSS 오버레이에 렌더링 -->
          <div class="relative shrink-0" style="width: {cssCanvasWidth}px; height: {cssRowHeight}px;">
            <canvas
              use:rowCanvasAction={{rowIdx, view: generatedView}}
              width={CANVAS_W}
              height={CANVAS_H}
              class="block h-full w-full"
            ></canvas>
            <div
              aria-hidden="true"
              class="pointer-events-none absolute inset-0 border-border"
              class:border-b={rowIdx < TOTAL_ROWS - 1}
              style="background-image: repeating-linear-gradient(to right, var(--border) 0 1px, transparent 1px {cssCellSize}px);"
            ></div>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>
