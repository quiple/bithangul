<script lang="ts">
  import {getBorderColor} from '$lib/bitmap'
  import {composeHangul} from '$lib/hangul'

  let {
    generatedData = null,
  }: {
    generatedData: ArrayBuffer | null
  } = $props()

  // 11,172자를 28열(종성 수)로 나누면 399행
  const COLS = 28
  const TOTAL_ITEMS = 11172
  const TOTAL_ROWS = Math.ceil(TOTAL_ITEMS / COLS) // 399

  // canvas 내부 해상도 (고정, 고해상도)
  // 각 셀: 32px 글리프 + 1px 격자선 = 33px
  const INTERNAL_GLYPH = 32
  const INTERNAL_BORDER = 1
  const INTERNAL_CELL = INTERNAL_GLYPH + INTERNAL_BORDER // 33
  const CANVAS_W = COLS * INTERNAL_CELL + INTERNAL_BORDER // 925
  const CANVAS_H = INTERNAL_CELL + INTERNAL_BORDER // 34

  // 행 레이블 너비 (CSS w-6 = 24px)
  const LABEL_W = 24

  let scrollTop = $state(0)
  let containerHeight = $state(600)
  let containerWidth = $state(800)
  let container: HTMLDivElement = $state(undefined!)

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
    scrollTop = (e.target as HTMLElement).scrollTop
  }

  // 행 인덱스 → 해당 행의 첫 글자 (초성+중성 조합 대표)
  function rowLabel(rowIdx: number): string {
    const firstItemIdx = rowIdx * COLS
    if (firstItemIdx >= TOTAL_ITEMS) return ''
    const cho = Math.floor(firstItemIdx / (21 * 28))
    const jung = Math.floor((firstItemIdx % (21 * 28)) / 28)
    return composeHangul(cho, jung, 0)
  }

  // ── 행 단위 canvas 렌더링 (내부 해상도 고정) ──
  function drawRowCanvas(canvas: HTMLCanvasElement, rowIdx: number, data: ArrayBuffer | null) {
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 배경 (흰색)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    // 격자선 그리기
    const borderColor = getBorderColor(canvas)
    ctx.fillStyle = borderColor

    // 세로 격자선 (셀 사이)
    for (let col = 0; col <= COLS; col++) {
      ctx.fillRect(col * INTERNAL_CELL, 0, INTERNAL_BORDER, CANVAS_H)
    }
    // 가로 격자선 (하단)
    ctx.fillRect(0, INTERNAL_GLYPH, CANVAS_W, INTERNAL_BORDER)

    if (!data) return

    const view = new DataView(data)
    const firstIdx = rowIdx * COLS
    const pixelScale = 2 // 16px 글리프 → 32px 내부 렌더링

    ctx.fillStyle = '#000'

    for (let col = 0; col < COLS; col++) {
      const itemIdx = firstIdx + col
      if (itemIdx >= TOTAL_ITEMS) break

      const offset = itemIdx * 32
      if (offset + 32 > data.byteLength) break

      // 셀 내부 시작 좌표 (격자선 이후)
      const cellX = col * INTERNAL_CELL + INTERNAL_BORDER

      for (let r = 0; r < 16; r++) {
        const rowVal = view.getUint16(offset + r * 2, false)
        if (rowVal === 0) continue
        for (let c = 0; c < 16; c++) {
          if ((rowVal >> (15 - c)) & 1) {
            ctx.fillRect(cellX + c * pixelScale, r * pixelScale, pixelScale, pixelScale)
          }
        }
      }
    }
  }

  // canvas에 대한 action: rowIdx 또는 data가 바뀌면 다시 그림
  function rowCanvasAction(canvas: HTMLCanvasElement, params: {rowIdx: number; data: ArrayBuffer | null}) {
    drawRowCanvas(canvas, params.rowIdx, params.data)
    return {
      update(newParams: {rowIdx: number; data: ArrayBuffer | null}) {
        drawRowCanvas(canvas, newParams.rowIdx, newParams.data)
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

          <!-- 행 전체를 하나의 canvas로 렌더링, CSS로 패널 너비에 맞게 스케일링 -->
          <canvas
            use:rowCanvasAction={{rowIdx, data: generatedData}}
            width={CANVAS_W}
            height={CANVAS_H}
            style="width: {cssCanvasWidth}px; height: {cssRowHeight}px; --border-color: var(--border, #e5e5e5);"
            class="block"
          ></canvas>
        </div>
      {/each}
    </div>
  </div>
</div>
