<script lang="ts">
  import {untrack} from 'svelte'

  import {FONT_ASCENT} from '#lib/font-metrics.js'

  let {
    bitmap,
    onUpdate,
  }: {
    bitmap: number[][]
    onUpdate: (newBitmap: number[][]) => void
  } = $props()

  // 내부 작업용 bitmap: 드래그 중에는 이 상태만 변이하고 onUpdate는 호출하지 않음
  // → 부모의 prop 교체가 일어나지 않아 리렌더/블링킹 없음
  let localBitmap = $state<number[][]>(untrack(() => bitmap.map((row) => [...row])))

  // 부모의 bitmap prop이 외부에서 바뀔 때만 동기화 (편집기 전환 등)
  $effect(() => {
    localBitmap = bitmap.map((row) => [...row])
  })

  const ROWS = $derived(localBitmap.length)
  const COLS = $derived(localBitmap[0]?.length ?? 0)

  let isDrawing = false
  let drawMode = 1 // 1 = draw, 0 = erase
  let containerEl: HTMLDivElement = $state(undefined!)

  // 포인터 좌표 → 그리드 셀 (r, c) 변환
  function getCellFromPointer(e: PointerEvent): {r: number; c: number} | null {
    const rect = containerEl.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const c = Math.floor((x / rect.width) * COLS)
    const r = Math.floor((y / rect.height) * ROWS)
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null
    return {r, c}
  }

  function paintPixel(r: number, c: number) {
    if (localBitmap[r][c] !== drawMode) {
      localBitmap[r][c] = drawMode
    }
  }

  function handlePointerDown(e: PointerEvent) {
    e.preventDefault()
    const cell = getCellFromPointer(e)
    if (!cell) return
    drawMode = localBitmap[cell.r][cell.c] === 1 ? 0 : 1
    isDrawing = true
    containerEl.setPointerCapture(e.pointerId)
    paintPixel(cell.r, cell.c)
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isDrawing) return
    const cell = getCellFromPointer(e)
    if (!cell) return
    paintPixel(cell.r, cell.c)
  }

  function handlePointerUp(e: PointerEvent) {
    if (!isDrawing) return
    isDrawing = false
    containerEl.releasePointerCapture(e.pointerId)
    // 드래그가 끝난 시점에 한 번만 부모에 알림
    onUpdate(localBitmap.map((row) => [...row]))
  }
</script>

<div class="w-full max-w-100">
  <div
    bind:this={containerEl}
    class="relative grid aspect-square w-full cursor-crosshair touch-none gap-px border bg-border select-none"
    style="grid-template-columns: repeat({COLS}, 1fr); grid-template-rows: repeat({ROWS}, 1fr);"
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerUp}
    oncontextmenu={(e) => e.preventDefault()}
    role="grid"
    tabindex="-1"
    aria-label="픽셀 편집 그리드. 베이스라인은 위에서 {FONT_ASCENT}행 아래에 있습니다."
  >
    {#each localBitmap as row, r}
      {#each row as cell, c}
        {@const thickR = (r + 1) % 8 === 0 && r + 1 < ROWS}
        {@const thickC = (c + 1) % 8 === 0 && c + 1 < COLS}
        <div
          class="size-full {cell ? 'bg-primary' : 'bg-background'} {thickC ? 'border-r-2 border-r-border' : ''} {thickR
            ? 'border-b-2 border-b-border'
            : ''}"
          role="gridcell"
          aria-label="Pixel {r},{c}"
        ></div>
      {/each}
    {/each}
    {#if ROWS > FONT_ASCENT}
      <div
        class="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-sky-500"
        style="grid-row: {FONT_ASCENT} / {FONT_ASCENT + 1}; bottom: -1.5px;"
        aria-hidden="true"
      ></div>
    {/if}
  </div>
  <p class="mt-2 flex items-center justify-end gap-2 text-xs text-muted-foreground">
    <span class="w-5 border-t-2 border-dashed border-sky-500" aria-hidden="true"></span>
    베이스라인 · 위에서 {FONT_ASCENT}px
  </p>
</div>
