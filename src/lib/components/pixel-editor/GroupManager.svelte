<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Toggle } from '$lib/components/ui/toggle/index.js';
    import { Trash, Plus } from '@lucide/svelte';
    import type { ComponentType, JamoGroup } from '$lib/types';
    import { CHOSUNG, JUNGSUNG, JONGSUNG } from '$lib/hangul';

    interface Props {
        open: boolean;
        type: ComponentType | null;
        initialGroups: JamoGroup[];
        onOpenChange: (open: boolean) => void;
        onSave: (groups: JamoGroup[]) => void;
    }

    let { open, type, initialGroups, onOpenChange, onSave }: Props = $props();

    let draftGroups = $state<JamoGroup[]>([]);
    let errorMsg = $state<string | null>(null);

    $effect(() => {
        if (open) {
            draftGroups = initialGroups.map((g) => ({ ...g, items: [...g.items] }));
            errorMsg = null;
        }
    });

    const TITLE_MAP: Record<ComponentType, string> = {
        chosung: '초성 그룹 관리',
        jungsung: '중성 그룹 관리',
        jongsung: '종성 그룹 관리',
    };

    const ITEMS_MAP = {
        chosung: CHOSUNG,
        jungsung: JUNGSUNG,
        jongsung: JONGSUNG,
    };

    function addGroup() {
        draftGroups.push({
            id: crypto.randomUUID(),
            name: `그룹 ${draftGroups.length + 1}`,
            items: [],
        });
    }

    function removeGroup(index: number) {
        draftGroups.splice(index, 1);
    }

    function toggleItem(groupIndex: number, itemIndex: number) {
        const list = draftGroups[groupIndex].items;
        if (list.includes(itemIndex)) {
            draftGroups[groupIndex].items = list.filter((i) => i !== itemIndex);
        } else {
            draftGroups[groupIndex].items = [...list, itemIndex].sort((a, b) => a - b);
        }
    }

    function validate() {
        // Check for duplicates
        const seen = new Set<string>();
        for (const g of draftGroups) {
            if (g.items.length === 0) {
                return '빈 그룹은 허용되지 않습니다.';
            }
            if (!g.name.trim()) {
                return '그룹 이름을 입력해주세요.';
            }
            const sorted = [...g.items].sort((a, b) => a - b).join(',');
            if (seen.has(sorted)) {
                return '완전히 같은 자모 구성을 가진 그룹이 이미 존재합니다.';
            }
            seen.add(sorted);
        }
        return null;
    }

    function handleSave() {
        const err = validate();
        if (err) {
            errorMsg = err;
            return;
        }
        onSave(draftGroups);
    }
</script>

<Dialog.Root {open} {onOpenChange}>
    <Dialog.Content class="max-w-2xl max-h-[80vh] flex flex-col">
        <Dialog.Header>
            <Dialog.Title>{type ? TITLE_MAP[type] : '그룹 관리'}</Dialog.Title>
            <Dialog.Description>바리에이션을 생성할 자모들을 묶어서 그룹화합니다.</Dialog.Description>
        </Dialog.Header>

        <div class="flex-1 overflow-y-auto space-y-6 min-h-0 py-4 pr-2">
            {#if draftGroups.length === 0}
                <p class="text-sm text-muted-foreground">생성된 그룹이 없습니다.</p>
            {/if}

            {#each draftGroups as group, gIdx (group.id)}
                <div class="space-y-3 p-4 border rounded-lg bg-card">
                    <div class="flex items-center gap-2">
                        <Input bind:value={group.name} placeholder="그룹 별칭 (예: 세로 모음)" class="max-w-xs" />
                        <div class="flex-1"></div>
                        <Button variant="ghost" size="icon" onclick={() => removeGroup(gIdx)} class="text-destructive">
                            <Trash class="size-4" />
                        </Button>
                    </div>

                    <div class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                        {#if type}
                            {#each ITEMS_MAP[type] as char, i}
                                {#if type !== 'jongsung' || i !== 0}
                                    <Toggle
                                        variant="outline"
                                        class="text-lg transition bg-background data-[state=on]:font-semibold data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                                        pressed={group.items.includes(i)}
                                        onPressedChange={() => toggleItem(gIdx, i)}
                                    >
                                        {char}
                                    </Toggle>
                                {/if}
                            {/each}
                        {/if}
                    </div>
                </div>
            {/each}

            <Button variant="outline" class="w-full border-dashed py-8 text-muted-foreground" onclick={addGroup}>
                <Plus class="mr-2 size-4" />
                새 그룹 추가
            </Button>

            {#if errorMsg}
                <p class="text-sm text-destructive font-medium">{errorMsg}</p>
            {/if}
        </div>

        <Dialog.Footer class="pt-2">
            <Button variant="outline" onclick={() => onOpenChange(false)}>취소</Button>
            <Button onclick={handleSave}>저장 & 바리에이션 갱신</Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
