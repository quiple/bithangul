<script lang="ts">
  import {Button} from '$lib/components/ui/button'
  import {ScrollArea} from '$lib/components/ui/scroll-area'
  import type {PixelComponent} from '$lib/types'
  import Thumbnail from '$lib/components/Thumbnail.svelte'
  import {cn} from '$lib/utils'
  import {Trash, Plus} from '@lucide/svelte'
  import * as Item from "$lib/components/ui/item/index.js"

  export let components: PixelComponent[]
  export let selectedId: string | null
  export let onSelect: (id: string) => void
  export let onAdd: () => void
  export let onDelete: (id: string) => void
</script>

<div class="flex flex-col p-2">
  <div class="flex justify-between items-center mb-2 pl-2">
    <h2 class="font-bold">Components</h2>
    <Button size="sm" variant="outline" onclick={onAdd}>
      <Plus /> Add
    </Button>
  </div>

  <ScrollArea class="flex flex-col gap-2">
    {#each components as comp (comp.id)}
      <Item.Root variant="outline" class="p-2 gap-3 bg-background group relative" onclick={() => onSelect(comp.id)}>
        {#snippet child({ props })}
          <a href="#/" {...props}>
            <Thumbnail bitmap={comp.bitmap} size={32} />
            <div class="flex-1 min-w-0">
              <div class="text-xs font-mono truncate text-muted-foreground">{comp.id.slice(0, 8)}</div>
              <div class="text-xs truncate text-muted-foreground mt-1">
                <span class={comp.targets.chosung.length > 0 ? "text-primary font-bold" : ""}>Cho: {comp.targets.chosung.length}</span>,
                <span class={comp.targets.jungsung.length > 0 ? "text-primary font-bold" : ""}>Jung: {comp.targets.jungsung.length}</span>,
                <span class={comp.targets.jongsung.length > 0 ? "text-primary font-bold" : ""}>Jong: {comp.targets.jongsung.length}</span>
              </div>
            </div>

            <div class="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="destructive"
                size="icon"
                class="h-6 w-6"
                onclick={(e) => {e.stopPropagation(); onDelete(comp.id)}}
              >
                <Trash class="w-3 h-3" />
              </Button>
            </div>
          </a>
        {/snippet}
      </Item.Root>
    {/each}

    {#if components.length === 0}
      <div class="p-8 text-center text-sm text-muted-foreground">
        No components. Click "Add" to start.
      </div>
    {/if}
  </ScrollArea>
</div>
