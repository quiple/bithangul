<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
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

  // 특정 자모 타입+인덱스에 해당하는 컴포넌트 목록 반환
  function getVariations(type: ComponentType, typeIndex: number): PixelComponent[] {
    return components.filter((c) => c.type === type && c.typeIndex === typeIndex);
  }
</script>

<div class="flex flex-col h-full">
  <div class="flex justify-between items-center pl-4 p-2 shrink-0 gap-2 border-b">
    <h2 class="font-bold truncate">컴포넌트</h2>
  </div>

  <ScrollArea class="h-[calc(100vh-48px-56px)]">
    <div class="px-2 py-2 space-y-4">
      <!-- 초성 섹션 -->
      <section>
        <h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1.5">초성</h3>
        <div class="space-y-0.5">
          {#each CHOSUNG as char, i}
            {@const variations = getVariations('chosung', i)}
            <div class="flex items-center gap-1 group/row rounded-md px-1 py-0.5 hover:bg-muted/50">
              <!-- 자모 레이블 -->
              <span class="w-7 text-center text-base font-medium shrink-0 select-none">{char}</span>

              <!-- 바리에이션 버튼들 -->
              <div class="flex flex-wrap gap-1 flex-1 min-w-0">
                {#each variations as comp (comp.id)}
                  <button
                    class="inline-flex items-center justify-center rounded border text-sm font-medium transition-colors
                      {selectedId === comp.id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:border-primary/60 hover:bg-muted'}
                      relative group/item p-0 overflow-hidden"
                    style="width: 2rem; height: 2rem;"
                    onclick={() => onSelect(comp.id)}
                    title="편집"
                  >
                    <Thumbnail bitmap={comp.bitmap} size={28} />
                    <!-- 삭제 버튼 -->
                    <span
                      class="absolute inset-0 flex items-center justify-center bg-destructive/80 opacity-0 group-hover/item:opacity-100 transition-opacity cursor-pointer"
                      role="button"
                      tabindex="-1"
                      onclick={(e) => {
                        e.stopPropagation();
                        onDelete(comp.id);
                      }}
                      onkeydown={(e) => {
                        if (e.key === 'Enter') {
                          e.stopPropagation();
                          onDelete(comp.id);
                        }
                      }}
                    >
                      <Trash class="size-3 text-white" />
                    </span>
                  </button>
                {/each}

                <!-- 추가 버튼 -->
                <button
                  class="inline-flex items-center justify-center rounded border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  style="width: 2rem; height: 2rem;"
                  onclick={() => onAdd('chosung', i)}
                  title="바리에이션 추가"
                >
                  <Plus class="size-3.5" />
                </button>
              </div>
            </div>
          {/each}
        </div>
      </section>

      <!-- 중성 섹션 -->
      <section>
        <h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1.5">중성</h3>
        <div class="space-y-0.5">
          {#each JUNGSUNG as char, i}
            {@const variations = getVariations('jungsung', i)}
            <div class="flex items-center gap-1 group/row rounded-md px-1 py-0.5 hover:bg-muted/50">
              <span class="w-7 text-center text-base font-medium shrink-0 select-none">{char}</span>

              <div class="flex flex-wrap gap-1 flex-1 min-w-0">
                {#each variations as comp (comp.id)}
                  <button
                    class="inline-flex items-center justify-center rounded border text-sm font-medium transition-colors
                      {selectedId === comp.id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:border-primary/60 hover:bg-muted'}
                      relative group/item p-0 overflow-hidden"
                    style="width: 2rem; height: 2rem;"
                    onclick={() => onSelect(comp.id)}
                    title="편집"
                  >
                    <Thumbnail bitmap={comp.bitmap} size={28} />
                    <span
                      class="absolute inset-0 flex items-center justify-center bg-destructive/80 opacity-0 group-hover/item:opacity-100 transition-opacity cursor-pointer"
                      role="button"
                      tabindex="-1"
                      onclick={(e) => {
                        e.stopPropagation();
                        onDelete(comp.id);
                      }}
                      onkeydown={(e) => {
                        if (e.key === 'Enter') {
                          e.stopPropagation();
                          onDelete(comp.id);
                        }
                      }}
                    >
                      <Trash class="size-3 text-white" />
                    </span>
                  </button>
                {/each}

                <button
                  class="inline-flex items-center justify-center rounded border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  style="width: 2rem; height: 2rem;"
                  onclick={() => onAdd('jungsung', i)}
                  title="바리에이션 추가"
                >
                  <Plus class="size-3.5" />
                </button>
              </div>
            </div>
          {/each}
        </div>
      </section>

      <!-- 종성 섹션 (인덱스 0 제외) -->
      <section>
        <h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1.5">종성</h3>
        <div class="space-y-0.5">
          {#each JONGSUNG as char, i}
            {#if i !== 0}
              {@const variations = getVariations('jongsung', i)}
              <div class="flex items-center gap-1 group/row rounded-md px-1 py-0.5 hover:bg-muted/50">
                <span class="w-7 text-center text-base font-medium shrink-0 select-none">{char}</span>

                <div class="flex flex-wrap gap-1 flex-1 min-w-0">
                  {#each variations as comp (comp.id)}
                    <button
                      class="inline-flex items-center justify-center rounded border text-sm font-medium transition-colors
                        {selectedId === comp.id
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background hover:border-primary/60 hover:bg-muted'}
                        relative group/item p-0 overflow-hidden"
                      style="width: 2rem; height: 2rem;"
                      onclick={() => onSelect(comp.id)}
                      title="편집"
                    >
                      <Thumbnail bitmap={comp.bitmap} size={28} />
                      <span
                        class="absolute inset-0 flex items-center justify-center bg-destructive/80 opacity-0 group-hover/item:opacity-100 transition-opacity cursor-pointer"
                        role="button"
                        tabindex="-1"
                        onclick={(e) => {
                          e.stopPropagation();
                          onDelete(comp.id);
                        }}
                        onkeydown={(e) => {
                          if (e.key === 'Enter') {
                            e.stopPropagation();
                            onDelete(comp.id);
                          }
                        }}
                      >
                        <Trash class="size-3 text-white" />
                      </span>
                    </button>
                  {/each}

                  <button
                    class="inline-flex items-center justify-center rounded border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    style="width: 2rem; height: 2rem;"
                    onclick={() => onAdd('jongsung', i)}
                    title="바리에이션 추가"
                  >
                    <Plus class="size-3.5" />
                  </button>
                </div>
              </div>
            {/if}
          {/each}
        </div>
      </section>
    </div>
  </ScrollArea>
</div>
