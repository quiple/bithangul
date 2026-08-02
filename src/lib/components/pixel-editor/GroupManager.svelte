<script lang="ts">
  import type {ComponentType, JamoGroup} from '$lib/types'

  import {Button} from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import {Input} from '$lib/components/ui/input/index.js'
  import {Toggle} from '$lib/components/ui/toggle/index.js'
  import {COMPONENT_TYPES, COMPONENT_TYPE_LABELS, JAMO_BY_TYPE, JAMO_INDICES, getJamoLabel} from '$lib/hangul'
  import {Plus, Trash} from '@lucide/svelte'

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

<Dialog.Root {open} {onOpenChange}>
  <Dialog.Content class="flex max-h-[92vh] flex-col sm:max-w-4xl">
    <Dialog.Header>
      <Dialog.Title>{type ? `${COMPONENT_TYPE_LABELS[type]} 바리에이션 관리` : '바리에이션 관리'}</Dialog.Title>
      <Dialog.Description>
        {type
          ? `${COMPONENT_TYPE_LABELS[type]} 자형이 사용될 다른 자모 조합을 바리에이션별로 설정합니다.`
          : '컴포넌트 바리에이션을 관리합니다.'}
      </Dialog.Description>
    </Dialog.Header>

    <div class="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
      {#each draftGroups as group, groupIndex (group.id)}
        <section
          class="space-y-4 rounded-lg border bg-card p-4"
          style="content-visibility: auto; contain-intrinsic-size: auto 26rem;"
        >
          <div class="flex items-center gap-3">
            <Input bind:value={group.name} placeholder="바리에이션 이름" class="max-w-80" />
            <div class="flex-1"></div>
            <Button
              variant="ghost"
              size="icon-sm"
              class="shrink-0 text-destructive"
              onclick={() => removeGroup(groupIndex)}
              aria-label={`${group.name} 삭제`}
            >
              <Trash class="size-4" />
            </Button>
          </div>

          {#each getConditionTypes() as conditionType}
            <div class="space-y-2 rounded-md bg-muted/40 p-3">
              <div class="flex items-center justify-between gap-2">
                <div>
                  <h3 class="text-sm font-semibold">{COMPONENT_TYPE_LABELS[conditionType]} 조건</h3>
                  <p class="text-xs text-muted-foreground">
                    {(group.conditions[conditionType] || []).length}/{JAMO_BY_TYPE[conditionType].length}개 선택
                  </p>
                </div>
                <div class="flex gap-1">
                  <Button variant="ghost" size="sm" onclick={() => selectAll(groupIndex, conditionType)}>모두</Button>
                  <Button variant="ghost" size="sm" onclick={() => clearSelection(groupIndex, conditionType)}
                    >해제</Button
                  >
                </div>
              </div>

              <div class="grid grid-cols-5 gap-1 sm:grid-cols-10 lg:grid-cols-14">
                {#each JAMO_BY_TYPE[conditionType] as _, itemIndex}
                  <Toggle
                    variant="outline"
                    class="bg-background text-base transition data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:font-semibold data-[state=on]:text-primary-foreground"
                    pressed={(group.conditions[conditionType] || []).includes(itemIndex)}
                    onPressedChange={() => toggleItem(groupIndex, conditionType, itemIndex)}
                  >
                    <span class:text-xs={conditionType === 'jongsung' && itemIndex === 0}>
                      {getItemLabel(conditionType, itemIndex)}
                    </span>
                  </Toggle>
                {/each}
              </div>
            </div>
          {/each}
        </section>
      {/each}

      <Button variant="outline" class="w-full border-dashed py-8 text-muted-foreground" onclick={addGroup}>
        <Plus class="size-4" />
        새 {type ? COMPONENT_TYPE_LABELS[type] : ''} 바리에이션 추가
      </Button>

      {#if errorMsg}
        <p class="text-sm font-medium text-destructive">{errorMsg}</p>
      {/if}
    </div>

    <Dialog.Footer class="pt-2">
      <Button variant="outline" onclick={() => onOpenChange(false)}>취소</Button>
      <Button onclick={handleSave}>저장</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
