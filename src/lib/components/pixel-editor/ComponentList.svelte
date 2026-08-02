<script lang="ts">
  import type {PixelComponent, ComponentType} from '$lib/types'

  import Thumbnail from '$lib/components/Thumbnail.svelte'
  import {Button} from '$lib/components/ui/button'
  import * as ContextMenu from '$lib/components/ui/context-menu/index.js'
  import * as Tabs from '$lib/components/ui/tabs'
  import {CHOSUNG, JUNGSUNG, JONGSUNG} from '$lib/hangul'
  import {projectState} from '$lib/state.svelte'
  import {CopyPlus, Settings, Trash2} from '@lucide/svelte'
  import {onMount, tick} from 'svelte'

  interface Props {
    components: PixelComponent[]
    scrollTop?: number
    activeTab?: ComponentType
    onSelect: (id: string) => void
    onSplit: (component: PixelComponent) => void
    onDelete: (component: PixelComponent) => void
    onOpenGroupManager: (type: ComponentType) => void
  }

  let {
    components,
    scrollTop = $bindable(0),
    activeTab = $bindable('chosung'),
    onSelect,
    onSplit,
    onDelete,
    onOpenGroupManager,
  }: Props = $props()

  let scrollContainer: HTMLDivElement | undefined = $state()

  onMount(async () => {
    await tick()
    if (scrollContainer && scrollTop > 0) {
      scrollContainer.scrollTop = scrollTop
    }
  })

  function handleScroll(e: Event) {
    const target = e.currentTarget as HTMLDivElement
    if (target) {
      scrollTop = target.scrollTop
    }
  }

  $effect(() => {
    // Attempt to restore scroll on tab switch, but typically each tab might have its own or share one.
    // If sharing one overarching scroll container, it's easier.
  })

  const TYPE_LABEL: Record<ComponentType, string> = {
    chosung: '초성',
    jungsung: '중성',
    jongsung: '종성',
  }

  let groupMeta = $derived.by(() => {
    const map = new Map<string, {name: string; priority: number; itemCount: number; minItem: number}>()
    const add = (arr: any[], prio: number) => {
      for (const g of arr)
        map.set(g.id, {
          name: g.name,
          priority: prio,
          itemCount: g.items.length,
          minItem: g.items.length > 0 ? Math.min(...g.items) : 999,
        })
    }
    add(projectState.project.groups.jongsung, 1)
    add(projectState.project.groups.jungsung, 2)
    add(projectState.project.groups.chosung, 3)

    map.set('no_jongsung', {name: '받침 없음', priority: 1, itemCount: 1, minItem: -1})
    map.set('base', {name: '기본 결합', priority: 1, itemCount: 999, minItem: -1})
    map.set('none', {name: '없음', priority: 1, itemCount: 999, minItem: -1})
    return map
  })

  function getGroupName(id: string) {
    return groupMeta.get(id)?.name || id
  }
  function getGroupPriority(id: string) {
    return groupMeta.get(id)?.priority || 4
  }
  function getGroupItemCount(id: string) {
    return groupMeta.get(id)?.itemCount ?? 0
  }
  function getGroupMinItem(id: string) {
    return groupMeta.get(id)?.minItem ?? 999
  }

  function formatConditions(cond: Record<string, boolean> | undefined) {
    if (!cond) return '기본 결합'
    const keys = Object.keys(cond).filter((k) => cond[k])
    if (keys.length === 0) return '기본 결합'
    return keys.map((k) => getGroupName(k)).join(', ') + '과 결합'
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
  ]

  let groupColorMap = $derived.by(() => {
    const map = new Map<string, string>()
    const uniqueIds = new Set<string>()
    for (const comp of components) {
      for (const k in comp.conditions || {}) {
        if (comp.conditions[k]) uniqueIds.add(k)
      }
    }
    const sortedIds = Array.from(uniqueIds).filter((id) => id !== 'no_jongsung')
    sortedIds.sort((a, b) => getGroupName(a).localeCompare(getGroupName(b), 'ko'))

    let colorIndex = 0
    for (const id of sortedIds) {
      map.set(id, GROUP_COLORS[colorIndex % GROUP_COLORS.length])
      colorIndex++
    }
    map.set('no_jongsung', '#94a3b8')
    return map
  })

  function getGroupColor(id: string) {
    return groupColorMap.get(id) || '#cbd5e1'
  }

  interface SGNode {
    id: string
    name: string
    comps: PixelComponent[]
  }
  interface PGNode {
    id: string
    name: string
    children: SGNode[]
  }

  function sortConditions(conds: string[]) {
    return conds.sort((a, b) => {
      const pA = getGroupPriority(a)
      const pB = getGroupPriority(b)
      if (pA !== pB) return pA - pB
      const cA = getGroupItemCount(a)
      const cB = getGroupItemCount(b)
      if (cA !== cB) return cB - cA
      const mA = getGroupMinItem(a)
      const mB = getGroupMinItem(b)
      if (mA !== mB) return mA - mB
      return getGroupName(a).localeCompare(getGroupName(b), 'ko')
    })
  }

  function sortComps(comps: PixelComponent[]) {
    return comps.sort((a, b) => {
      const condA = Object.keys(a.conditions || {}).filter((k) => a.conditions[k])
      const condB = Object.keys(b.conditions || {}).filter((k) => b.conditions[k])
      const sA = sortConditions(condA).join(',')
      const sB = sortConditions(condB).join(',')
      if (sA !== sB) return sA.localeCompare(sB, 'ko')
      return a.id.localeCompare(b.id)
    })
  }

  let treeNodesMap = $derived.by(() => {
    const map = new Map<string, PixelComponent[]>()
    for (const comp of components) {
      const key = `${comp.type}:${comp.typeIndex}`
      let list = map.get(key)
      if (!list) {
        list = []
        map.set(key, list)
      }
      list.push(comp)
    }

    const tMap = new Map<string, PGNode[]>()
    for (const [key, comps] of map.entries()) {
      const pgMap = new Map<string, PixelComponent[]>()
      for (const comp of comps) {
        const activeGroups = sortConditions(Object.keys(comp.conditions || {}).filter((k) => comp.conditions[k]))
        const primaryId = activeGroups.length > 0 ? activeGroups[0] : 'base'
        if (!pgMap.has(primaryId)) pgMap.set(primaryId, [])
        pgMap.get(primaryId)!.push(comp)
      }

      const pNodes: PGNode[] = []
      for (const [pId, pComps] of pgMap.entries()) {
        const sgMap = new Map<string, PixelComponent[]>()
        for (const comp of pComps) {
          const activeGroups = sortConditions(Object.keys(comp.conditions || {}).filter((k) => comp.conditions[k]))
          const secondaryId = activeGroups.length > 1 ? activeGroups[1] : 'none'
          if (!sgMap.has(secondaryId)) sgMap.set(secondaryId, [])
          sgMap.get(secondaryId)!.push(comp)
        }

        const children: SGNode[] = []
        for (const [sId, sComps] of sgMap.entries()) {
          children.push({id: sId, name: getGroupName(sId), comps: sortComps(sComps)})
        }
        children.sort((a, b) => {
          if (a.id === 'none') return -1
          if (b.id === 'none') return 1
          const mA = getGroupMinItem(a.id)
          const mB = getGroupMinItem(b.id)
          if (mA !== mB) return mA - mB
          return a.name.localeCompare(b.name, 'ko')
        })
        pNodes.push({id: pId, name: getGroupName(pId), children})
      }

      pNodes.sort((a, b) => {
        if (a.id === 'base') return -1
        if (b.id === 'base') return 1
        if (a.id === 'no_jongsung') return -1
        if (b.id === 'no_jongsung') return 1
        const mA = getGroupMinItem(a.id)
        const mB = getGroupMinItem(b.id)
        if (mA !== mB) return mA - mB
        return a.name.localeCompare(b.name, 'ko')
      })
      tMap.set(key, pNodes)
    }
    return tMap
  })

  function getTreeNodes(type: ComponentType, typeIndex: number): PGNode[] {
    return treeNodesMap.get(`${type}:${typeIndex}`) ?? []
  }
</script>

{#snippet jamoRow(type: ComponentType, char: string, i: number)}
  {@const pNodes = getTreeNodes(type, i)}

  {#snippet compButton(comp: PixelComponent)}
    <ContextMenu.Root>
      <ContextMenu.Trigger class="group relative block h-8.5">
        <Button
          variant="outline"
          class="box-content shrink-0 overflow-hidden rounded p-0"
          style="width: 2rem; height: 2rem;"
          onclick={() => onSelect(comp.id)}
          title={formatConditions(comp.conditions || {})}
        >
          <Thumbnail bitmap={comp.bitmap} size={32} class="transition group-hover:brightness-95" />
        </Button>
      </ContextMenu.Trigger>
      <ContextMenu.Content class="w-52">
        <ContextMenu.Item onSelect={() => onSplit(comp)}>
          <CopyPlus />
          컴포넌트 나누기
        </ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item variant="destructive" onSelect={() => onDelete(comp)}>
          <Trash2 />
          컴포넌트 삭제
        </ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu.Root>
  {/snippet}

  <div class="flex min-w-0 gap-1 rounded-md p-1 hover:bg-muted hover:[&_.label]:bg-muted">
    <span class="w-4 shrink-0 text-center text-base leading-9 font-semibold select-none">{char}</span>
    <div class="ml-1 flex min-w-0 flex-1 flex-wrap gap-1">
      {#each pNodes as pNode}
        {#if pNode.id === 'base'}
          <div class="flex flex-wrap items-center gap-1">
            {#each pNode.children as sNode}
              {#each sNode.comps as comp (comp.id)}
                {@render compButton(comp)}
              {/each}
            {/each}
          </div>
        {:else}
          <div
            class="relative mt-1 flex min-h-9 flex-wrap gap-x-0.5 rounded-[10px] border-2 p-0.5"
            style="border-color: {getGroupColor(pNode.id)};"
          >
            <span
              class="label absolute -top-1.75 left-0.75 bg-sidebar px-px text-[9px] leading-none font-bold whitespace-nowrap"
              style="color: {getGroupColor(pNode.id)}">{pNode.name}</span
            >
            {#each pNode.children as sNode}
              {#if sNode.id === 'none'}
                <div class={['flex flex-wrap items-end gap-1 p-0.75']}>
                  {#each sNode.comps as comp (comp.id)}
                    {@render compButton(comp)}
                  {/each}
                </div>
              {:else}
                <div
                  class="relative mt-2 flex flex-wrap gap-1 rounded-sm border border-dashed p-0.5"
                  style="border-color: {getGroupColor(sNode.id)};"
                >
                  <span
                    class="label absolute -top-2 left-0 rounded bg-sidebar px-px text-[9px] leading-none font-semibold whitespace-nowrap"
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
  <div class="mt-2 flex items-start justify-between pl-1">
    <h3 class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
      {label}
    </h3>
    <Button variant="outline" size="sm" class="h-6 px-2 text-xs" onclick={() => onOpenGroupManager(type)}>
      <Settings class="size-3" /> 그룹 관리
    </Button>
  </div>
{/snippet}

<Tabs.Root bind:value={activeTab as any} class="flex h-full min-h-0 flex-col gap-0">
  <div class="flex shrink-0 items-center justify-between gap-2 border-b py-1 pr-1 pl-4">
    <h2 class="hidden truncate font-bold sm:block">컴포넌트</h2>
    <Tabs.List class="grid max-w-75 flex-1 grid-cols-3">
      <Tabs.Trigger value="chosung">초성</Tabs.Trigger>
      <Tabs.Trigger value="jungsung">중성</Tabs.Trigger>
      <Tabs.Trigger value="jongsung">종성</Tabs.Trigger>
    </Tabs.List>
  </div>

  <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain" bind:this={scrollContainer} onscroll={handleScroll}>
    <div class="space-y-4 px-2 pb-2">
      <Tabs.Content value="chosung" class="m-0 border-none p-0 outline-none">
        {@render sectionHeader('chosung', '초성')}
        {#each CHOSUNG as char, i}
          {@render jamoRow('chosung', char, i)}
        {/each}
      </Tabs.Content>

      <Tabs.Content value="jungsung" class="m-0 border-none p-0 outline-none">
        {@render sectionHeader('jungsung', '중성')}
        {#each JUNGSUNG as char, i}
          {@render jamoRow('jungsung', char, i)}
        {/each}
      </Tabs.Content>

      <Tabs.Content value="jongsung" class="m-0 border-none p-0 outline-none">
        {@render sectionHeader('jongsung', '종성')}
        {#each JONGSUNG as char, i}
          {#if i !== 0}
            {@render jamoRow('jongsung', char, i)}
          {/if}
        {/each}
      </Tabs.Content>
    </div>
  </div>
</Tabs.Root>
