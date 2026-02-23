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
      if (!cond[k]) continue; // backwards compatibility check for false values
      if (k === 'no_jongsung') {
        parts.push('받침 없음');
        continue;
      }
      const g = allGroups.find((x) => x.id === k);
      const name = g ? g.name : k;
      parts.push(name);
    }
    return parts.length > 0 ? `${parts.join(', ')}과 결합` : '기본 결합';
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

    const allGroups = [
      ...projectState.project.groups.chosung,
      ...projectState.project.groups.jungsung,
      ...projectState.project.groups.jongsung,
    ];

    // Sort by conditions for consistent order
    for (const list of map.values()) {
      list.sort((a, b) => {
        const condA = Object.keys(a.conditions || {}).filter((k) => a.conditions[k]);
        const condB = Object.keys(b.conditions || {}).filter((k) => b.conditions[k]);

        const aHasNoJongsung = condA.includes('no_jongsung') ? 1 : 0;
        const bHasNoJongsung = condB.includes('no_jongsung') ? 1 : 0;
        if (aHasNoJongsung !== bHasNoJongsung) return bHasNoJongsung - aHasNoJongsung;

        if (condA.length !== condB.length) return condA.length - condB.length;

        const getItems = (conds: string[]) => {
          const items: number[] = [];
          for (const k of conds) {
            if (k === 'no_jongsung') continue;
            const g = allGroups.find((x) => x.id === k);
            if (g) items.push(...g.items);
          }
          return items.sort((x, y) => x - y);
        };

        const itemsA = getItems(condA);
        const itemsB = getItems(condB);

        for (let i = 0; i < Math.min(itemsA.length, itemsB.length); i++) {
          if (itemsA[i] !== itemsB[i]) return itemsA[i] - itemsB[i];
        }

        const strA = formatConditions(a.conditions || {});
        const strB = formatConditions(b.conditions || {});
        return strA.localeCompare(strB, 'ko');
      });
    }

    return map;
  });

  function getVariations(type: ComponentType, typeIndex: number): PixelComponent[] {
    return variationsMap.get(`${type}:${typeIndex}`) ?? [];
  }

  const GROUP_COLORS = [
    '#3b82f6',
    '#ef4444',
    '#10b981',
    '#f59e0b',
    '#8b5cf6',
    '#ec4899',
    '#06b6d4',
    '#84cc16',
    '#f97316',
    '#14b8a6',
    '#6366f1',
    '#d946ef',
  ];

  function getGroupName(id: string) {
    if (id === 'no_jongsung') return '받침 없음';
    if (id === 'base') return '기본 결합';
    if (id === 'none') return '없음';
    const allGroups = [
      ...projectState.project.groups.chosung,
      ...projectState.project.groups.jungsung,
      ...projectState.project.groups.jongsung,
    ];
    const g = allGroups.find((x) => x.id === id);
    return g ? g.name : id;
  }

  let groupColorMap = $derived.by(() => {
    const map = new Map<string, string>();
    let colorIndex = 0;

    // collect all unique group IDs
    const allLists = Array.from(variationsMap.values());
    const uniqueIds = new Set<string>();

    for (const list of allLists) {
      for (const comp of list) {
        const keys = Object.keys(comp.conditions || {}).filter((k) => comp.conditions[k]);
        for (const k of keys) {
          uniqueIds.add(k);
        }
      }
    }

    const sortedIds = Array.from(uniqueIds).filter((id) => id !== 'no_jongsung');
    sortedIds.sort((a, b) => getGroupName(a).localeCompare(getGroupName(b), 'ko'));

    for (const id of sortedIds) {
      if (!map.has(id)) {
        map.set(id, GROUP_COLORS[colorIndex % GROUP_COLORS.length]);
        colorIndex++;
      }
    }
    map.set('no_jongsung', '#94a3b8'); // slate-400

    return map;
  });

  function getGroupColor(id: string) {
    return groupColorMap.get(id) || '#cbd5e1';
  }

  interface SGNode {
    id: string;
    name: string;
    comps: PixelComponent[];
  }
  interface PGNode {
    id: string;
    name: string;
    children: SGNode[];
  }

  function getGroupPriority(id: string) {
    if (id === 'no_jongsung' || id === 'base' || id === 'none') return 1;
    if (projectState.project.groups.jongsung.some((g) => g.id === id)) return 1;
    if (projectState.project.groups.jungsung.some((g) => g.id === id)) return 2;
    if (projectState.project.groups.chosung.some((g) => g.id === id)) return 3;
    return 4;
  }

  function getGroupMinItem(id: string) {
    if (id === 'no_jongsung' || id === 'base' || id === 'none') return -1;
    const allGroups = [
      ...projectState.project.groups.chosung,
      ...projectState.project.groups.jungsung,
      ...projectState.project.groups.jongsung,
    ];
    const g = allGroups.find((x) => x.id === id);
    return g && g.items.length > 0 ? Math.min(...g.items) : 999;
  }

  function sortConditions(conds: string[]) {
    return conds.sort((a, b) => {
      const pA = getGroupPriority(a);
      const pB = getGroupPriority(b);
      if (pA !== pB) return pA - pB;
      const mA = getGroupMinItem(a);
      const mB = getGroupMinItem(b);
      if (mA !== mB) return mA - mB;
      return getGroupName(a).localeCompare(getGroupName(b), 'ko');
    });
  }

  function buildGroupTree(variations: PixelComponent[]): PGNode[] {
    const pgMap = new Map<string, PixelComponent[]>();
    for (const comp of variations) {
      const activeGroups = Object.keys(comp.conditions || {}).filter((k) => comp.conditions[k]);
      sortConditions(activeGroups);

      const primaryId = activeGroups.length > 0 ? activeGroups[0] : 'base';
      if (!pgMap.has(primaryId)) {
        pgMap.set(primaryId, []);
      }
      pgMap.get(primaryId)!.push(comp);
    }

    const pNodes: PGNode[] = [];
    for (const [pId, comps] of pgMap.entries()) {
      const sgMap = new Map<string, PixelComponent[]>();
      for (const comp of comps) {
        const activeGroups = Object.keys(comp.conditions || {}).filter((k) => comp.conditions[k]);
        sortConditions(activeGroups);
        const secondaryId = activeGroups.length > 1 ? activeGroups[1] : 'none';
        if (!sgMap.has(secondaryId)) {
          sgMap.set(secondaryId, []);
        }
        sgMap.get(secondaryId)!.push(comp);
      }

      const children: SGNode[] = [];
      for (const [sId, sComps] of sgMap.entries()) {
        sComps.sort((a, b) => variations.indexOf(a) - variations.indexOf(b));
        children.push({ id: sId, name: getGroupName(sId), comps: sComps });
      }
      children.sort((a, b) => {
        if (a.id === 'none') return -1;
        if (b.id === 'none') return 1;
        const mA = getGroupMinItem(a.id);
        const mB = getGroupMinItem(b.id);
        if (mA !== mB) return mA - mB;
        return a.name.localeCompare(b.name, 'ko');
      });
      pNodes.push({ id: pId, name: getGroupName(pId), children });
    }

    pNodes.sort((a, b) => {
      if (a.id === 'base') return -1;
      if (b.id === 'base') return 1;
      if (a.id === 'no_jongsung') return -1;
      if (b.id === 'no_jongsung') return 1;
      const mA = getGroupMinItem(a.id);
      const mB = getGroupMinItem(b.id);
      if (mA !== mB) return mA - mB;
      return a.name.localeCompare(b.name, 'ko');
    });
    return pNodes;
  }
</script>

{#snippet jamoRow(type: ComponentType, char: string, i: number)}
  {@const variations = getVariations(type, i)}
  {@const pNodes = buildGroupTree(variations)}

  {#snippet compButton(comp: PixelComponent)}
    <div class="relative group h-8">
      <Button
        variant="outline"
        class="rounded p-0 box-content overflow-hidden shrink-0"
        style="width: 2rem; height: 2rem;"
        onclick={() => onSelect(comp.id)}
        title={formatConditions(comp.conditions || {})}
      >
        <Thumbnail bitmap={comp.bitmap} size={32} class="transition group-hover:brightness-95" />
      </Button>
    </div>
  {/snippet}

  <div class="flex gap-1 rounded-md p-1 hover:bg-muted min-w-0">
    <span class="w-4 text-center text-base font-semibold shrink-0 select-none leading-9">{char}</span>
    <div class="flex flex-wrap gap-x-3 gap-y-2 flex-1 min-w-0 ml-1">
      {#each pNodes as pNode}
        {#if pNode.id === 'base'}
          <div class="flex flex-wrap gap-1 items-center">
            {#each pNode.children as sNode}
              {#each sNode.comps as comp (comp.id)}
                {@render compButton(comp)}
              {/each}
            {/each}
          </div>
        {:else}
          <div
            class="relative flex flex-wrap gap-1.5 px-1.5 pb-1.5 pt-2.5 rounded-md border-2 mt-1.5 min-h-[36px]"
            style="border-color: {getGroupColor(pNode.id)};"
          >
            <span
              class="absolute -top-2.5 left-2 px-1 text-[0.65rem] font-bold bg-background leading-none rounded whitespace-nowrap"
              style="color: {getGroupColor(pNode.id)}">{pNode.name}</span
            >
            {#each pNode.children as sNode}
              {#if sNode.id === 'none'}
                <div class="flex flex-wrap gap-1">
                  {#each sNode.comps as comp (comp.id)}
                    {@render compButton(comp)}
                  {/each}
                </div>
              {:else}
                <div
                  class="relative flex flex-wrap gap-1 px-1 pb-1 pt-2 rounded border border-dashed mt-1"
                  style="border-color: {getGroupColor(sNode.id)};"
                >
                  <span
                    class="absolute -top-2 left-1 px-1 text-[0.55rem] font-bold bg-background leading-none rounded whitespace-nowrap"
                    style="color: {getGroupColor(sNode.id)}">{sNode.name}</span
                  >
                  {#each sNode.comps as comp (comp.id)}
                    {@render compButton(comp)}
                  {/each}
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      {/each}
    </div>
  </div>
{/snippet}

{#snippet sectionHeader(type: ComponentType, label: string)}
  <div class="flex items-center justify-between pl-1">
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
    <h2 class="font-bold truncate">컴포넌트</h2>
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
