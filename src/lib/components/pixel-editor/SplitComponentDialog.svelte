<script lang="ts">
  import {
    Button,
    Dialog,
    DialogHeader,
    TextInput,
    ToggleButton,
    VStack,
    HStack,
    Grid,
    Heading,
    Text,
  } from '@astryx-svelte/core'

  import type {ComponentType, PixelComponent} from '#lib/types.js'

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

<Dialog isOpen={open} {onOpenChange} purpose="form" width={672}>
  <DialogHeader
    title="컴포넌트 나누기"
    subtitle={`${componentLabel} 컴포넌트를 기준으로 새 바리에이션을 만들고, 같은 자모 종류의 모든 행에 추가합니다.`}
    {onOpenChange}
  />
  <VStack padding={4} gap={4} isScrollable class="min-h-0">
    <Text type="supporting"
      >선택한 조합은 새 바리에이션으로 옮겨지고 원본 바리에이션의 적용 범위에서는 제외됩니다. 새로 만들어지는 모든
      컴포넌트는 각 행의 기존 자형을 복사합니다.</Text
    >
    <TextInput
      label="바리에이션 이름"
      value={customName}
      onChange={(value) => (customName = value)}
      placeholder={suggestedName}
      description="비워두면 선택한 조합에 맞는 이름을 자동으로 사용합니다."
    />
    {#each availableTypes as type}
      <VStack as="section" gap={3}>
        <HStack justify="between" align="center" gap={2}>
          <VStack gap={1}>
            <Heading level={3}>{COMPONENT_TYPE_LABELS[type]} 조합</Heading>
            <Text type="supporting">{selectedItems[type].length}/{eligibleItems[type].length}개 선택</Text>
          </VStack>
          <HStack gap={1}>
            <Button label="모두" variant="ghost" size="sm" onclick={() => selectAll(type)} />
            <Button label="해제" variant="ghost" size="sm" onclick={() => clearSelection(type)} />
          </HStack>
        </HStack>
        <Grid columns={{minWidth: 40, max: 10}} gap={1}>
          {#each eligibleItems[type] as index}
            <ToggleButton
              label={getItemLabel(type, index)}
              isPressed={selectedItems[type].includes(index)}
              onPressedChange={() => toggleItem(type, index)}
            />
          {/each}
        </Grid>
      </VStack>
    {/each}
    {#if errorMessage}<Text role="alert" class="text-error">{errorMessage}</Text>{/if}
  </VStack>
  <HStack padding={4} gap={2} justify="end" class="border-default shrink-0 border-t">
    <Button label="취소" onclick={() => onOpenChange(false)} />
    <Button label="바리에이션 만들고 나누기" variant="primary" onclick={handleSplit} />
  </HStack>
</Dialog>
