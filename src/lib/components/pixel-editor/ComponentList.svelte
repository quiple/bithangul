<script lang="ts">
  import {Button} from '$lib/components/ui/button'
  import {ScrollArea} from '$lib/components/ui/scroll-area'
  import type {PixelComponent} from '$lib/types'
  import Thumbnail from '$lib/components/Thumbnail.svelte'
  import {Trash, Plus} from '@lucide/svelte'

  export let components: PixelComponent[]
  export let selectedId: string | null
  export let onSelect: (id: string) => void
  export let onAdd: () => void
  export let onDelete: (id: string) => void
</script>

<div class="flex flex-col @container">
  <div class="flex justify-between items-center pl-4 p-2 shrink-0 gap-2">
    <h2 class="font-bold truncate">Components</h2>
    <Button size="sm" variant="outline" onclick={onAdd}>
      <Plus /> Add
    </Button>
  </div>

  <ScrollArea class="h-[calc(100vh-48px-56px)]">
    <div class="grid grid-col-1 @sm:grid-col-2 @md:grid-col-3 gap-1.5 px-2 pb-2">
      {#each components as comp (comp.id)}
        <Button variant="outline" class="p-2 gap-3 h-auto text-left bg-background group relative" onclick={() => onSelect(comp.id)}>
          <Thumbnail bitmap={comp.bitmap} size={32} />
          <div class="flex-1 min-w-0">
            <div class="text-xs font-medium font-mono truncate">{comp.id.slice(0, 8)}</div>
            <div class="text-xs truncate text-muted-foreground mt-1">
              <span class={comp.targets.chosung.length > 0 ? "text-primary font-bold" : ""}>Cho: {comp.targets.chosung.length}</span>,
              <span class={comp.targets.jungsung.length > 0 ? "text-primary font-bold" : ""}>Jung: {comp.targets.jungsung.length}</span>,
              <span class={comp.targets.jongsung.length > 0 ? "text-primary font-bold" : ""}>Jong: {comp.targets.jongsung.length}</span>
            </div>
          </div>

          <div class="absolute right-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="outline"
              size="icon"
              class="size-5 rounded"
              onclick={(e) => {e.stopPropagation(); onDelete(comp.id)}}
            >
              <Trash class="size-3.5 stroke-red-500" />
            </Button>
          </div>
        </Button>
      {/each}
      {#if components.length === 0}
        <div class="p-8 text-center text-sm text-muted-foreground">
          No components. Click "Add" to start.
        </div>
      {/if}
    </div>
  </ScrollArea>
</div>
