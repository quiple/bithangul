<script lang="ts">
  import type {ComponentType, PixelComponent} from '#lib/types.js'

  import {Button} from '#lib/components/ui/button/index.js'
  import * as Dialog from '#lib/components/ui/dialog/index.js'
  import {Input} from '#lib/components/ui/input/index.js'
  import {Toggle} from '#lib/components/ui/toggle/index.js'
  import {COMPONENT_TYPES, COMPONENT_TYPE_LABELS, JAMO_INDICES, getJamoLabel} from '#lib/hangul.js'
  import {projectState} from '#lib/state.svelte.js'
  import {getVariationGroupName} from '#lib/variation-utils.js'

  interface Props {
    open: boolean
    component: PixelComponent | null
    onOpenChange: (open: boolean) => void
    onSplit: (selections: Partial<Record<ComponentType, number[]>>, customName?: string) => void
  }

  let {open, component, onOpenChange, onSplit}: Props = $props()

  let selectedItems = $state<Record<ComponentType, number[]>>({chosung: [], jungsung: [], jongsung: []})
  let customName = $state('')
  let initializedComponentId = $state<string | null>(null)
  let errorMessage = $state<string | null>(null)

  $effect(() => {
    const componentId = open ? component?.id || null : null
    if (!componentId) {
      initializedComponentId = null
    } else if (componentId !== initializedComponentId) {
      selectedItems = {chosung: [], jungsung: [], jongsung: []}
      customName = ''
      errorMessage = null
      initializedComponentId = componentId
    }
  })

  let availableTypes = $derived(COMPONENT_TYPES.filter((type) => type !== component?.type))

  let eligibleItems = $derived.by(() => {
    const result: Record<ComponentType, number[]> = {chosung: [], jungsung: [], jongsung: []}
    if (!component) return result

    const group = projectState.project.groups[component.type].find((candidate) => component.conditions[candidate.id])
    if (!group) return result
    for (const type of COMPONENT_TYPES) {
      result[type] =
        type === component.type ? [component.typeIndex] : [...(group.conditions[type] || JAMO_INDICES[type])]
    }
    return result
  })

  function getItemLabel(type: ComponentType, index: number) {
    return getJamoLabel(type, index, '없음')
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

  let suggestedName = $derived.by(() => {
    if (!component) return ''
    const conditions = Object.fromEntries(
      availableTypes.map((type) => {
        const selected = selectedItems[type]
        const items =
          selected.length > 0 && selected.length < eligibleItems[type].length ? selected : eligibleItems[type]
        return [type, [...items]]
      }),
    ) as Partial<Record<ComponentType, number[]>>
    return getVariationGroupName(component.type, conditions)
  })

  function handleSplit() {
    const selections = getNormalizedSelections()
    if (Object.keys(selections).length === 0) {
      errorMessage = '현재 적용 범위보다 좁은 조합을 하나 이상 선택해 주세요.'
      return
    }
    onSplit(selections, customName.trim() || undefined)
    onOpenChange(false)
  }

  let componentLabel = $derived.by(() => {
    if (!component) return ''
    return `${COMPONENT_TYPE_LABELS[component.type]} ${getItemLabel(component.type, component.typeIndex)}`
  })
</script>

<Dialog.Root {open} {onOpenChange}>
  <Dialog.Content class="flex max-h-[90vh] flex-col sm:max-w-2xl">
    <Dialog.Header>
      <Dialog.Title>컴포넌트 나누기</Dialog.Title>
      <Dialog.Description>
        {componentLabel} 컴포넌트를 기준으로 새 바리에이션을 만들고, 같은 자모 종류의 모든 행에 추가합니다.
      </Dialog.Description>
    </Dialog.Header>

    <div class="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
      <p class="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
        선택한 조합은 새 바리에이션으로 옮겨지고 원본 바리에이션의 적용 범위에서는 제외됩니다. 새로 만들어지는 모든
        컴포넌트는 각 행의 기존 자형을 복사합니다.
      </p>

      <div class="space-y-2">
        <label for="split-variation-name" class="text-sm font-medium">바리에이션 이름</label>
        <Input id="split-variation-name" bind:value={customName} placeholder={suggestedName} autocomplete="off" />
        <p class="text-xs text-muted-foreground">비워두면 선택한 조합에 맞는 이름을 자동으로 사용합니다.</p>
      </div>

      {#each availableTypes as type}
        <section class="space-y-3 rounded-lg border bg-card p-4">
          <div class="flex items-center justify-between gap-2">
            <div>
              <h3 class="font-semibold">{COMPONENT_TYPE_LABELS[type]} 조합</h3>
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
      <Button onclick={handleSplit}>바리에이션 만들고 나누기</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
