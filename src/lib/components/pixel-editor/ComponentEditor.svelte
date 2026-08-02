<script lang="ts">
  import type {PixelComponent} from '$lib/types'

  import {Button} from '$lib/components/ui/button'
  import * as ButtonGroup from '$lib/components/ui/button-group/index.js'
  import {COMPONENT_TYPE_LABELS, getJamoLabel} from '$lib/hangul'
  import {projectState} from '$lib/state.svelte'
  import {ChevronLeft} from '@lucide/svelte'
  import {untrack} from 'svelte'

  import ComponentPreviewGrid from './ComponentPreviewGrid.svelte'
  import GridCanvas from './GridCanvas.svelte'

  interface Props {
    component: PixelComponent
    onSave: (c: PixelComponent) => void
    onCancel: () => void
  }

  let {component, onSave, onCancel}: Props = $props()

  // untrack으로 감싸서 초기값만 읽고 반응성 추적 방지 (Svelte 5 lint 해결)
  let localComponent = $state<PixelComponent>(untrack(() => structuredClone($state.snapshot(component))))

  $effect(() => {
    // component prop이 바뀌면 로컬 상태 동기화
    const snap = $state.snapshot(component)
    if (snap.id !== localComponent.id) {
      localComponent = structuredClone(snap)
    }
  })

  function handleSave() {
    onSave($state.snapshot(localComponent))
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

<div class="flex h-full flex-col p-2">
  <div class="flex items-center justify-between gap-2">
    <div class="flex flex-wrap items-center gap-2">
      <Button variant="ghost" size="icon-sm" onclick={onCancel}><ChevronLeft class="size-6" /></Button>
      <h2 class="flex items-center truncate font-bold">
        컴포넌트 편집 <span class="ml-2 rounded bg-ring px-1 py-0.5 text-sm text-primary-foreground"
          >{COMPONENT_TYPE_LABELS[localComponent.type]}
          {getJamoLabel(localComponent.type, localComponent.typeIndex)}</span
        >
      </h2>
    </div>
    <ButtonGroup.Root>
      <ButtonGroup.Root>
        <Button size="sm" variant="ghost" onclick={onCancel}>취소</Button>
      </ButtonGroup.Root>
      <ButtonGroup.Root>
        <Button size="sm" onclick={handleSave}>저장</Button>
      </ButtonGroup.Root>
    </ButtonGroup.Root>
  </div>

  {#if activeGroupNames.length > 0}
    <div class="mt-2 ml-2 flex flex-wrap gap-2">
      {#each activeGroupNames as name}
        <span class="rounded border bg-secondary px-1.5 py-0.5 text-sm text-secondary-foreground">{name}</span>
      {/each}
    </div>
  {/if}

  <div class="mt-4 flex min-h-0 flex-1 flex-col">
    <div class="mb-4 flex justify-center">
      <GridCanvas bitmap={localComponent.bitmap} onUpdate={(bm) => (localComponent.bitmap = bm)} />
    </div>

    <ComponentPreviewGrid component={localComponent} />
  </div>
</div>
