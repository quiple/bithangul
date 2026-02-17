<script lang="ts">
  import { Button } from "$lib/components/ui/button"
  import GridCanvas from "./GridCanvas.svelte"
  import TargetSelector from "./TargetSelector.svelte"
  import type { PixelComponent } from "$lib/types"
  import * as ButtonGroup from "$lib/components/ui/button-group/index.js";

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
    // When component prop changes (e.g. selection change), update local state
    // Check if ID changed to avoid resetting on local edits if parent passes same object reference
    if (component.id !== localComponent.id) {
      localComponent = structuredClone($state.snapshot(component))
    }
  })

  function handleSave() {
    // Return a plain object, removing proxy
    onSave($state.snapshot(localComponent))
  }
</script>

<div class="flex flex-col p-2">
  <div class="flex justify-between items-center mb-2 pl-2 gap-2">
    <h2 class="font-bold truncate">Edit Component</h2>
    <ButtonGroup.Root>
      <ButtonGroup.Root>
        <Button size="sm" variant="ghost" onclick={onCancel}>Cancel</Button>
      </ButtonGroup.Root>
      <ButtonGroup.Root>
        <Button size="sm" onclick={handleSave}>Save</Button>
      </ButtonGroup.Root>
    </ButtonGroup.Root>
  </div>

  <div class="flex flex-col">
    <div class="flex justify-center">
      <GridCanvas
        bitmap={localComponent.bitmap}
        onUpdate={(bm) => (localComponent.bitmap = bm)}
      />
    </div>

    <div class="border-t pt-4">
      <TargetSelector
        targets={localComponent.targets}
        onUpdate={(t) => (localComponent.targets = t)}
      />
    </div>
  </div>
</div>
