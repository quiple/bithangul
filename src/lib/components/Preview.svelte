<script lang="ts">
  import { onMount, tick } from 'svelte'
  import PreviewItem from './PreviewItem.svelte'
  import { Settings } from '@lucide/svelte'

  export let generatedData: ArrayBuffer | null = null

  const ITEM_HEIGHT = 41 // Using 41 to account for 1px border if needed, or stick to 40?
  // PreviewItem has border-b inside h-10? Usually border-b is inside.
  // Standard Tailwind reset makes border transparent but keep width.
  // border-b-width is 1px.
  // If box-sizing: border-box, h-10 is total height.
  // But border collapse?
  // With 40px item, border-b creates visual separation.
  // Let's use 40.

  const REAL_ITEM_HEIGHT = 40
  const TOTAL_ITEMS = 11172

  let scrollTop = 0
  let container: HTMLDivElement
  let containerHeight = 800

  // Virtualization logic
  $: startIndex = Math.max(0, Math.floor(scrollTop / REAL_ITEM_HEIGHT))
  $: visibleCount = Math.ceil(containerHeight / REAL_ITEM_HEIGHT) + 4 // Buffer increased
  $: endIndex = Math.min(TOTAL_ITEMS, startIndex + visibleCount)

  $: visibleItems = Array.from({ length: endIndex - startIndex }, (_, i) => startIndex + i)

  function handleScroll(e: UIEvent) {
    if (e.target instanceof HTMLElement) {
      scrollTop = e.target.scrollTop
    }
  }
</script>

<div
  class={['h-full relative bg-background', generatedData ? 'overflow-y-auto' : 'overflow-hidden']}
  on:scroll={handleScroll}
  bind:this={container}
  bind:clientHeight={containerHeight}
>
  <div style="height: {TOTAL_ITEMS * REAL_ITEM_HEIGHT}px; width: 100%; position: relative;">
    {#each visibleItems as idx (idx)}
      <div
        style="position: absolute; top: {idx * REAL_ITEM_HEIGHT}px; left: 0; right: 0; height: {REAL_ITEM_HEIGHT}px;"
        class="w-full"
      >
        <PreviewItem index={idx} data={generatedData} />
      </div>
    {/each}
  </div>

  {#if !generatedData}
    <div class="fixed inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm pointer-events-none z-10" style="position: absolute;">
       <div class="text-center p-6 bg-card rounded shadow border">
         <Settings class="w-12 h-12 mx-auto mb-4 text-muted-foreground animate-spin-slow" />
         <p class="text-lg font-medium">Preview not ready</p>
         <p class="text-sm text-muted-foreground">Click "Generate" to see fonts.</p>
       </div>
    </div>
  {/if}
</div>

<style>
  :global(.animate-spin-slow) {
    animation: spin 3s linear infinite
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
