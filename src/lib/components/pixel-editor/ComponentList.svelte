<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { Button } from '$lib/components/ui/button';
  import type { PixelComponent, ComponentType } from '$lib/types';
  import Thumbnail from '$lib/components/Thumbnail.svelte';
  import { Settings } from '@lucide/svelte';
  import { CHOSUNG, JUNGSUNG, JONGSUNG } from '$lib/hangul';
  import { projectState } from '$lib/state.svelte';

  interface Props {
    components: PixelComponent[];
    scrollTop?: number;
    onSelect: (id: string) => void;
    onOpenGroupManager: (type: ComponentType) => void;
  }

  let { components, scrollTop = $bindable(0), onSelect, onOpenGroupManager }: Props = $props();

  let scrollContainer: HTMLDivElement | undefined = $state();

  onMount(async () => {
    await tick();
    if (scrollContainer && scrollTop > 0) {
      scrollContainer.scrollTop = scrollTop;
    }
  });

  function handleScroll() {
    if (scrollContainer) {
      scrollTop = scrollContainer.scrollTop;
    }
  }

  const TYPE_LABEL: Record<ComponentType, string> = {
    chosung: '초성',
    jungsung: '중성',
    jongsung: '종성',
  };

  function formatConditions(cond: Record<string, boolean>) {
    const keys = Object.keys(cond);
    if (keys.length === 0) return '기본 결합';

    // Attempt to map group Id to group name by looking up in project groups
    const parts = [];
    const allGroups = [
      ...projectState.project.groups.chosung,
      ...projectState.project.groups.jungsung,
      ...projectState.project.groups.jongsung,
    ];

    for (const k of keys) {
      const g = allGroups.find((x) => x.id === k);
      const name = g ? g.name : k;
      parts.push(cond[k] ? `${name}과 결합` : `${name} 외와 결합`);
    }
    return parts.join(', ');
  }

  let variationsMap = $derived.by(() => {
    const map = new Map<string, PixelComponent[]>();

    for (const comp of components) {
      const key = `${comp.type}:${comp.typeIndex}`;
      let list = map.get(key);
      if (!list) {
        list = [];
        map.set(key, list);
      }
      list.push(comp);
    }

    // Sort by conditions for consistent order
    for (const list of map.values()) {
      list.sort((a, b) => {
        const strA = JSON.stringify(a.conditions);
        const strB = JSON.stringify(b.conditions);
        return strA.localeCompare(strB);
      });
    }

    return map;
  });

  function getVariations(type: ComponentType, typeIndex: number): PixelComponent[] {
    return variationsMap.get(`${type}:${typeIndex}`) ?? [];
  }
</script>

{#snippet jamoRow(type: ComponentType, char: string, i: number)}
  {@const variations = getVariations(type, i)}
  <div class="flex gap-1 rounded-md p-1 hover:bg-muted">
    <span class="w-4 text-center text-base font-semibold shrink-0 select-none leading-8">{char}</span>
    <div class="flex flex-wrap gap-x-1 gap-y-1.5 flex-1 min-w-0">
      {#each variations as comp (comp.id)}
        <div class="relative group h-8">
          <Button
            variant="outline"
            class="rounded p-0 box-content overflow-hidden"
            style="width: 2rem; height: 2rem;"
            onclick={() => onSelect(comp.id)}
            title={formatConditions(comp.conditions)}
          >
            <Thumbnail bitmap={comp.bitmap} size={32} class="transition group-hover:brightness-95" />
          </Button>
        </div>
      {/each}
    </div>
  </div>
{/snippet}

{#snippet sectionHeader(type: ComponentType, label: string)}
  <div class="flex items-center justify-between px-1 mb-1.5">
    <h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
      {label}
    </h3>
    <Button variant="outline" size="sm" class="h-6 px-2 text-xs" onclick={() => onOpenGroupManager(type)}>
      <Settings class="size-3" /> 그룹 관리
    </Button>
  </div>
{/snippet}

<div class="flex flex-col h-full">
  <div class="flex justify-between items-center pl-4 p-2 shrink-0 gap-2 border-b">
    <h2 class="font-bold truncate">컴포넌트 바리에이션</h2>
  </div>

  <div class="overflow-y-auto overscroll-contain flex-1 min-h-0" bind:this={scrollContainer} onscroll={handleScroll}>
    <div class="px-2 py-2 space-y-4">
      <section>
        {@render sectionHeader('chosung', '초성')}
        {#each CHOSUNG as char, i}
          {@render jamoRow('chosung', char, i)}
        {/each}
      </section>

      <section>
        {@render sectionHeader('jungsung', '중성')}
        {#each JUNGSUNG as char, i}
          {@render jamoRow('jungsung', char, i)}
        {/each}
      </section>

      <section>
        {@render sectionHeader('jongsung', '종성')}
        {#each JONGSUNG as char, i}
          {#if i !== 0}
            {@render jamoRow('jongsung', char, i)}
          {/if}
        {/each}
      </section>
    </div>
  </div>
</div>
