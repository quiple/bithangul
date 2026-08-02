<script lang="ts">
  import type {ComponentType, PixelComponent} from '$lib/types'

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

  const TYPE_LABEL: Record<ComponentType, string> = {chosung: '초성', jungsung: '중성', jongsung: '종성'}
  const JAMO: Record<ComponentType, string[]> = {chosung: CHOSUNG, jungsung: JUNGSUNG, jongsung: JONGSUNG}

  let scrollContainer: HTMLDivElement | undefined = $state()

  onMount(async () => {
    await tick()
    if (scrollContainer && scrollTop > 0) scrollContainer.scrollTop = scrollTop
  })

  function handleScroll(event: Event) {
    scrollTop = (event.currentTarget as HTMLDivElement).scrollTop
  }

  function getVariationId(component: PixelComponent) {
    return Object.keys(component.conditions || {}).find((groupId) => component.conditions[groupId])
  }

  function getVariationName(component: PixelComponent) {
    const variationId = getVariationId(component)
    return projectState.project.groups[component.type].find((group) => group.id === variationId)?.name || '기본 자형'
  }

  function getSortedComponents(type: ComponentType) {
    const variationOrder = new Map(projectState.project.groups[type].map((group, index) => [group.id, index]))
    return components
      .filter((component) => component.type === type)
      .sort((first, second) => {
        if (first.typeIndex !== second.typeIndex) return first.typeIndex - second.typeIndex
        const firstOrder = variationOrder.get(getVariationId(first) || '') ?? Number.MAX_SAFE_INTEGER
        const secondOrder = variationOrder.get(getVariationId(second) || '') ?? Number.MAX_SAFE_INTEGER
        return firstOrder - secondOrder
      })
  }
</script>

{#snippet componentItem(component: PixelComponent)}
  {@const variationName = getVariationName(component)}
  {@const jamo = JAMO[component.type][component.typeIndex]}

  <ContextMenu.Root>
    <ContextMenu.Trigger class="group block min-w-0">
      <Button
        variant="outline"
        class="h-14 w-full min-w-0 justify-start gap-2 overflow-hidden px-2 text-left"
        onclick={() => onSelect(component.id)}
        title={`${TYPE_LABEL[component.type]} ${jamo} · ${variationName}`}
      >
        <span class="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-background">
          <Thumbnail bitmap={component.bitmap} size={40} class="transition group-hover:brightness-95" />
        </span>
        <span class="min-w-0 flex-1 leading-tight">
          <span class="block truncate text-sm font-medium">{variationName}</span>
          <span class="mt-1 block truncate text-xs text-muted-foreground">{TYPE_LABEL[component.type]} {jamo}</span>
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

{#snippet componentSection(type: ComponentType)}
  {@const sortedComponents = getSortedComponents(type)}

  <div class="flex items-center justify-between gap-2 py-2">
    <div class="flex items-baseline gap-1.5 pl-1">
      <h3 class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{TYPE_LABEL[type]}</h3>
      <span class="text-xs text-muted-foreground">{sortedComponents.length}개</span>
    </div>
    <Button variant="outline" size="sm" class="h-7 px-2 text-xs" onclick={() => onOpenGroupManager(type)}>
      <Settings class="size-3" /> 바리에이션 관리
    </Button>
  </div>

  <div class="grid grid-cols-2 gap-2">
    {#each sortedComponents as component (component.id)}
      {@render componentItem(component)}
    {/each}
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
    <div class="px-2 pb-3">
      <Tabs.Content value="chosung" class="m-0 border-none p-0 outline-none">
        {@render componentSection('chosung')}
      </Tabs.Content>
      <Tabs.Content value="jungsung" class="m-0 border-none p-0 outline-none">
        {@render componentSection('jungsung')}
      </Tabs.Content>
      <Tabs.Content value="jongsung" class="m-0 border-none p-0 outline-none">
        {@render componentSection('jongsung')}
      </Tabs.Content>
    </div>
  </div>
</Tabs.Root>
