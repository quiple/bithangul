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
    StackItem,
  } from '@astryx-svelte/core'
  import {Plus, Trash} from '@lucide/svelte'

  import type {ComponentType, JamoGroup} from '#lib/types.js'

  import {COMPONENT_TYPES, COMPONENT_TYPE_LABELS, JAMO_BY_TYPE, JAMO_INDICES, getJamoLabel} from '#lib/hangul.js'

  interface Props {
    open: boolean
    type: ComponentType | null
    initialGroups: JamoGroup[]
    onOpenChange: (open: boolean) => void
    onSave: (groups: JamoGroup[]) => void
  }

  let {open, type, initialGroups, onOpenChange, onSave}: Props = $props()

  let draftGroups = $state<JamoGroup[]>([])
  let errorMsg = $state<string | null>(null)

  function getConditionTypes(targetType: ComponentType | null = type) {
    return targetType ? COMPONENT_TYPES.filter((conditionType) => conditionType !== targetType) : []
  }

  function getAllItems(conditionType: ComponentType) {
    return [...JAMO_INDICES[conditionType]]
  }

  $effect(() => {
    if (!open || !type) return
    const nextGroups = initialGroups.map((group) => ({
      ...group,
      conditions: Object.fromEntries(
        getConditionTypes(type).map((conditionType) => [
          conditionType,
          [...(group.conditions[conditionType] || getAllItems(conditionType))],
        ]),
      ),
    }))
    draftGroups = nextGroups
    errorMsg = null
  })

  function addGroup() {
    if (!type) return
    const group: JamoGroup = {
      id: crypto.randomUUID(),
      name: `${COMPONENT_TYPE_LABELS[type]} 바리에이션 ${draftGroups.length + 1}`,
      conditions: Object.fromEntries(
        getConditionTypes(type).map((conditionType) => [conditionType, getAllItems(conditionType)]),
      ),
    }
    draftGroups = [...draftGroups, group]
  }

  function removeGroup(index: number) {
    draftGroups = draftGroups.filter((_, groupIndex) => groupIndex !== index)
  }

  function toggleItem(groupIndex: number, conditionType: ComponentType, itemIndex: number) {
    const current = draftGroups[groupIndex].conditions[conditionType] || []
    const items = current.includes(itemIndex)
      ? current.filter((index) => index !== itemIndex)
      : [...current, itemIndex].sort((a, b) => a - b)
    updateCondition(groupIndex, conditionType, items)
    errorMsg = null
  }

  function selectAll(groupIndex: number, conditionType: ComponentType) {
    updateCondition(groupIndex, conditionType, getAllItems(conditionType))
    errorMsg = null
  }

  function clearSelection(groupIndex: number, conditionType: ComponentType) {
    updateCondition(groupIndex, conditionType, [])
    errorMsg = null
  }

  function updateCondition(groupIndex: number, conditionType: ComponentType, items: number[]) {
    draftGroups = draftGroups.map((group, index) =>
      index === groupIndex ? {...group, conditions: {...group.conditions, [conditionType]: items}} : group,
    )
  }

  function validate() {
    if (!type) return '관리할 컴포넌트 종류를 선택해 주세요.'
    const seen = new Set<string>()
    for (const group of draftGroups) {
      if (!group.name.trim()) return '바리에이션 이름을 입력해 주세요.'
      for (const conditionType of getConditionTypes()) {
        if ((group.conditions[conditionType] || []).length === 0) {
          return `${COMPONENT_TYPE_LABELS[conditionType]} 조건을 최소 하나 이상 선택해 주세요.`
        }
      }
      const key = getConditionTypes()
        .map(
          (conditionType) => `${conditionType}:${[...(group.conditions[conditionType] || [])].sort((a, b) => a - b)}`,
        )
        .join('|')
      if (seen.has(key)) return '완전히 같은 조합 조건을 가진 바리에이션이 이미 존재합니다.'
      seen.add(key)
    }
    return null
  }

  function handleSave() {
    const error = validate()
    if (error) {
      errorMsg = error
      return
    }
    onSave(
      draftGroups.map((group) => ({
        id: group.id,
        name: group.name,
        splitOperationId: group.splitOperationId,
        conditions: Object.fromEntries(
          Object.entries(group.conditions).map(([conditionType, items]) => [conditionType, items ? [...items] : items]),
        ),
      })),
    )
  }

  function getItemLabel(conditionType: ComponentType, index: number) {
    return getJamoLabel(conditionType, index, '없음')
  }
</script>

<Dialog isOpen={open} {onOpenChange} purpose="form" width={896}>
  <DialogHeader
    title={type ? `${COMPONENT_TYPE_LABELS[type]} 바리에이션 관리` : '바리에이션 관리'}
    subtitle="자형이 사용될 다른 자모 조합을 바리에이션별로 설정합니다."
    {onOpenChange}
  />
  <VStack padding={4} gap={6} isScrollable class="min-h-0">
    {#each draftGroups as group, groupIndex (group.id)}
      <VStack as="section" gap={4} class="border-default border-b" paddingBlockEnd={4}>
        <HStack gap={3} align="end">
          <StackItem size="fill"
            ><TextInput
              label="바리에이션 이름"
              value={group.name}
              onChange={(value) => (group.name = value)}
              isRequired
            /></StackItem
          >
          <Button label={`${group.name} 삭제`} isIconOnly variant="ghost" onclick={() => removeGroup(groupIndex)}>
            {#snippet icon()}<Trash />{/snippet}
          </Button>
        </HStack>
        {#each getConditionTypes() as conditionType}
          <VStack gap={2}>
            <HStack justify="between" align="center" gap={2}>
              <VStack gap={1}>
                <Heading level={4}>{COMPONENT_TYPE_LABELS[conditionType]} 조건</Heading>
                <Text type="supporting"
                  >{(group.conditions[conditionType] || []).length}/{JAMO_BY_TYPE[conditionType].length}개 선택</Text
                >
              </VStack>
              <HStack gap={1}>
                <Button label="모두" variant="ghost" size="sm" onclick={() => selectAll(groupIndex, conditionType)} />
                <Button
                  label="해제"
                  variant="ghost"
                  size="sm"
                  onclick={() => clearSelection(groupIndex, conditionType)}
                />
              </HStack>
            </HStack>
            <Grid columns={{minWidth: 40, max: 14}} gap={1}>
              {#each JAMO_BY_TYPE[conditionType] as _, itemIndex}
                <ToggleButton
                  label={getItemLabel(conditionType, itemIndex)}
                  isPressed={(group.conditions[conditionType] || []).includes(itemIndex)}
                  onPressedChange={() => toggleItem(groupIndex, conditionType, itemIndex)}
                />
              {/each}
            </Grid>
          </VStack>
        {/each}
      </VStack>
    {/each}
    <Button label={`새 ${type ? COMPONENT_TYPE_LABELS[type] : ''} 바리에이션 추가`} onclick={addGroup}>
      {#snippet icon()}<Plus />{/snippet}
    </Button>
    {#if errorMsg}<Text role="alert" class="text-error">{errorMsg}</Text>{/if}
  </VStack>
  <HStack padding={4} gap={2} justify="end" class="border-default shrink-0 border-t">
    <Button label="취소" onclick={() => onOpenChange(false)} />
    <Button label="저장" variant="primary" onclick={handleSave} />
  </HStack>
</Dialog>
