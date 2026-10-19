<script lang="ts">
  import {VStack} from '@astryx-svelte/core'
  let {bitmap, size = 32, class: className = ''}: {bitmap?: number[][]; size?: number; class?: string} = $props()
  const width = $derived(bitmap?.[0]?.length || 16)
  const height = $derived(bitmap?.length || 16)
</script>

<VStack width={size} height={size} justify="center" align="center" class={className}>
  <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" aria-hidden="true" shape-rendering="crispEdges">
    <rect {width} {height} fill="var(--color-background-surface)" />
    {#each bitmap ?? [] as row, r}{#each row as pixel, c}{#if pixel}<rect
            x={c}
            y={r}
            width={1}
            height={1}
            fill="var(--color-text-primary)"
          />{/if}{/each}{/each}
  </svg>
</VStack>
