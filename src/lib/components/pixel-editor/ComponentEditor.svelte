<script lang="ts">
  import { Button } from "$lib/components/ui/button"
  import GridCanvas from "./GridCanvas.svelte"
  import TargetSelector from "./TargetSelector.svelte"
  import type { PixelComponent } from "$lib/types"
  import * as ButtonGroup from "$lib/components/ui/button-group/index.js"
  import {ChevronLeft} from '@lucide/svelte'

  interface Props {
    component: PixelComponent
    onSave: (c: PixelComponent) => void
    onCancel: () => void
  }

  let { component, onSave, onCancel }: Props = $props()

  let localComponent = $state<PixelComponent>(
    structuredClone($state.snapshot(component))
  )

  $effect(() => {
    if (component.id !== localComponent.id) {
      localComponent = structuredClone($state.snapshot(component))
    }
  })

  function handleSave() {
    onSave($state.snapshot(localComponent))
  }
</script>

<div class="flex flex-col p-2">
  <div class="flex justify-between items-center mb-4 gap-2">
    <div class="flex items-center">
      <Button variant="ghost" size="icon-sm" onclick={onCancel}><ChevronLeft class="size-6" /></Button>
      <h2 class="font-bold truncate">컴포넌트 편집</h2>
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

  <div class="flex flex-col">
    <div class="flex justify-center mb-4">
      <GridCanvas
        bitmap={localComponent.bitmap}
        onUpdate={(bm) => (localComponent.bitmap = bm)}
      />
    </div>

    <TargetSelector
      targets={localComponent.targets}
      onUpdate={(t) => (localComponent.targets = t)}
    />
  </div>
</div>
