<script lang="ts">
  import {VStack} from '@astryx-svelte/core'
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
  let containerEl: SVGSVGElement = $state(undefined!)
  let baselineDrag: {pointerId: number; startY: number; startBaseline: number} | null = null

  function setBaseline(value: number) {
    baseline = Math.max(0, Math.min(ROWS, Math.round(value)))
  }

  function startBaselineDrag(e: PointerEvent) {
    if (e.button !== 0 || baselineDrag) return
    e.preventDefault()
    baselineDrag = {pointerId: e.pointerId, startY: e.clientY, startBaseline: baseline}
    ;(e.currentTarget as SVGElement).setPointerCapture(e.pointerId)
  }

  function moveBaseline(e: PointerEvent) {
    if (!baselineDrag || e.pointerId !== baselineDrag.pointerId) return
    const pixelHeight = containerEl.getBoundingClientRect().height / ROWS
    setBaseline(baselineDrag.startBaseline + (e.clientY - baselineDrag.startY) / pixelHeight)
  }

  function endBaselineDrag(e: PointerEvent) {
    if (e.pointerId !== baselineDrag?.pointerId) return
    baselineDrag = null
    const handle = e.currentTarget as SVGElement
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

<!-- Pixel coordinates are drawing geometry, independent of UI spacing tokens. Equal gutters keep the bitmap centered. -->
<VStack width="100%" align="center" paddingBlock={4}>
  <VStack width="100%" maxWidth={600}>
    <svg
      viewBox={`-104 -24 ${COLS * 24 + 208} ${ROWS * 24 + 48}`}
      width="100%"
      class="overflow-visible select-none"
      aria-label="픽셀 편집기"
    >
      <svg
        bind:this={containerEl}
        x={0}
        y={0}
        width={COLS * 24}
        height={ROWS * 24}
        viewBox={`0 0 ${COLS * 24} ${ROWS * 24}`}
        class="cursor-crosshair touch-none"
        onpointerdown={handlePointerDown}
        onpointermove={handlePointerMove}
        onpointerup={handlePointerUp}
        onpointercancel={handlePointerUp}
        oncontextmenu={(e) => e.preventDefault()}
        role="grid"
        tabindex="-1"
        aria-label={`픽셀 편집 그리드. 베이스라인은 위에서 ${baseline}행 아래에 있습니다.`}
      >
        {#each localBitmap as row, r}{#each row as cell, c}
            <rect
              x={c * 24}
              y={r * 24}
              width={24}
              height={24}
              fill={cell ? 'var(--color-text-primary)' : 'var(--color-background-surface)'}
              role="gridcell"
              aria-label={`Pixel ${r},${c}`}
            />
          {/each}{/each}
        <!-- Draw each shared edge once so translucent border colors do not stack. -->
        {#each Array.from({length: COLS - 1}, (_, i) => i + 1) as col}
          <line
            x1={col * 24}
            x2={col * 24}
            y1={0}
            y2={ROWS * 24}
            stroke="var(--color-border-emphasized)"
            stroke-width={0.5}
            pointer-events="none"
          />
        {/each}
        {#each Array.from({length: ROWS - 1}, (_, i) => i + 1) as row}
          <line
            y1={row * 24}
            y2={row * 24}
            x1={0}
            x2={COLS * 24}
            stroke="var(--color-border-emphasized)"
            stroke-width={0.5}
            pointer-events="none"
          />
        {/each}
        {#each Array.from({length: Math.floor((COLS - 1) / 8)}, (_, i) => (i + 1) * 8) as col}<line
            x1={col * 24}
            x2={col * 24}
            y1={0}
            y2={ROWS * 24}
            stroke="var(--color-border-emphasized)"
            stroke-width={2}
          />{/each}
        {#each Array.from({length: Math.floor((ROWS - 1) / 8)}, (_, i) => (i + 1) * 8) as row}<line
            y1={row * 24}
            y2={row * 24}
            x1={0}
            x2={COLS * 24}
            stroke="var(--color-border-emphasized)"
            stroke-width={2}
          />{/each}
      </svg>
      <!-- Outside the nested viewport so the outline is not clipped in half. -->
      <rect
        x={0}
        y={0}
        width={COLS * 24}
        height={ROWS * 24}
        fill="none"
        stroke="var(--color-border-emphasized)"
        stroke-width={0.5}
        pointer-events="none"
      />
      <line
        x1={0}
        x2={COLS * 24}
        y1={baseline * 24}
        y2={baseline * 24}
        stroke="var(--color-accent)"
        stroke-width={2}
        stroke-dasharray="4 2"
        pointer-events="none"
      />
      <g transform={`translate(${COLS * 24 + 4}, ${baseline * 24})`}>
        <g
          role="slider"
          tabindex="0"
          aria-label="베이스라인 위치. 위아래 방향키로 1픽셀씩 조정"
          aria-orientation="vertical"
          aria-valuemin={0}
          aria-valuemax={ROWS}
          aria-valuenow={baseline}
          aria-valuetext={`${baseline}픽셀`}
          class="cursor-ns-resize touch-none"
          onpointerdown={startBaselineDrag}
          onpointermove={moveBaseline}
          onpointerup={endBaselineDrag}
          onpointercancel={endBaselineDrag}
          onlostpointercapture={endBaselineDrag}
          onkeydown={handleBaselineKey}
        >
          <rect x={0} y={-12} width={20} height={24} fill="transparent" />
          <rect x={0} y={-8} width={16} height={16} rx={3} fill="var(--color-accent)" />
          <path d="M4 -2 H12 M4 2 H12" stroke="var(--color-on-accent)" stroke-width={1.5} pointer-events="none" />
        </g>
        <text x={22} y={0} dominant-baseline="central" fill="var(--color-text-secondary)" class="text-sm"
          >베이스라인 · {baseline}px</text
        >
      </g>
    </svg>
  </VStack>
</VStack>
