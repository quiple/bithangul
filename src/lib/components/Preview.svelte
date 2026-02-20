<script lang="ts">
  import { composeHangul } from '$lib/hangul';

  let {
    generatedData = null,
  }: {
    generatedData: ArrayBuffer | null;
  } = $props();

  // 11,172자를 28열(종성 수)로 나누면 399행
  const COLS = 28;
  const TOTAL_ITEMS = 11172;
  const TOTAL_ROWS = Math.ceil(TOTAL_ITEMS / COLS); // 399

  // 셀 내부 크기: 16px × 2배율 = 32px
  const PIXEL_SCALE = 2;
  const GLYPH_SIZE = 16 * PIXEL_SCALE; // 32px
  // 격자선 두께
  const BORDER = 1;
  // 셀 크기: 글리프 + 격자선
  const CELL_SIZE = GLYPH_SIZE + BORDER; // 33px
  const ROW_HEIGHT = CELL_SIZE;

  // canvas 내부 해상도
  const CANVAS_W = COLS * CELL_SIZE + BORDER; // 좌측 첫 격자선 포함
  const CANVAS_H = ROW_HEIGHT + BORDER;

  let scrollTop = $state(0);
  let containerHeight = $state(600);
  let container: HTMLDivElement = $state(undefined!);

  // 가상 스크롤: 보이는 행만 렌더링
  let startRow = $derived(Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 2));
  let visibleRowCount = $derived(Math.ceil(containerHeight / ROW_HEIGHT) + 4);
  let endRow = $derived(Math.min(TOTAL_ROWS, startRow + visibleRowCount));
  let visibleRows = $derived(Array.from({ length: endRow - startRow }, (_, i) => startRow + i));

  function onScroll(e: UIEvent) {
    scrollTop = (e.target as HTMLElement).scrollTop;
  }

  // 행 인덱스 → 해당 행의 첫 글자 (초성+중성 조합 대표)
  function rowLabel(rowIdx: number): string {
    const firstItemIdx = rowIdx * COLS;
    if (firstItemIdx >= TOTAL_ITEMS) return '';
    const cho = Math.floor(firstItemIdx / (21 * 28));
    const jung = Math.floor((firstItemIdx % (21 * 28)) / 28);
    return composeHangul(cho, jung, 0);
  }

  // CSS 변수에서 border 색상을 읽어옴
  function getBorderColor(canvas: HTMLCanvasElement): string {
    const style = getComputedStyle(canvas);
    return style.getPropertyValue('--border-color').trim() || '#e5e5e5';
  }

  // ── 행 단위 canvas 렌더링 ──
  function drawRowCanvas(canvas: HTMLCanvasElement, rowIdx: number, data: ArrayBuffer | null) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 배경 (흰색)
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // 격자선 그리기
    const borderColor = getBorderColor(canvas);
    ctx.fillStyle = borderColor;

    // 세로 격자선 (셀 사이)
    for (let col = 0; col <= COLS; col++) {
      ctx.fillRect(col * CELL_SIZE, 0, BORDER, CANVAS_H);
    }
    // 가로 격자선 (하단)
    ctx.fillRect(0, GLYPH_SIZE, CANVAS_W, BORDER);

    if (!data) return;

    const view = new DataView(data);
    const firstIdx = rowIdx * COLS;

    ctx.fillStyle = '#000';

    for (let col = 0; col < COLS; col++) {
      const itemIdx = firstIdx + col;
      if (itemIdx >= TOTAL_ITEMS) break;

      const offset = itemIdx * 32;
      if (offset + 32 > data.byteLength) break;

      // 셀 내부 시작 좌표 (격자선 이후)
      const cellX = col * CELL_SIZE + BORDER;

      for (let r = 0; r < 16; r++) {
        const rowVal = view.getUint16(offset + r * 2, false);
        if (rowVal === 0) continue;
        for (let c = 0; c < 16; c++) {
          if ((rowVal >> (15 - c)) & 1) {
            ctx.fillRect(cellX + c * PIXEL_SCALE, r * PIXEL_SCALE, PIXEL_SCALE, PIXEL_SCALE);
          }
        }
      }
    }
  }

  // canvas에 대한 action: rowIdx 또는 data가 바뀌면 다시 그림
  function rowCanvasAction(canvas: HTMLCanvasElement, params: { rowIdx: number; data: ArrayBuffer | null }) {
    drawRowCanvas(canvas, params.rowIdx, params.data);
    return {
      update(newParams: { rowIdx: number; data: ArrayBuffer | null }) {
        drawRowCanvas(canvas, newParams.rowIdx, newParams.data);
      },
    };
  }
</script>

<div class="h-full flex flex-col bg-background">
  <!-- 스크롤 영역 -->
  <div
    class="flex-1 overflow-auto relative"
    bind:this={container}
    bind:clientHeight={containerHeight}
    onscroll={onScroll}
  >
    <!-- 전체 높이를 잡아주는 spacer -->
    <div style="height: {TOTAL_ROWS * ROW_HEIGHT}px; position: relative; min-width: fit-content;">
      {#each visibleRows as rowIdx (rowIdx)}
        <div
          style="position: absolute; top: {rowIdx * ROW_HEIGHT}px; left: 0; height: {ROW_HEIGHT}px;"
          class="flex items-center"
        >
          <!-- 행 레이블: 초성+중성 대표 글자 -->
          <div
            class="w-6 shrink-0 flex items-center justify-center h-full border-r bg-muted/30 text-xs font-bold text-muted-foreground"
          >
            {rowLabel(rowIdx)}
          </div>

          <!-- 행 전체를 하나의 canvas로 렌더링 (고정 크기, 비율 유지) -->
          <canvas
            use:rowCanvasAction={{ rowIdx, data: generatedData }}
            width={CANVAS_W}
            height={CANVAS_H}
            style="width: {CANVAS_W}px; height: {CANVAS_H}px; image-rendering: pixelated; --border-color: var(--border, #e5e5e5);"
            class="block shrink-0"
          ></canvas>
        </div>
      {/each}
    </div>
  </div>
</div>
