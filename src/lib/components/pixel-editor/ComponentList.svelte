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
    <h2 class="font-bold truncate">컴포넌트</h2>
    <Button size="sm" variant="outline" onclick={onAdd}>
      <Plus /> 추가
    </Button>
  </div>

  <ScrollArea class="h-[calc(100vh-48px-56px)]">
    <div class="grid grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-3 @xl:grid-cols-4 @3xl:grid-cols-5 gap-1.5 px-2 pb-2">
      {#each components as comp (comp.id)}
        <Button variant="outline" class="p-2 gap-3 h-auto text-left bg-background group relative" onclick={() => onSelect(comp.id)}>
          <Thumbnail bitmap={comp.bitmap} size={32} />
          <div class="flex-1 min-w-0">
            <div class="text-xs font-medium font-mono truncate">{comp.id.slice(0, 8)}</div>
            <div class="text-xs truncate text-muted-foreground mt-1">
              초: {comp.targets.chosung.length}, 중: {comp.targets.jungsung.length}, 종: {comp.targets.jongsung.length}
            </div>
          </div>

          <div class="absolute right-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="outline"
              size="icon"
              class="size-5 rounded"
              onclick={(e) => {e.stopPropagation(); onDelete(comp.id)}}
            >
              <Trash class="size-3.5" />
            </Button>
          </div>
        </Button>
      {/each}
      {#if components.length === 0}
        <div class="h-[calc(100vh-.5rem-96px-56px)] flex justify-center items-center text-center text-sm text-muted-foreground col-span-1 @sm:col-span-2 @lg:col-span-3 @xl:col-span-4 @3xl:col-span-5">
          컴포넌트가 없습니다. ‘추가’ 버튼을 눌러 시작하세요.
        </div>
      {/if}
    </div>
  </ScrollArea>
</div>
