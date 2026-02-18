<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import type { PixelComponent, ComponentType } from '$lib/types';
  import Thumbnail from '$lib/components/Thumbnail.svelte';
  import { Trash, Plus } from '@lucide/svelte';
  import { CHOSUNG, JUNGSUNG, JONGSUNG } from '$lib/hangul';

  interface Props {
    components: PixelComponent[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onAdd: (type: ComponentType, typeIndex: number) => void;
    onDelete: (id: string) => void;
  }

  let { components, selectedId, onSelect, onAdd, onDelete }: Props = $props();

  function getVariations(type: ComponentType, typeIndex: number): PixelComponent[] {
    return components.filter((c) => c.type === type && c.typeIndex === typeIndex);
  }
</script>

<!-- 자모 행 하나를 렌더링하는 snippet -->
{#snippet jamoRow(type: ComponentType, char: string, i: number)}
  {@const variations = getVariations(type, i)}
  <div class="flex gap-1 rounded-md px-1 py-0.5 hover:bg-muted/50">
    <span class="w-7 text-center text-base font-medium shrink-0 select-none">{char}</span>
    <div class="flex flex-wrap gap-1 flex-1 min-w-0">
      {#each variations as comp (comp.id)}
        <div class="relative group/item">
          <Button
            variant="outline"
            class="rounded p-0 overflow-hidden group"
            style="width: 2rem; height: 2rem;"
            onclick={() => onSelect(comp.id)}
            title="컴포넌트 편집"
          >
            <Thumbnail bitmap={comp.bitmap} size={32} class="group-hover/item:opacity-60" />
          </Button>
          <Button
            variant="destructive"
            size="icon-sm"
            class="absolute -top-1.5 -right-1.5 size-4 rounded-full opacity-0 group-hover/item:opacity-100 transition-opacity z-10 shadow"
            onclick={() => onDelete(comp.id)}
            title="컴포넌트 삭제"
          >
            <Trash class="size-2.5" />
          </Button>
        </div>
      {/each}
      <Button
        variant="outline"
        class="rounded"
        style="width: 2rem; height: 2rem;"
        onclick={() => onAdd(type, i)}
        title="컴포넌트 추가"
      >
        <Plus class="size-3.5" />
      </Button>
    </div>
  </div>
{/snippet}

<!-- 섹션 헤더 snippet -->
{#snippet sectionHeader(label: string)}
  <h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1.5">
    {label}
  </h3>
{/snippet}

<div class="flex flex-col h-full">
  <div class="flex justify-between items-center pl-4 p-2 shrink-0 gap-2 border-b">
    <h2 class="font-bold truncate">컴포넌트</h2>
  </div>

  <div class="overflow-y-auto overscroll-contain flex-1 min-h-0">
    <div class="px-2 py-2 space-y-4">
      <!-- 초성 섹션 -->
      <section>
        {@render sectionHeader('초성')}
        <div class="space-y-0.5">
          {#each CHOSUNG as char, i}
            {@render jamoRow('chosung', char, i)}
          {/each}
        </div>
      </section>

      <!-- 중성 섹션 -->
      <section>
        {@render sectionHeader('중성')}
        <div class="space-y-0.5">
          {#each JUNGSUNG as char, i}
            {@render jamoRow('jungsung', char, i)}
          {/each}
        </div>
      </section>

      <!-- 종성 섹션 (인덱스 0 = 받침 없음 제외) -->
      <section>
        {@render sectionHeader('종성')}
        <div class="space-y-0.5">
          {#each JONGSUNG as char, i}
            {#if i !== 0}
              {@render jamoRow('jongsung', char, i)}
            {/if}
          {/each}
        </div>
      </section>
    </div>
  </div>
</div>
