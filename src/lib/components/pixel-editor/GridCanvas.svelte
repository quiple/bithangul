<script lang="ts">
  import { untrack } from 'svelte';
  import { cn } from '$lib/utils';

  let {
    bitmap,
    onUpdate,
  }: {
    bitmap: number[][];
    onUpdate: (newBitmap: number[][]) => void;
  } = $props();

  // 내부 작업용 bitmap: 드래그 중에는 이 상태만 변이하고 onUpdate는 호출하지 않음
  // → 부모의 prop 교체가 일어나지 않아 리렌더/블링킹 없음
  let localBitmap = $state<number[][]>(untrack(() => bitmap.map((row) => [...row])));

  // 부모의 bitmap prop이 외부에서 바뀔 때만 동기화 (편집기 전환 등)
  $effect(() => {
    // bitmap이 새 배열 참조로 바뀌면 로컬 상태 갱신
    localBitmap = bitmap.map((row) => [...row]);
  });

  let isDrawing = false;
  let drawMode = 1; // 1 = draw, 0 = erase

  function handlePointerDown(r: number, c: number, e: PointerEvent) {
    e.preventDefault();
    drawMode = localBitmap[r][c] === 1 ? 0 : 1;
    isDrawing = true;
    paintPixel(r, c);
  }

  function handlePointerEnter(r: number, c: number) {
    if (isDrawing) {
      paintPixel(r, c);
    }
  }

  function handlePointerUp() {
    if (isDrawing) {
      isDrawing = false;
      // 드래그가 끝난 시점에 한 번만 부모에 알림
      onUpdate(localBitmap.map((row) => [...row]));
    }
  }

  function paintPixel(r: number, c: number) {
    if (localBitmap[r][c] !== drawMode) {
      // 배열 교체 없이 직접 변이 → Svelte가 세밀하게 해당 셀만 업데이트
      localBitmap[r][c] = drawMode;
    }
  }
</script>

<svelte:window onpointerup={handlePointerUp} />

<div
  class="grid grid-cols-16 gap-px bg-border border w-full max-w-100 select-none touch-none aspect-square"
  oncontextmenu={(e) => e.preventDefault()}
  role="grid"
  tabindex="-1"
>
  {#each localBitmap as row, r}
    {#each row as cell, c}
      <button
        class={cn('size-full cursor-crosshair block', cell ? 'bg-primary' : 'bg-background hover:bg-muted')}
        onpointerdown={(e) => handlePointerDown(r, c, e)}
        onpointerenter={() => handlePointerEnter(r, c)}
        aria-label={`Pixel ${r},${c}`}
        type="button"
      ></button>
    {/each}
  {/each}
</div>
