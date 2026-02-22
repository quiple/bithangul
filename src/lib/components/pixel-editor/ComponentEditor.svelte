<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import GridCanvas from './GridCanvas.svelte';
  import TargetSelector from './TargetSelector.svelte';
  import ComponentPreviewGrid from './ComponentPreviewGrid.svelte';
  import type { PixelComponent } from '$lib/types';
  import * as ButtonGroup from '$lib/components/ui/button-group/index.js';
  import { ChevronLeft } from '@lucide/svelte';
  import { untrack } from 'svelte';
  import { CHOSUNG, JUNGSUNG, JONGSUNG } from '$lib/hangul';

  interface Props {
    component: PixelComponent;
    /** 같은 자모 타입+인덱스를 공유하는 다른 바리에이션 컴포넌트들 (현재 컴포넌트 제외) */
    siblingComponents: PixelComponent[];
    onSave: (c: PixelComponent) => void;
    onCancel: () => void;
  }

  let { component, siblingComponents, onSave, onCancel }: Props = $props();

  // untrack으로 감싸서 초기값만 읽고 반응성 추적 방지 (Svelte 5 lint 해결)
  let localComponent = $state<PixelComponent>(untrack(() => structuredClone($state.snapshot(component))));

  $effect(() => {
    // component prop이 바뀌면 로컬 상태 동기화
    const snap = $state.snapshot(component);
    if (snap.id !== localComponent.id) {
      localComponent = structuredClone(snap);
    }
  });

  function handleSave() {
    onSave($state.snapshot(localComponent));
  }
</script>

<div class="flex flex-col p-2">
  <div class="flex justify-between items-center mb-4 gap-2">
    <div class="flex items-center">
      <Button variant="ghost" size="icon-sm" onclick={onCancel}><ChevronLeft class="size-6" /></Button>
      <h2 class="font-bold truncate">
        컴포넌트 편집 <span class="ml-1 bg-ring text-primary-foreground px-1 py-0.5 rounded"
          >{localComponent.type === 'chosung'
            ? CHOSUNG[localComponent.typeIndex]
            : localComponent.type === 'jungsung'
              ? JUNGSUNG[localComponent.typeIndex]
              : JONGSUNG[localComponent.typeIndex]}</span
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

  <div class="flex flex-col">
    <div class="flex justify-center mb-4">
      <GridCanvas bitmap={localComponent.bitmap} onUpdate={(bm) => (localComponent.bitmap = bm)} />
    </div>

    <TargetSelector
      targets={localComponent.targets}
      componentType={localComponent.type}
      typeIndex={localComponent.typeIndex}
      {siblingComponents}
      onUpdate={(t) => (localComponent.targets = t)}
    />

    <ComponentPreviewGrid component={localComponent} />
  </div>
</div>
