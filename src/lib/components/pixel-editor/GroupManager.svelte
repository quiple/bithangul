<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Toggle } from '$lib/components/ui/toggle/index.js';
    import { Trash, Plus, SquareDashed } from '@lucide/svelte';
    import { Checkbox } from '$lib/components/ui/checkbox/index.js';
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
    let hiddenGroups = $state<JamoGroup[]>([]);
    let errorMsg = $state<string | null>(null);

    function getSortScore(group: JamoGroup): number {
        if (!type || !group.appliesTo) return 0;
        const targets = TARGET_TYPES_MAP[type];
        if (!targets || targets.length < 2) return 0;
        const hasFirst = group.appliesTo.includes(targets[0].value);
        const hasSecond = group.appliesTo.includes(targets[1].value);

        if (hasFirst && !hasSecond) return 1;
        if (hasFirst && hasSecond) return 2;
        if (!hasFirst && hasSecond) return 3;
        return 4;
    }

    $effect(() => {
        if (open) {
            draftGroups = initialGroups
                .filter((g) => g.id !== 'no_jongsung')
                .map((g) => ({
                    ...g,
                    items: [...g.items],
                    appliesTo: g.appliesTo ? [...g.appliesTo] : type ? TARGET_TYPES_MAP[type].map((t) => t.value) : [],
                }))
                .sort((a, b) => getSortScore(a) - getSortScore(b));
            hiddenGroups = initialGroups
                .filter((g) => g.id === 'no_jongsung')
                .map((g) => ({ ...g, items: [...g.items] }));
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

    const TARGET_TYPES_MAP: Record<ComponentType, { value: ComponentType; label: string }[]> = {
        chosung: [
            { value: 'jungsung', label: '중성에 적용' },
            { value: 'jongsung', label: '종성에 적용' },
        ],
        jungsung: [
            { value: 'chosung', label: '초성에 적용' },
            { value: 'jongsung', label: '종성에 적용' },
        ],
        jongsung: [
            { value: 'chosung', label: '초성에 적용' },
            { value: 'jungsung', label: '중성에 적용' },
        ],
    };

    function addGroup() {
        draftGroups.push({
            id: crypto.randomUUID(),
            name: `그룹 ${draftGroups.length + 1}`,
            items: [],
            appliesTo: type ? TARGET_TYPES_MAP[type].map((t) => t.value) : [],
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

    function toggleAllItems(groupIndex: number) {
        if (!type) return;
        const totalItems = type === 'jongsung' ? ITEMS_MAP[type].length - 1 : ITEMS_MAP[type].length;
        if (draftGroups[groupIndex].items.length === totalItems) {
            draftGroups[groupIndex].items = [];
        } else {
            const allItems = ITEMS_MAP[type].map((_, i) => i);
            draftGroups[groupIndex].items = type === 'jongsung' ? allItems.slice(1) : allItems;
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
            if (!g.appliesTo || g.appliesTo.length === 0) {
                return '적용할 자모 대상을 최소 하나 이상 선택해야 합니다.';
            }
            const sorted = [...g.items].sort((a, b) => a - b).join(',');
            const sortedAppliesTo = g.appliesTo ? [...g.appliesTo].sort().join(',') : '';
            const key = `${sorted}|${sortedAppliesTo}`;
            if (seen.has(key)) {
                return '완전히 같은 설정(자모 구성 및 적용 대상)을 가진 그룹이 이미 존재합니다.';
            }
            seen.add(key);
        }
        return null;
    }

    function handleSave() {
        const err = validate();
        if (err) {
            errorMsg = err;
            return;
        }
        draftGroups.sort((a, b) => getSortScore(a) - getSortScore(b));
        onSave([...hiddenGroups, ...draftGroups]);
    }
</script>

<Dialog.Root {open} {onOpenChange}>
    <Dialog.Content class="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <Dialog.Header>
            <Dialog.Title>{type ? TITLE_MAP[type] : '그룹 관리'}</Dialog.Title>
            <Dialog.Description>바리에이션을 생성할 자모들을 묶어서 그룹화합니다.</Dialog.Description>
        </Dialog.Header>

        <div class="flex-1 overflow-y-auto space-y-4 min-h-0">
            {#each draftGroups as group, gIdx (group.id)}
                <div class="space-y-3 p-4 border rounded-lg bg-card">
                    <div class="flex flex-wrap items-center gap-3">
                        <Input
                            bind:value={group.name}
                            placeholder="그룹 별칭 (예: 이중모음)"
                            class="max-w-60 shrink-0"
                        />

                        {#if type}
                            <div class="flex items-center gap-1">
                                <span class="text-sm font-medium text-muted-foreground whitespace-nowrap"
                                    >적용 대상:</span
                                >
                                <div class="flex">
                                    {#each TARGET_TYPES_MAP[type] as target}
                                        <label
                                            class="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted py-1 px-1.5 rounded-md"
                                        >
                                            <Checkbox
                                                checked={group.appliesTo?.includes(target.value)}
                                                onCheckedChange={(checked) => {
                                                    const current =
                                                        group.appliesTo || TARGET_TYPES_MAP[type!].map((t) => t.value);
                                                    if (checked) {
                                                        group.appliesTo = [...current, target.value];
                                                    } else {
                                                        group.appliesTo = current.filter((t) => t !== target.value);
                                                    }
                                                }}
                                            />
                                            {target.label}
                                        </label>
                                    {/each}
                                </div>
                            </div>
                        {/if}

                        <div class="flex-1 min-w-4"></div>
                        <div class="flex items-center shrink-0 -mt-4 -mr-2">
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onclick={() => toggleAllItems(gIdx)}
                                class="whitespace-nowrap"
                            >
                                <SquareDashed />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onclick={() => removeGroup(gIdx)}
                                class="text-destructive shrink-0"
                            >
                                <Trash class="size-4" />
                            </Button>
                        </div>
                    </div>

                    <div class="grid grid-cols-4 sm:grid-cols-14 gap-1">
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
                <Plus class="size-4" />
                새 그룹 추가
            </Button>

            {#if errorMsg}
                <p class="text-sm text-destructive font-medium">{errorMsg}</p>
            {/if}
        </div>

        <Dialog.Footer class="pt-2">
            <Button variant="outline" onclick={() => onOpenChange(false)}>취소</Button>
            <Button onclick={handleSave}>저장</Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
