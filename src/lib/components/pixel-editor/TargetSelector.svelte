<script lang="ts">
  import { Checkbox } from "$lib/components/ui/checkbox"
  import { Label } from "$lib/components/ui/label"
  import { Button } from "$lib/components/ui/button"
  import {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
  } from "$lib/components/ui/tabs"
  import { ScrollArea } from "$lib/components/ui/scroll-area"
  import { CHOSUNG, JUNGSUNG, JONGSUNG } from "$lib/hangul"
  import * as ButtonGroup from "$lib/components/ui/button-group/index.js"
  import { Toggle } from "$lib/components/ui/toggle/index.js"

  let {
    targets,
    onUpdate,
  }: {
    targets: { chosung: number[]; jungsung: number[]; jongsung: number[] }
    onUpdate: (newTargets: typeof targets) => void
  } = $props()

  let activeTab = $state("chosung")

  function toggleIndex(
    type: "chosung" | "jungsung" | "jongsung",
    index: number,
  ) {
    const list = targets[type]
    const newTargets = { ...targets }
    if (list.includes(index)) {
      newTargets[type] = list.filter((i) => i !== index)
    } else {
      newTargets[type] = [...list, index].sort((a, b) => a - b)
    }
    onUpdate(newTargets)
  }

  function selectAll(type: "chosung" | "jungsung" | "jongsung") {
    const newTargets = { ...targets }
    if (type === "chosung") newTargets.chosung = CHOSUNG.map((_, i) => i)
    else if (type === "jungsung")
      newTargets.jungsung = JUNGSUNG.map((_, i) => i)
    else if (type === "jongsung")
      newTargets.jongsung = JONGSUNG.map((_, i) => i)
    onUpdate(newTargets)
  }

  function clearAll(type: "chosung" | "jungsung" | "jongsung") {
    const newTargets = { ...targets }
    newTargets[type] = []
    onUpdate(newTargets)
  }
</script>

<div class="@container h-full flex flex-col space-y-4">
  <div class="flex justify-between items-center mb-2 pl-2 gap-2">
    <h3 class="font-medium truncate">적용 범위</h3>
    <ButtonGroup.Root>
      <ButtonGroup.Root>
        <Button
          variant="outline"
          size="sm"
          onclick={() => selectAll(activeTab as any)}
        >
          전체 선택
        </Button>
      </ButtonGroup.Root>
      <ButtonGroup.Root>
        <Button
          variant="outline"
          size="sm"
          onclick={() => clearAll(activeTab as any)}
        >
          선택 해제
        </Button>
      </ButtonGroup.Root>
    </ButtonGroup.Root>
  </div>

  <!-- Using bind:value with Tabs might need legacy syntax or verify Shadcn Tabs behavior -->
  <Tabs bind:value={activeTab} class="flex-1 flex flex-col min-h-0">
    <TabsList class="grid w-full grid-cols-3">
      <TabsTrigger value="chosung">
        초성 ({targets.chosung.length})
      </TabsTrigger>
      <TabsTrigger value="jungsung">
        중성 ({targets.jungsung.length})
      </TabsTrigger>
      <TabsTrigger value="jongsung">
        종성 ({targets.jongsung.length})
      </TabsTrigger>
    </TabsList>

    <div class="grid grid-cols-4 @sm:grid-cols-6 @md:grid-cols-8 gap-2">
      {#if activeTab === "chosung"}
        {#each CHOSUNG as char, i}
          <Toggle variant="outline" class="text-xl transition bg-background data-[state=on]:font-semibold data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground" id={`cho-${i}`} pressed={targets.chosung.includes(i)} onPressedChange={() => toggleIndex("chosung", i)}>
            {char}
          </Toggle>
        {/each}
      {:else if activeTab === "jungsung"}
        {#each JUNGSUNG as char, i}
          <Toggle variant="outline" class="text-xl transition bg-background data-[state=on]:font-semibold data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground" id={`jung-${i}`} pressed={targets.jungsung.includes(i)} onPressedChange={() => toggleIndex("jungsung", i)}>
            {char}
          </Toggle>
        {/each}
      {:else if activeTab === "jongsung"}
        {#each JONGSUNG as char, i}
          <Toggle variant="outline" class="text-xl transition bg-background data-[state=on]:font-semibold data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground" id={`jong-${i}`} pressed={targets.jongsung.includes(i)} onPressedChange={() => toggleIndex("jongsung", i)}>
            {char}
          </Toggle>
        {/each}
      {/if}
    </div>
  </Tabs>
</div>
