<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Tabs, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
  import { CHOSUNG, JUNGSUNG, JONGSUNG } from '$lib/hangul';
  import * as ButtonGroup from '$lib/components/ui/button-group/index.js';
  import { Toggle } from '$lib/components/ui/toggle/index.js';
  import type { PixelComponent, ComponentType } from '$lib/types';

  let {
    targets,
    componentType,
    typeIndex,
    siblingComponents,
    onUpdate,
  }: {
    targets: { chosung: number[]; jungsung: number[]; jongsung: number[] };
    /** 이 컴포넌트의 자모 종류 */
    componentType: ComponentType;
    /** 이 컴포넌트의 자모 인덱스 */
    typeIndex: number;
    /** 같은 자모 타입+인덱스를 공유하는 다른 바리에이션 컴포넌트들 */
    siblingComponents: PixelComponent[];
    onUpdate: (newTargets: typeof targets) => void;
  } = $props();

  let activeTab = $state('chosung');

  /**
   * 특정 (chosung, jungsung, jongsung) 조합이 sibling 컴포넌트에서 이미 사용되고 있는지 확인.
   * 현재 탭에 따라 해당 인덱스를 변경했을 때 충돌 여부를 판단.
   */
  function isDisabled(tabType: 'chosung' | 'jungsung' | 'jongsung', index: number): boolean {
    // 이미 현재 컴포넌트에서 선택된 항목은 비활성화하지 않음 (토글 해제 가능해야 함)
    if (targets[tabType].includes(index)) return false;

    // 현재 탭 타입의 인덱스를 index로 가정했을 때,
    // 현재 선택된 다른 두 타입의 인덱스들과 조합하여 sibling과 충돌하는지 확인
    for (const sibling of siblingComponents) {
      // sibling의 각 타입 선택 목록
      const sibCho = sibling.targets.chosung;
      const sibJung = sibling.targets.jungsung;
      const sibJong = sibling.targets.jongsung;

      // 현재 컴포넌트에서 tabType을 index로 바꿨을 때의 선택 목록
      const myCho = tabType === 'chosung' ? [index] : targets.chosung;
      const myJung = tabType === 'jungsung' ? [index] : targets.jungsung;
      const myJong = tabType === 'jongsung' ? [index] : targets.jongsung;

      // 두 컴포넌트의 선택 범위가 겹치는지 확인
      // 초성: myCho와 sibCho가 교집합이 있는지
      const choCross = myCho.length === 0 || sibCho.length === 0 ? false : myCho.some((c) => sibCho.includes(c));
      const jungCross = myJung.length === 0 || sibJung.length === 0 ? false : myJung.some((j) => sibJung.includes(j));
      const jongCross = myJong.length === 0 || sibJong.length === 0 ? false : myJong.some((j) => sibJong.includes(j));

      if (choCross && jungCross && jongCross) {
        return true;
      }
    }
    return false;
  }

  function toggleIndex(type: 'chosung' | 'jungsung' | 'jongsung', index: number) {
    // 자모 고정 타입은 변경 불가
    if (type === componentType && index === typeIndex) return;

    const list = targets[type];
    const newTargets = { ...targets };
    let newList: number[] = [];

    if (list.includes(index)) {
      newList = list.filter((i) => i !== index);
    } else {
      newList = [...list, index];
    }

    if (type === 'jongsung') {
      const nonZero = newList.filter((i) => i !== 0);
      if (nonZero.length === 0) {
        newList = [0];
      } else {
        newList = nonZero;
      }
    }

    newTargets[type] = newList.sort((a, b) => a - b);
    onUpdate(newTargets);
  }

  function selectAll(type: 'chosung' | 'jungsung' | 'jongsung') {
    const newTargets = { ...targets };
    if (type === 'chosung') newTargets.chosung = CHOSUNG.map((_, i) => i);
    else if (type === 'jungsung') newTargets.jungsung = JUNGSUNG.map((_, i) => i);
    else if (type === 'jongsung') newTargets.jongsung = JONGSUNG.map((_, i) => i).filter((i) => i !== 0);
    onUpdate(newTargets);
  }

  function clearAll(type: 'chosung' | 'jungsung' | 'jongsung') {
    const newTargets = { ...targets };
    if (type === 'jongsung') {
      newTargets[type] = [0];
    } else {
      newTargets[type] = [];
    }
    // 자모 고정 타입이면 typeIndex를 다시 추가
    if (type === componentType) {
      if (type === 'jongsung') {
        newTargets[type] = [typeIndex];
      } else {
        (newTargets[type] as number[]) = [typeIndex];
      }
    }
    onUpdate(newTargets);
  }

  // 자모 고정 여부: 해당 탭이 이 컴포넌트의 자모 타입이면 typeIndex는 항상 선택 고정
  function isFixed(type: 'chosung' | 'jungsung' | 'jongsung', index: number): boolean {
    return type === componentType && index === typeIndex;
  }
</script>

<div class="@container h-full flex flex-col space-y-4">
  <div class="flex justify-between items-center mb-2 pl-2 gap-2">
    <h3 class="font-medium truncate">적용 범위</h3>
    <ButtonGroup.Root>
      <ButtonGroup.Root>
        <Button variant="outline" size="sm" onclick={() => selectAll(activeTab as any)}>전체 선택</Button>
      </ButtonGroup.Root>
      <ButtonGroup.Root>
        <Button variant="outline" size="sm" onclick={() => clearAll(activeTab as any)}>선택 해제</Button>
      </ButtonGroup.Root>
    </ButtonGroup.Root>
  </div>

  <Tabs bind:value={activeTab} class="flex-1 flex flex-col min-h-0">
    <TabsList class="grid w-full grid-cols-3">
      <TabsTrigger value="chosung">
        초성 ({targets.chosung.length})
      </TabsTrigger>
      <TabsTrigger value="jungsung">
        중성 ({targets.jungsung.length})
      </TabsTrigger>
      <TabsTrigger value="jongsung">
        종성 ({targets.jongsung.filter((i) => i !== 0).length})
      </TabsTrigger>
    </TabsList>

    <div class="grid grid-cols-4 @sm:grid-cols-6 @md:grid-cols-8 gap-2 mt-2">
      {#if activeTab === 'chosung'}
        {#each CHOSUNG as char, i}
          {@const fixed = isFixed('chosung', i)}
          {@const disabled = isDisabled('chosung', i)}
          <Toggle
            variant="outline"
            class="text-xl transition bg-background data-[state=on]:font-semibold data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground
              {fixed ? 'ring-2 ring-primary ring-offset-1 cursor-not-allowed' : ''}
              {!fixed && disabled ? 'opacity-25 cursor-not-allowed' : ''}"
            id={`cho-${i}`}
            pressed={targets.chosung.includes(i)}
            disabled={fixed || disabled}
            onPressedChange={() => toggleIndex('chosung', i)}
          >
            {char}
          </Toggle>
        {/each}
      {:else if activeTab === 'jungsung'}
        {#each JUNGSUNG as char, i}
          {@const fixed = isFixed('jungsung', i)}
          {@const disabled = isDisabled('jungsung', i)}
          <Toggle
            variant="outline"
            class="text-xl transition bg-background data-[state=on]:font-semibold data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground
              {fixed ? 'ring-2 ring-primary ring-offset-1 cursor-not-allowed' : ''}
              {!fixed && disabled ? 'opacity-25 cursor-not-allowed' : ''}"
            id={`jung-${i}`}
            pressed={targets.jungsung.includes(i)}
            disabled={fixed || disabled}
            onPressedChange={() => toggleIndex('jungsung', i)}
          >
            {char}
          </Toggle>
        {/each}
      {:else if activeTab === 'jongsung'}
        {#each JONGSUNG as char, i}
          {#if i !== 0}
            {@const fixed = isFixed('jongsung', i)}
            {@const disabled = isDisabled('jongsung', i)}
            <Toggle
              variant="outline"
              class="text-xl transition bg-background data-[state=on]:font-semibold data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground
                {fixed ? 'ring-2 ring-primary ring-offset-1 cursor-not-allowed' : ''}
                {!fixed && disabled ? 'opacity-25 cursor-not-allowed' : ''}"
              id={`jong-${i}`}
              pressed={targets.jongsung.includes(i)}
              disabled={fixed || disabled}
              onPressedChange={() => toggleIndex('jongsung', i)}
            >
              {char}
            </Toggle>
          {/if}
        {/each}
      {/if}
    </div>
  </Tabs>
</div>
