<script lang="ts">
  import {VStack} from '@astryx-svelte/core'
  let {bitmap, size = 32, class: className = ''}: {bitmap?: number[][]; size?: number; class?: string} = $props()
  const width = $derived(bitmap?.[0]?.length || 16)
  const height = $derived(bitmap?.length || 16)
  const pixels = $derived.by(() => {
    const runs: string[] = []
    for (let y = 0; y < (bitmap?.length ?? 0); y++) {
      const row = bitmap![y]
      for (let x = 0; x < row.length; x++) {
        if (!row[x]) continue
        const start = x
        while (x + 1 < row.length && row[x + 1]) x++
        const length = x - start + 1
        runs.push(`M${start} ${y}h${length}v1h-${length}z`)
      }
    }
    return runs.join('')
  })
</script>

<VStack width={size} height={size} justify="center" align="center" class={className}>
  <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" aria-hidden="true" shape-rendering="crispEdges">
    <rect {width} {height} fill="var(--color-background-surface)" />
    <path d={pixels} fill="var(--color-text-primary)" />
  </svg>
</VStack>
