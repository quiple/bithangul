<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import type { PixelComponent, ComponentType } from '$lib/types';
  import Thumbnail from '$lib/components/Thumbnail.svelte';
  import { Trash, Plus, Copy, CopyCheck } from '@lucide/svelte';
  import { CHOSUNG, JUNGSUNG, JONGSUNG } from '$lib/hangul';
  import * as Dialog from '$lib/components/ui/dialog/index.js';

  interface Props {
    components: PixelComponent[];
    onSelect: (id: string) => void;
    onAdd: (type: ComponentType, typeIndex: number) => void;
    onDelete: (id: string) => void;
    onDuplicate: (id: string) => void;
    onCopyRowToAll: (type: ComponentType, sourceTypeIndex: number) => void;
  }

  let { components, onSelect, onAdd, onDelete, onDuplicate, onCopyRowToAll }: Props = $props();

  let confirmDialogOpen = $state(false);
  let pendingCopy = $state<{ type: ComponentType; typeIndex: number; char: string } | null>(null);

  const TYPE_LABEL: Record<ComponentType, string> = {
    chosung: '초성',
    jungsung: '중성',
    jongsung: '종성',
  };

  // 정렬 축 순서: 자신의 타입을 제외한 나머지 두 축
  const SORT_AXES: Record<ComponentType, ('chosung' | 'jungsung' | 'jongsung')[]> = {
    chosung: ['jungsung', 'jongsung'],
    jungsung: ['chosung', 'jongsung'],
    jongsung: ['chosung', 'jungsung'],
  };

  function targetSortKey(comp: PixelComponent): number[] {
    const axes = SORT_AXES[comp.type];
    return axes.map((axis) => {
      const arr = comp.targets[axis];
      return arr.length > 0 ? Math.min(...arr) : Infinity;
    });
  }

  function getVariations(type: ComponentType, typeIndex: number): PixelComponent[] {
    return components
      .filter((c) => c.type === type && c.typeIndex === typeIndex)
      .sort((a, b) => {
        const ka = targetSortKey(a);
        const kb = targetSortKey(b);
        for (let i = 0; i < ka.length; i++) {
          if (ka[i] !== kb[i]) return ka[i] - kb[i];
        }
        return 0;
      });
  }

  function requestCopyRowToAll(type: ComponentType, typeIndex: number, char: string) {
    // 같은 타입의 다른 행에 기존 컴포넌트가 있는지 확인
    const hasExisting = components.some((c) => c.type === type && c.typeIndex !== typeIndex);
    if (hasExisting) {
      pendingCopy = { type, typeIndex, char };
      confirmDialogOpen = true;
    } else {
      // 덮어씌워질 컴포넌트가 없으면 바로 복사
      onCopyRowToAll(type, typeIndex);
    }
  }

  function confirmCopy() {
    if (pendingCopy) {
      onCopyRowToAll(pendingCopy.type, pendingCopy.typeIndex);
    }
    confirmDialogOpen = false;
    pendingCopy = null;
  }
</script>

<!-- 자모 행 하나를 렌더링하는 snippet -->
{#snippet jamoRow(type: ComponentType, char: string, i: number)}
  {@const variations = getVariations(type, i)}
  <div class="flex gap-1 rounded-md p-1 hover:bg-muted">
    <span class="w-4 text-center text-base font-semibold shrink-0 select-none leading-8">{char}</span>
    <div class="flex flex-wrap gap-x-1 gap-y-1.5 flex-1 min-w-0">
      {#each variations as comp (comp.id)}
        <div class="relative group h-8">
          <Button
            variant="outline"
            class="rounded p-0 box-content overflow-hidden"
            style="width: 2rem; height: 2rem;"
            onclick={() => onSelect(comp.id)}
            title="컴포넌트 편집"
          >
            <Thumbnail bitmap={comp.bitmap} size={32} class="transition group-hover:brightness-95" />
          </Button>
          <Button
            variant="destructive"
            size="icon-sm"
            class="absolute -top-1.5 -right-1.5 size-4 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow"
            onclick={() => onDelete(comp.id)}
            title="컴포넌트 삭제"
          >
            <Trash class="size-2.5" />
          </Button>
          <Button
            variant="secondary"
            size="icon-sm"
            class="absolute -bottom-1.5 -right-1.5 size-4 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow"
            onclick={() => onDuplicate(comp.id)}
            title="컴포넌트 복사"
          >
            <Copy class="size-2.5" />
          </Button>
        </div>
      {/each}
      <Button
        class="rounded bg-ring"
        style="width: 34px; height: 34px;"
        onclick={() => onAdd(type, i)}
        title="컴포넌트 추가"
      >
        <Plus class="size-4" />
      </Button>
      {#if variations.length > 0}
        <Button
          variant="ghost"
          size="icon-sm"
          class="size-8 text-muted-foreground hover:text-foreground"
          onclick={() => requestCopyRowToAll(type, i, char)}
          title="모든 {TYPE_LABEL[type]}에 복사"
        >
          <CopyCheck class="size-4" />
        </Button>
      {/if}
    </div>
  </div>
{/snippet}

<!-- 섹션 헤더 snippet -->
{#snippet sectionHeader(label: string)}
  <h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1.5">
    {label}
  </h3>
{/snippet}

<div class="flex flex-col h-full">
  <div class="flex justify-between items-center pl-4 p-2 shrink-0 gap-2 border-b">
    <h2 class="font-bold truncate">컴포넌트</h2>
  </div>

  <div class="overflow-y-auto overscroll-contain flex-1 min-h-0">
    <div class="px-2 py-2 space-y-4">
      <!-- 초성 섹션 -->
      <section>
        {@render sectionHeader('초성')}
        {#each CHOSUNG as char, i}
          {@render jamoRow('chosung', char, i)}
        {/each}
      </section>

      <!-- 중성 섹션 -->
      <section>
        {@render sectionHeader('중성')}
        {#each JUNGSUNG as char, i}
          {@render jamoRow('jungsung', char, i)}
        {/each}
      </section>

      <!-- 종성 섹션 (인덱스 0 = 받침 없음 제외) -->
      <section>
        {@render sectionHeader('종성')}
        {#each JONGSUNG as char, i}
          {#if i !== 0}
            {@render jamoRow('jongsung', char, i)}
          {/if}
        {/each}
      </section>
    </div>
  </div>
</div>

<!-- 확인 다이얼로그 -->
<Dialog.Root bind:open={confirmDialogOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>모든 {pendingCopy ? TYPE_LABEL[pendingCopy.type] : ''}에 복사</Dialog.Title>
      <Dialog.Description>
        {#if pendingCopy}
          {TYPE_LABEL[pendingCopy.type]} <strong>‘{pendingCopy.char}’</strong> 행의 컴포넌트를 나머지 모든 {TYPE_LABEL[
            pendingCopy.type
          ]}에 덮어씁니다. 기존에 다른 행에 있던 컴포넌트는 <strong>모두 삭제</strong>됩니다.
        {/if}
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (confirmDialogOpen = false)}>취소</Button>
      <Button variant="destructive" onclick={confirmCopy}>덮어쓰기</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
