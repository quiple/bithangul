<script lang="ts">
  import {Button} from '$lib/components/ui/button'
  import {ScrollArea} from '$lib/components/ui/scroll-area'
  import type {PixelComponent} from '$lib/types'
  import Thumbnail from '$lib/components/Thumbnail.svelte'
  import {cn} from '$lib/utils'
  import {Trash, Plus} from '@lucide/svelte'

  export let components: PixelComponent[]
  export let selectedId: string | null
  export let onSelect: (id: string) => void
  export let onAdd: () => void
  export let onDelete: (id: string) => void
</script>

<div class="h-full flex flex-col bg-sidebar border-r">
  <div class="p-4 border-b flex justify-between items-center bg-background shrink-0">
    <h2 class="font-bold text-sm">Components</h2>
    <Button size="sm" variant="outline" onclick={onAdd}>
      <Plus /> Add
    </Button>
  </div>
  <ScrollArea class="flex-1 min-h-0">
    <div class="p-2 space-y-2">
      {#each components as comp (comp.id)}
        <button
          class={cn(
            "w-full flex items-center p-2 border rounded text-left transition-colors hover:bg-accent hover:text-accent-foreground group relative",
            selectedId === comp.id ? "bg-accent text-accent-foreground ring-1 ring-ring" : "bg-card"
          )}
          on:click={() => onSelect(comp.id)}
        >
           <div class="w-8 h-8 mr-3 shrink-0">
             <Thumbnail bitmap={comp.bitmap} size={32} />
           </div>
           <div class="flex-1 min-w-0">
             <div class="text-xs font-mono truncate text-muted-foreground">{comp.id.slice(0,8)}</div>
             <div class="text-[10px] text-muted-foreground flex gap-1 mt-1">
               <span class={comp.targets.chosung.length > 0 ? "text-primary font-bold" : ""}>Cho:{comp.targets.chosung.length}</span>
               <span class={comp.targets.jungsung.length > 0 ? "text-primary font-bold" : ""}>Jung:{comp.targets.jungsung.length}</span>
               <span class={comp.targets.jongsung.length > 0 ? "text-primary font-bold" : ""}>Jong:{comp.targets.jongsung.length}</span>
             </div>
           </div>

           <div class="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
               <Button
                variant="destructive"
                size="icon"
                class="h-6 w-6"
                onclick={(e) => { e.stopPropagation(); onDelete(comp.id); }}
               >
                 <Trash class="w-3 h-3" />
               </Button>
           </div>
        </button>
      {/each}

      {#if components.length === 0}
        <div class="p-8 text-center text-sm text-muted-foreground">
          No components. Click "Add" to start.
        </div>
      {/if}
    </div>
  </ScrollArea>
</div>
