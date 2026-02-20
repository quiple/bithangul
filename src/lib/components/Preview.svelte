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

  // 셀 크기: 32px 캔버스 + 1px 테두리 = 33px
  const CELL_SIZE = 33;
  const ROW_HEIGHT = CELL_SIZE;

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

  // ── 행 단위 canvas 렌더링 (개별 PreviewItem × 28 → canvas × 1) ──
  // 한 행의 28셀을 하나의 canvas에 일괄 렌더링하여 DOM 노드 수 대폭 감소
  function drawRowCanvas(canvas: HTMLCanvasElement, rowIdx: number, data: ArrayBuffer | null) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasW = COLS * CELL_SIZE;
    ctx.clearRect(0, 0, canvasW, ROW_HEIGHT);

    if (!data) return;

    const view = new DataView(data);
    const firstIdx = rowIdx * COLS;
    const pixelScale = 2;

    ctx.fillStyle = '#000';

    for (let col = 0; col < COLS; col++) {
      const itemIdx = firstIdx + col;
      if (itemIdx >= TOTAL_ITEMS) break;

      const offset = itemIdx * 32;
      if (offset + 32 > data.byteLength) break;

      const cellX = col * CELL_SIZE;

      for (let r = 0; r < 16; r++) {
        const rowVal = view.getUint16(offset + r * 2, false);
        if (rowVal === 0) continue; // 빈 행 빠르게 건너뜀
        for (let c = 0; c < 16; c++) {
          if ((rowVal >> (15 - c)) & 1) {
            ctx.fillRect(cellX + c * pixelScale, r * pixelScale, pixelScale, pixelScale);
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
    class="flex-1 overflow-y-auto overflow-x-hidden relative"
    bind:this={container}
    bind:clientHeight={containerHeight}
    onscroll={onScroll}
  >
    <!-- 전체 높이를 잡아주는 spacer -->
    <div style="height: {TOTAL_ROWS * ROW_HEIGHT}px; position: relative;">
      {#each visibleRows as rowIdx (rowIdx)}
        <div
          style="position: absolute; top: {rowIdx * ROW_HEIGHT}px; left: 0; right: 0; height: {ROW_HEIGHT}px;"
          class="flex items-center"
        >
          <!-- 행 레이블: 초성+중성 대표 글자 -->
          <div
            class="w-6 shrink-0 flex items-center justify-center h-full border-r bg-muted/30 text-xs font-bold text-muted-foreground"
          >
            {rowLabel(rowIdx)}
          </div>

          <!-- 행 전체를 하나의 canvas로 렌더링 -->
          <canvas
            use:rowCanvasAction={{ rowIdx, data: generatedData }}
            width={COLS * CELL_SIZE}
            height={ROW_HEIGHT}
            class="block flex-1 min-w-0 h-full"
            style="image-rendering: pixelated;"
          ></canvas>
        </div>
      {/each}
    </div>
  </div>
</div>
