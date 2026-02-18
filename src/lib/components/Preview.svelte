<script lang="ts">
  import PreviewItem from './PreviewItem.svelte'

  export let generatedData: ArrayBuffer | null = null

  // 11,172자를 28열(종성 수)로 나누면 399행
  // 각 행 = 같은 초성+중성 조합의 28가지 종성 변형
  const COLS = 28
  const TOTAL_ITEMS = 11172
  const TOTAL_ROWS = Math.ceil(TOTAL_ITEMS / COLS) // 399

  // 셀 크기: 32px 캔버스 + 1px 테두리 = 33px
  const CELL_SIZE = 33
  // 행 높이: 셀 높이 + 행 레이블 영역
  const ROW_HEIGHT = CELL_SIZE

  let scrollTop = 0
  let containerHeight = 600
  let container: HTMLDivElement

  let dataVersion = 0
  $: if (generatedData !== null) dataVersion++ // 생성 완료마다 버전 증가

  // 가상 스크롤: 보이는 행만 렌더링
  $: startRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 2)
  $: visibleRowCount = Math.ceil(containerHeight / ROW_HEIGHT) + 4
  $: endRow = Math.min(TOTAL_ROWS, startRow + visibleRowCount)
  $: visibleRows = Array.from({ length: endRow - startRow }, (_, i) => startRow + i)

  function onScroll(e: UIEvent) {
    scrollTop = (e.target as HTMLElement).scrollTop
  }

  // 행 인덱스 → 해당 행의 첫 글자 (초성+중성 조합 대표)
  function rowLabel(rowIdx: number): string {
    const firstItemIdx = rowIdx * COLS
    if (firstItemIdx >= TOTAL_ITEMS) return ''
    return String.fromCharCode(0xAC00 + firstItemIdx)
  }
</script>

<div class="h-full flex flex-col bg-background">
  <!-- 스크롤 영역 -->
  <div
    class="flex-1 overflow-y-auto overflow-x-hidden relative"
    bind:this={container}
    bind:clientHeight={containerHeight}
    on:scroll={onScroll}
  >
    <!-- 전체 높이를 잡아주는 spacer -->
    <div style="height: {TOTAL_ROWS * ROW_HEIGHT}px; position: relative;">
      {#each visibleRows as rowIdx (`${rowIdx}-${dataVersion}`)}
        {@const firstIdx = rowIdx * COLS}
        <div
          style="position: absolute; top: {rowIdx * ROW_HEIGHT}px; left: 0; right: 0; height: {ROW_HEIGHT}px;"
          class="flex items-center"
        >
          <!-- 행 레이블: 초성+중성 대표 글자 -->
          <div class="w-6 shrink-0 flex items-center justify-center h-full border-r bg-muted/30 text-xs font-bold text-muted-foreground">
            {rowLabel(rowIdx)}
          </div>

          <!-- 28개 셀 -->
          {#each { length: COLS } as _, colIdx}
            {@const itemIdx = firstIdx + colIdx}
            {#if itemIdx < TOTAL_ITEMS}
              <div
                class="flex-1 min-w-0 h-full flex items-center justify-center border-r last:border-r-0 border-b bg-white transition-colors relative overflow-hidden"
              >
                <PreviewItem index={itemIdx} data={generatedData} />
              </div>
            {:else}
              <div class="flex-1 min-w-0 h-full border-r last:border-r-0 bg-muted/20"></div>
            {/if}
          {/each}
        </div>
      {/each}
    </div>
  </div>
</div>
