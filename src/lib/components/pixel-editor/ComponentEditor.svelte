<script lang="ts">
  import {Button, HStack, VStack, Heading, Token, StackItem} from '@astryx-svelte/core'
  import {ChevronLeft} from '@lucide/svelte'
  import {untrack} from 'svelte'

  import type {PixelComponent} from '#lib/types.js'

  import {normalizeBaseline} from '#lib/font-metrics.js'
  import {COMPONENT_TYPE_LABELS, getJamoLabel} from '#lib/hangul.js'
  import {projectState} from '#lib/state.svelte.js'

  import ComponentPreviewGrid from './ComponentPreviewGrid.svelte'
  import GridCanvas from './GridCanvas.svelte'

  interface Props {
    component: PixelComponent
    onSave: (c: PixelComponent, baseline: number) => void
    onCancel: () => void
  }

  let {component, onSave, onCancel}: Props = $props()

  // untrack으로 감싸서 초기값만 읽고 반응성 추적 방지 (Svelte 5 lint 해결)
  let localComponent = $state<PixelComponent>(untrack(() => structuredClone($state.snapshot(component))))
  let baseline = $state(untrack(() => normalizeBaseline(projectState.project.baseline, projectState.project.height)))

  $effect(() => {
    // component prop이 바뀌면 로컬 상태 동기화
    const snap = $state.snapshot(component)
    if (snap.id !== localComponent.id) {
      localComponent = structuredClone(snap)
      baseline = normalizeBaseline(projectState.project.baseline, projectState.project.height)
    }
  })

  export function getDraft() {
    return {component: $state.snapshot(localComponent), baseline}
  }

  function handleSave() {
    onSave($state.snapshot(localComponent), baseline)
  }

  let activeGroupNames = $derived.by(() => {
    const ObjectValues = Object.entries(localComponent.conditions || {})
    const names: string[] = []

    const groupNames = new Map(projectState.project.groups[localComponent.type].map((group) => [group.id, group.name]))

    for (const [groupId, isActive] of ObjectValues) {
      if (isActive) {
        const name = groupNames.get(groupId)
        if (name) names.push(name)
      }
    }
    return names
  })
</script>

<VStack height="100%" gap={3} padding={3} class="min-h-0">
  <HStack gap={2} justify="between" align="center" wrap="wrap" class="shrink-0">
    <HStack gap={2} align="center">
      <Button label="컴포넌트 목록으로" isIconOnly variant="ghost" onclick={onCancel}>
        {#snippet icon()}<ChevronLeft />{/snippet}
      </Button>
      <Heading level={3} accessibilityLevel={2}>컴포넌트 편집</Heading>
      <Token
        label={`${COMPONENT_TYPE_LABELS[localComponent.type]} ${getJamoLabel(localComponent.type, localComponent.typeIndex)}`}
      />
    </HStack>
    <HStack gap={2}>
      <Button label="취소" variant="ghost" onclick={onCancel} />
      <Button label="저장" variant="primary" onclick={handleSave} />
    </HStack>
  </HStack>
  {#if activeGroupNames.length > 0}
    <HStack gap={2} wrap="wrap" class="shrink-0">
      {#each activeGroupNames as name}<Token label={name} size="sm" />{/each}
    </HStack>
  {/if}
  <StackItem size="fill" isScrollable>
    <VStack height="100%" gap={4}>
      <StackItem
        ><GridCanvas
          bitmap={localComponent.bitmap}
          bind:baseline
          onUpdate={(bm) => (localComponent.bitmap = bm)}
        /></StackItem
      >
      <ComponentPreviewGrid component={localComponent} />
    </VStack>
  </StackItem>
</VStack>
