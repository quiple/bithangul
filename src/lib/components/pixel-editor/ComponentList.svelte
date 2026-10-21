<script lang="ts">
  import {
    Button,
    ContextMenu,
    TabList,
    Tab,
    Item,
    Grid,
    VStack,
    HStack,
    StackItem,
    Heading,
    Text,
    Badge,
  } from '@astryx-svelte/core'
  import {Settings} from '@lucide/svelte'
  import {onDestroy, onMount, tick} from 'svelte'

  import type {ComponentType, PixelComponent} from '#lib/types.js'

  import {getActiveVariationId} from '#lib/component-utils.js'
  import Thumbnail from '#lib/components/Thumbnail.svelte'
  import {COMPONENT_INDICES, COMPONENT_TYPE_LABELS, JAMO_BY_TYPE, getJamoLabel} from '#lib/hangul.js'
  import {observeSize} from '#lib/observe-size.js'
  import {projectState} from '#lib/state.svelte.js'

  interface Props {
    components: PixelComponent[]
    scrollPositions?: Record<ComponentType, number>
    activeTab?: ComponentType
    onScrollPositionChange: (type: ComponentType, position: number) => void
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
    scrollPositions = {chosung: 0, jungsung: 0, jongsung: 0},
    activeTab = $bindable('chosung'),
    onScrollPositionChange,
    onSelect,
    onSplit,
    onDelete,
    onOpenGroupManager,
  }: Props = $props()

  const HEADING_CONTENT_HEIGHT = 38
  const SECTION_GAP = 8
  const HEADING_HEIGHT = HEADING_CONTENT_HEIGHT + SECTION_GAP
  const COMPONENT_ROW_HEIGHT = 64
  const OVERSCAN_PX = COMPONENT_ROW_HEIGHT * 4

  let scrollContainer: HTMLElement | undefined = $state()
  let viewportHeight = $state(0)

  let currentScrollTop = $state(0)
  let pendingScrollTop = 0
  let scrollFrame = 0
  let viewportWidth = $state(0)
  let columnCount = $derived(viewportWidth >= 640 ? 3 : 2)

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

      for (let index = 0; index < items.length; index += columnCount) {
        const rowComponents = items.slice(index, index + columnCount)
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
    const visibleStart = Math.max(0, currentScrollTop - OVERSCAN_PX)
    const visibleEnd = currentScrollTop + viewportHeight + OVERSCAN_PX

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

  onMount(() => {
    void restoreScrollPosition(activeTab)
  })

  onDestroy(() => {
    if (scrollFrame) cancelAnimationFrame(scrollFrame)
    saveScrollPosition(activeTab, scrollContainer?.scrollTop ?? pendingScrollTop)
  })

  function saveScrollPosition(type: ComponentType, position: number) {
    onScrollPositionChange(type, position)
  }

  async function restoreScrollPosition(type: ComponentType) {
    const targetPosition = scrollPositions[type] ?? 0
    pendingScrollTop = targetPosition
    currentScrollTop = targetPosition

    await tick()
    if (!scrollContainer) return

    scrollContainer.scrollTop = targetPosition
    const restoredPosition = scrollContainer.scrollTop
    pendingScrollTop = restoredPosition
    currentScrollTop = restoredPosition

    if (restoredPosition !== targetPosition) saveScrollPosition(type, restoredPosition)
  }

  function handleTabChange(value: string) {
    const nextTab = value as ComponentType
    if (nextTab === activeTab) return

    if (scrollFrame) {
      cancelAnimationFrame(scrollFrame)
      scrollFrame = 0
    }

    saveScrollPosition(activeTab, scrollContainer?.scrollTop ?? pendingScrollTop)
    activeTab = nextTab
    void restoreScrollPosition(nextTab)
  }

  function handleScroll(event: Event) {
    const scrolledTab = activeTab
    pendingScrollTop = (event.currentTarget as HTMLDivElement).scrollTop
    if (scrollFrame) return
    scrollFrame = requestAnimationFrame(() => {
      currentScrollTop = pendingScrollTop
      saveScrollPosition(scrolledTab, pendingScrollTop)
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
  <ContextMenu
    label="컴포넌트 작업"
    items={[
      {label: '컴포넌트 나누기', onClick: () => onSplit(component)},
      {type: 'divider'},
      {label: '컴포넌트 삭제', variant: 'destructive', onClick: () => onDelete(component)},
    ]}
  >
    <Item
      label={variationName}
      description={`${COMPONENT_TYPE_LABELS[component.type]} ${jamo}`}
      onclick={() => onSelect(component.id)}
    >
      {#snippet startContent()}<Thumbnail bitmap={component.bitmap} size={40} />{/snippet}
    </Item>
  </ContextMenu>
{/snippet}

<VStack height="100%" class="min-h-0">
  <HStack padding={3} gap={2} justify="between" align="center" class="shrink-0 border-b border-border">
    <Heading level={3} accessibilityLevel={2}>컴포넌트</Heading>
    <TabList value={activeTab} onChange={handleTabChange} role="tablist" aria-label="자모 종류" size="sm">
      <Tab value="chosung" label="초성" panelId="component-list-panel" />
      <Tab value="jungsung" label="중성" panelId="component-list-panel" />
      <Tab value="jongsung" label="종성" panelId="component-list-panel" />
    </TabList>
  </HStack>
  <HStack paddingInline={3} paddingBlock={2} gap={2} justify="between" align="center" class="shrink-0">
    <HStack gap={2} align="center"
      ><Text type="label">{COMPONENT_TYPE_LABELS[activeTab]}</Text><Badge
        label={String(listLayout.totalComponents)}
      /></HStack
    >
    <Button label="바리에이션 관리" size="sm" onclick={() => onOpenGroupManager(activeTab)}
      >{#snippet icon()}<Settings />{/snippet}</Button
    >
  </HStack>
  <StackItem
    size="fill"
    isScrollable
    id="component-list-panel"
    role="tabpanel"
    aria-label={COMPONENT_TYPE_LABELS[activeTab]}
    {...observeSize((element) => {
      scrollContainer = element
      viewportHeight = element.clientHeight
      viewportWidth = element.clientWidth
    })}
    onscroll={handleScroll}
  >
    <VStack height={visibleRows[0]?.top ?? 0} aria-hidden="true" />
    {#each visibleRows as row (row.key)}
      <VStack height={row.height} justify="center">
        {#if row.kind === 'heading'}
          <HStack paddingInline={3} gap={2} align="center">
            <Heading level={4}>{JAMO_BY_TYPE[activeTab][row.typeIndex]}</Heading><Text type="supporting"
              >{row.count}개</Text
            >
          </HStack>
        {:else}
          <Grid columns={columnCount} gap={2} class="px-3 pb-2">
            {#each row.components as component (component.id)}
              <VStack height={56} justify="center" class="min-w-0 overflow-hidden rounded-lg border border-border">
                {@render componentItem(component)}
              </VStack>
            {/each}
          </Grid>
        {/if}
      </VStack>
    {/each}
    <VStack
      height={Math.max(
        0,
        listLayout.totalHeight - ((visibleRows.at(-1)?.top ?? 0) + (visibleRows.at(-1)?.height ?? 0)),
      )}
      aria-hidden="true"
    />
  </StackItem>
</VStack>
