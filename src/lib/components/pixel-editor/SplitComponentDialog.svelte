<script lang="ts">
  import type {ComponentType, PixelComponent} from '$lib/types'

  import {Button} from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import {Toggle} from '$lib/components/ui/toggle/index.js'
  import {checkConditionMatch} from '$lib/conditions'
  import {CHOSUNG, JUNGSUNG, JONGSUNG} from '$lib/hangul'
  import {projectState} from '$lib/state.svelte'

  interface Props {
    open: boolean
    component: PixelComponent | null
    onOpenChange: (open: boolean) => void
    onSplit: (selections: Partial<Record<ComponentType, number[]>>) => void
  }

  let {open, component, onOpenChange, onSplit}: Props = $props()

  const TYPES: ComponentType[] = ['chosung', 'jungsung', 'jongsung']
  const TYPE_LABEL: Record<ComponentType, string> = {
    chosung: '초성',
    jungsung: '중성',
    jongsung: '종성',
  }
  const ITEMS: Record<ComponentType, string[]> = {
    chosung: CHOSUNG,
    jungsung: JUNGSUNG,
    jongsung: JONGSUNG,
  }

  let selectedItems = $state<Record<ComponentType, number[]>>({chosung: [], jungsung: [], jongsung: []})
  let initializedComponentId = $state<string | null>(null)
  let errorMessage = $state<string | null>(null)

  $effect(() => {
    const componentId = open ? component?.id || null : null
    if (!componentId) {
      initializedComponentId = null
    } else if (componentId !== initializedComponentId) {
      selectedItems = {chosung: [], jungsung: [], jongsung: []}
      errorMessage = null
      initializedComponentId = componentId
    }
  })

  let availableTypes = $derived(TYPES.filter((type) => type !== component?.type))

  let eligibleItems = $derived.by(() => {
    const result: Record<ComponentType, number[]> = {chosung: [], jungsung: [], jongsung: []}
    if (!component) return result

    const found: Record<ComponentType, Set<number>> = {
      chosung: new Set(),
      jungsung: new Set(),
      jongsung: new Set(),
    }
    for (let cho = 0; cho < CHOSUNG.length; cho++) {
      if (component.type === 'chosung' && component.typeIndex !== cho) continue
      for (let jung = 0; jung < JUNGSUNG.length; jung++) {
        if (component.type === 'jungsung' && component.typeIndex !== jung) continue
        for (let jong = 0; jong < JONGSUNG.length; jong++) {
          if (component.type === 'jongsung' && component.typeIndex !== jong) continue
          if (!checkConditionMatch(cho, jung, jong, component.conditions || {}, projectState.project.groups)) continue
          found.chosung.add(cho)
          found.jungsung.add(jung)
          found.jongsung.add(jong)
        }
      }
    }

    for (const type of TYPES) result[type] = [...found[type]].sort((a, b) => a - b)
    return result
  })

  function getItemLabel(type: ComponentType, index: number) {
    return type === 'jongsung' && index === 0 ? '없음' : ITEMS[type][index]
  }

  function toggleItem(type: ComponentType, index: number) {
    const current = selectedItems[type]
    selectedItems[type] = current.includes(index)
      ? current.filter((item) => item !== index)
      : [...current, index].sort((a, b) => a - b)
    errorMessage = null
  }

  function selectAll(type: ComponentType) {
    selectedItems[type] = [...eligibleItems[type]]
    errorMessage = null
  }

  function clearSelection(type: ComponentType) {
    selectedItems[type] = []
    errorMessage = null
  }

  function getNormalizedSelections() {
    const selections: Partial<Record<ComponentType, number[]>> = {}
    for (const type of availableTypes) {
      const selected = selectedItems[type]
      if (selected.length > 0 && selected.length < eligibleItems[type].length) selections[type] = [...selected]
    }
    return selections
  }

  function handleSplit() {
    const selections = getNormalizedSelections()
    if (Object.keys(selections).length === 0) {
      errorMessage = '현재 적용 범위보다 좁은 조합을 하나 이상 선택해 주세요.'
      return
    }
    onSplit(selections)
    onOpenChange(false)
  }

  let componentLabel = $derived.by(() => {
    if (!component) return ''
    return `${TYPE_LABEL[component.type]} ${getItemLabel(component.type, component.typeIndex)}`
  })
</script>

<Dialog.Root {open} {onOpenChange}>
  <Dialog.Content class="flex max-h-[90vh] flex-col sm:max-w-2xl">
    <Dialog.Header>
      <Dialog.Title>컴포넌트 나누기</Dialog.Title>
      <Dialog.Description>
        {componentLabel} 컴포넌트를 기준으로 그룹 규칙을 만들고, 같은 자모 종류의 모든 행에 바리에이션을 추가합니다.
      </Dialog.Description>
    </Dialog.Header>

    <div class="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
      <p class="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
        선택한 각 영역은 그룹 관리에 새 그룹으로 추가됩니다. 새로 만들어지는 모든 컴포넌트는 각 행의 기존 자형을
        복사합니다. 선택하지 않거나 모두 선택한 영역은 새 그룹을 만들지 않습니다.
      </p>

      {#each availableTypes as type}
        <section class="space-y-3 rounded-lg border bg-card p-4">
          <div class="flex items-center justify-between gap-2">
            <div>
              <h3 class="font-semibold">{TYPE_LABEL[type]} 조합</h3>
              <p class="text-xs text-muted-foreground">
                {selectedItems[type].length}/{eligibleItems[type].length}개 선택
              </p>
            </div>
            <div class="flex gap-1">
              <Button variant="ghost" size="sm" onclick={() => selectAll(type)}>모두</Button>
              <Button variant="ghost" size="sm" onclick={() => clearSelection(type)}>해제</Button>
            </div>
          </div>

          <div class="grid grid-cols-5 gap-1 sm:grid-cols-10">
            {#each eligibleItems[type] as index}
              <Toggle
                variant="outline"
                class="bg-background text-base transition data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:font-semibold data-[state=on]:text-primary-foreground"
                pressed={selectedItems[type].includes(index)}
                onPressedChange={() => toggleItem(type, index)}
              >
                <span class:text-xs={type === 'jongsung' && index === 0}>{getItemLabel(type, index)}</span>
              </Toggle>
            {/each}
          </div>
        </section>
      {/each}

      {#if errorMessage}
        <p class="text-sm font-medium text-destructive">{errorMessage}</p>
      {/if}
    </div>

    <Dialog.Footer class="pt-2">
      <Button variant="outline" onclick={() => onOpenChange(false)}>취소</Button>
      <Button onclick={handleSplit}>그룹 만들고 나누기</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
