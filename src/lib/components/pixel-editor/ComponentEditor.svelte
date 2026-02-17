<script lang="ts">
  import { Button } from "$lib/components/ui/button"
  import GridCanvas from "./GridCanvas.svelte"
  import TargetSelector from "./TargetSelector.svelte"
  import type { PixelComponent } from "$lib/types"

  interface Props {
    component: PixelComponent
    onSave: (c: PixelComponent) => void
    onCancel: () => void
  }

  let { component, onSave, onCancel }: Props = $props()

  let localComponent = $state<PixelComponent>(
    JSON.parse(JSON.stringify(component)),
  )

  $effect(() => {
    // When component prop changes (e.g. selection change), update local state
    // Check if ID changed to avoid resetting on local edits if parent passes same object reference
    if (component.id !== localComponent.id) {
      localComponent = JSON.parse(JSON.stringify(component))
    }
  })

  function handleSave() {
    // Return a plain object, removing proxy
    onSave($state.snapshot(localComponent))
  }
</script>

<div class="flex flex-col h-full bg-background text-foreground">
  <div class="flex justify-between items-center p-4 border-b shrink-0">
    <h2 class="text-lg font-bold">Edit Component</h2>
    <div class="space-x-2">
      <Button variant="ghost" onclick={onCancel}>Cancel</Button>
      <Button onclick={handleSave}>Save</Button>
    </div>
  </div>

  <div class="flex-1 flex flex-col p-4 overflow-hidden gap-4 min-h-0">
    <div
      class="flex justify-center items-center flex-1 bg-muted/20 rounded-md border min-h-0"
    >
      <GridCanvas
        bitmap={localComponent.bitmap}
        onUpdate={(bm) => (localComponent.bitmap = bm)}
      />
    </div>

    <div class="h-[300px] shrink-0 border-t pt-4">
      <TargetSelector
        targets={localComponent.targets}
        onUpdate={(t) => (localComponent.targets = t)}
      />
    </div>
  </div>
</div>
