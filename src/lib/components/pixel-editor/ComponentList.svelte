<script lang="ts">
  import type {ComponentType, PixelComponent} from '$lib/types'

  import {getActiveVariationId} from '$lib/component-utils'
  import Thumbnail from '$lib/components/Thumbnail.svelte'
  import {Button} from '$lib/components/ui/button'
  import * as ContextMenu from '$lib/components/ui/context-menu/index.js'
  import * as Tabs from '$lib/components/ui/tabs'
  import {COMPONENT_INDICES, COMPONENT_TYPE_LABELS, JAMO_BY_TYPE, getJamoLabel} from '$lib/hangul'
  import {projectState} from '$lib/state.svelte'
  import {CopyPlus, Settings, Trash2} from '@lucide/svelte'
  import {onDestroy, onMount, tick} from 'svelte'

  interface Props {
    components: PixelComponent[]
    scrollTop?: number
    activeTab?: ComponentType
    onSelect: (id: string) => void
    onSplit: (component: PixelComponent) => void
    onDelete: (component: PixelComponent) => void
    onOpenGroupManager: (type: ComponentType) => void
  }

  interface HeadingRow {
    kind: 'heading'
    key: string
    typeIndex: number
    count: number
  }

  interface ComponentRow {
    kind: 'components'
    key: string
    components: PixelComponent[]
  }

  type ListRow = HeadingRow | ComponentRow
  type PositionedRow = ListRow & {top: number; height: number}

  let {
    components,
    scrollTop = $bindable(0),
    activeTab = $bindable('chosung'),
    onSelect,
    onSplit,
    onDelete,
    onOpenGroupManager,
  }: Props = $props()

  const HEADING_HEIGHT = 38
  const COMPONENT_ROW_HEIGHT = 64
  const OVERSCAN_PX = COMPONENT_ROW_HEIGHT * 4

  let scrollContainer: HTMLDivElement | undefined = $state()
  let viewportHeight = $state(0)
  let pendingScrollTop = scrollTop
  let scrollFrame = 0

  let activeGroups = $derived(projectState.project.groups[activeTab])

  let variationNames = $derived.by(() => {
    return new Map(activeGroups.map((group) => [group.id, group.name]))
  })

  let listLayout = $derived.by(() => {
    const variationOrder = new Map(activeGroups.map((group, index) => [group.id, index]))
    const componentsByIndex = new Map<number, PixelComponent[]>()

    for (const component of components) {
      if (component.type !== activeTab) continue
      const items = componentsByIndex.get(component.typeIndex)
      if (items) items.push(component)
      else componentsByIndex.set(component.typeIndex, [component])
    }

    const rows: PositionedRow[] = []
    let top = 0
    let totalComponents = 0

    for (const typeIndex of COMPONENT_INDICES[activeTab]) {
      const items = componentsByIndex.get(typeIndex) || []
      items.sort((first, second) => {
        const firstOrder = variationOrder.get(getActiveVariationId(first) || '') ?? Number.MAX_SAFE_INTEGER
        const secondOrder = variationOrder.get(getActiveVariationId(second) || '') ?? Number.MAX_SAFE_INTEGER
        return firstOrder - secondOrder
      })
      totalComponents += items.length

      rows.push({
        kind: 'heading',
        key: `heading:${activeTab}:${typeIndex}`,
        typeIndex,
        count: items.length,
        top,
        height: HEADING_HEIGHT,
      })
      top += HEADING_HEIGHT

      for (let index = 0; index < items.length; index += 2) {
        const rowComponents = items.slice(index, index + 2)
        rows.push({
          kind: 'components',
          key: `components:${activeTab}:${rowComponents.map((component) => component.id).join(':')}`,
          components: rowComponents,
          top,
          height: COMPONENT_ROW_HEIGHT,
        })
        top += COMPONENT_ROW_HEIGHT
      }
    }

    return {rows, totalHeight: top, totalComponents}
  })

  let visibleRows = $derived.by(() => {
    const rows = listLayout.rows
    const visibleStart = Math.max(0, scrollTop - OVERSCAN_PX)
    const visibleEnd = scrollTop + viewportHeight + OVERSCAN_PX

    let low = 0
    let high = rows.length
    while (low < high) {
      const middle = (low + high) >> 1
      const row = rows[middle]
      if (row.top + row.height <= visibleStart) low = middle + 1
      else high = middle
    }

    const startIndex = low
    while (low < rows.length && rows[low].top < visibleEnd) low++
    return rows.slice(startIndex, low)
  })

  onMount(async () => {
    await tick()
    if (scrollContainer && scrollTop > 0) scrollContainer.scrollTop = scrollTop
  })

  onDestroy(() => {
    if (scrollFrame) cancelAnimationFrame(scrollFrame)
    scrollTop = pendingScrollTop
  })

  function handleScroll(event: Event) {
    pendingScrollTop = (event.currentTarget as HTMLDivElement).scrollTop
    if (scrollFrame) return
    scrollFrame = requestAnimationFrame(() => {
      scrollTop = pendingScrollTop
      scrollFrame = 0
    })
  }

  function getVariationName(component: PixelComponent) {
    return variationNames.get(getActiveVariationId(component) || '') || '기본 자형'
  }
</script>

{#snippet componentItem(component: PixelComponent)}
  {@const variationName = getVariationName(component)}
  {@const jamo = getJamoLabel(component.type, component.typeIndex)}

  <ContextMenu.Root>
    <ContextMenu.Trigger class="group block min-w-0">
      <Button
        variant="outline"
        class="h-14 w-full min-w-0 justify-start gap-2 overflow-hidden px-2 text-left"
        onclick={() => onSelect(component.id)}
        title={`${COMPONENT_TYPE_LABELS[component.type]} ${jamo} · ${variationName}`}
      >
        <span class="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-background">
          <Thumbnail bitmap={component.bitmap} size={40} class="transition group-hover:brightness-95" />
        </span>
        <span class="min-w-0 flex-1 leading-tight">
          <span class="block truncate text-sm font-medium">{variationName}</span>
          <span class="mt-1 block truncate text-xs text-muted-foreground"
            >{COMPONENT_TYPE_LABELS[component.type]} {jamo}</span
          >
        </span>
      </Button>
    </ContextMenu.Trigger>
    <ContextMenu.Content class="w-52">
      <ContextMenu.Item onSelect={() => onSplit(component)}>
        <CopyPlus />
        컴포넌트 나누기
      </ContextMenu.Item>
      <ContextMenu.Separator />
      <ContextMenu.Item variant="destructive" onSelect={() => onDelete(component)}>
        <Trash2 />
        컴포넌트 삭제
      </ContextMenu.Item>
    </ContextMenu.Content>
  </ContextMenu.Root>
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

  <div class="flex shrink-0 items-center justify-between gap-2 px-3 py-2">
    <div class="flex items-baseline gap-1.5">
      <h3 class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {COMPONENT_TYPE_LABELS[activeTab]}
      </h3>
      <span class="text-xs text-muted-foreground">{listLayout.totalComponents}개</span>
    </div>
    <Button variant="outline" size="sm" class="h-7 px-2 text-xs" onclick={() => onOpenGroupManager(activeTab)}>
      <Settings class="size-3" /> 바리에이션 관리
    </Button>
  </div>

  <div
    class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
    bind:this={scrollContainer}
    bind:clientHeight={viewportHeight}
    onscroll={handleScroll}
  >
    <div class="relative mx-2" style={`height: ${listLayout.totalHeight}px`}>
      {#each visibleRows as row (row.key)}
        <div class="absolute inset-x-0 top-0" style={`height: ${row.height}px; transform: translateY(${row.top}px)`}>
          {#if row.kind === 'heading'}
            <div class="flex h-full items-center gap-2 border-b">
              <h4 class="text-base font-bold">{JAMO_BY_TYPE[activeTab][row.typeIndex]}</h4>
              <span class="text-xs text-muted-foreground">{row.count}개</span>
            </div>
          {:else}
            <div class="grid grid-cols-2 gap-2 pb-2">
              {#each row.components as component (component.id)}
                {@render componentItem(component)}
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</Tabs.Root>
