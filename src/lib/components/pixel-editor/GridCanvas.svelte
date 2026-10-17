<script lang="ts">
  import {GripHorizontal} from '@lucide/svelte'
  import {untrack} from 'svelte'

  import {FONT_ASCENT} from '#lib/font-metrics.js'

  let {
    bitmap,
    baseline = $bindable(FONT_ASCENT),
    onUpdate,
  }: {
    bitmap: number[][]
    baseline?: number
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
  let baselineDrag: {pointerId: number; startY: number; startBaseline: number} | null = null

  function setBaseline(value: number) {
    baseline = Math.max(0, Math.min(ROWS, Math.round(value)))
  }

  function startBaselineDrag(e: PointerEvent) {
    if (e.button !== 0 || baselineDrag) return
    e.preventDefault()
    baselineDrag = {pointerId: e.pointerId, startY: e.clientY, startBaseline: baseline}
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function moveBaseline(e: PointerEvent) {
    if (!baselineDrag || e.pointerId !== baselineDrag.pointerId) return
    const pixelHeight = (containerEl.clientHeight + 1) / ROWS
    setBaseline(baselineDrag.startBaseline + (e.clientY - baselineDrag.startY) / pixelHeight)
  }

  function endBaselineDrag(e: PointerEvent) {
    if (e.pointerId !== baselineDrag?.pointerId) return
    baselineDrag = null
    const handle = e.currentTarget as HTMLElement
    if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId)
  }

  function handleBaselineKey(e: KeyboardEvent) {
    const values: Record<string, number> = {
      ArrowUp: baseline - 1,
      ArrowDown: baseline + 1,
      Home: 0,
      End: ROWS,
    }
    if (!(e.key in values)) return
    e.preventDefault()
    setBaseline(values[e.key])
  }

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

<div class="w-full py-6">
  <div class="relative mx-auto w-[calc(100%-11rem)] max-w-100">
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
      aria-label="픽셀 편집 그리드. 베이스라인은 위에서 {baseline}행 아래에 있습니다."
    >
      {#each localBitmap as row, r}
        {#each row as cell, c}
          {@const thickR = (r + 1) % 8 === 0 && r + 1 < ROWS}
          {@const thickC = (c + 1) % 8 === 0 && c + 1 < COLS}
          <div
            class="size-full {cell ? 'bg-primary' : 'bg-background'} {thickC
              ? 'border-r-2 border-r-border'
              : ''} {thickR ? 'border-b-2 border-b-border' : ''}"
            role="gridcell"
            aria-label="Pixel {r},{c}"
          ></div>
        {/each}
      {/each}
    </div>
    <div
      class="pointer-events-none absolute inset-x-0 z-10"
      style="top: calc({(baseline / ROWS) * 100}% + {0.5 - baseline / ROWS}px);"
    >
      <div class="-translate-y-1/2 border-t-2 border-dashed border-sky-500" aria-hidden="true"></div>
      <div class="absolute top-0 left-full ml-1 flex -translate-y-1/2 items-center gap-1">
        <div
          role="slider"
          tabindex="0"
          aria-label="베이스라인 위치. 위아래 방향키로 1픽셀씩 조정"
          aria-orientation="vertical"
          aria-valuemin={0}
          aria-valuemax={ROWS}
          aria-valuenow={baseline}
          aria-valuetext="위에서 {baseline}픽셀"
          class="pointer-events-auto flex size-6 shrink-0 cursor-ns-resize touch-none items-center justify-center rounded border border-sky-500 bg-background text-sky-600 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
          onpointerdown={startBaselineDrag}
          onpointermove={moveBaseline}
          onpointerup={endBaselineDrag}
          onpointercancel={endBaselineDrag}
          onlostpointercapture={endBaselineDrag}
          onkeydown={handleBaselineKey}
        >
          <GripHorizontal class="size-4" aria-hidden="true" />
        </div>
        <span class="w-14 text-[10px] leading-4 text-muted-foreground">베이스라인 ·<br />위에서 {baseline}px</span>
      </div>
    </div>
  </div>
</div>
