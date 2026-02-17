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
  import { cn } from "$lib/utils"

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

<div class="h-full flex flex-col space-y-4">
  <div class="flex items-center justify-between">
    <h3 class="text-sm font-medium">Apply To</h3>
    <div class="space-x-2">
      <Button
        variant="outline"
        size="sm"
        onclick={() => selectAll(activeTab as any)}>All</Button
      >
      <Button
        variant="outline"
        size="sm"
        onclick={() => clearAll(activeTab as any)}>None</Button
      >
    </div>
  </div>

  <!-- Using bind:value with Tabs might need legacy syntax or verify Shadcn Tabs behavior -->
  <Tabs bind:value={activeTab} class="flex-1 flex flex-col min-h-0">
    <TabsList class="grid w-full grid-cols-3">
      <TabsTrigger value="chosung"
        >Choseong ({targets.chosung.length})</TabsTrigger
      >
      <TabsTrigger value="jungsung"
        >Jungseong ({targets.jungsung.length})</TabsTrigger
      >
      <TabsTrigger value="jongsung"
        >Jongseong ({targets.jongsung.length})</TabsTrigger
      >
    </TabsList>

    <div class="flex-1 overflow-hidden mt-2 border rounded-md relative">
      <ScrollArea class="h-full w-full absolute inset-0">
        <div class="p-4 grid grid-cols-3 gap-2">
          {#if activeTab === "chosung"}
            {#each CHOSUNG as char, i}
              <div class="flex items-center space-x-2">
                <Checkbox
                  id={`cho-${i}`}
                  checked={targets.chosung.includes(i)}
                  onCheckedChange={() => toggleIndex("chosung", i)}
                />
                <Label for={`cho-${i}`} class="cursor-pointer font-mono"
                  >{char}</Label
                >
              </div>
            {/each}
          {:else if activeTab === "jungsung"}
            {#each JUNGSUNG as char, i}
              <div class="flex items-center space-x-2">
                <Checkbox
                  id={`jung-${i}`}
                  checked={targets.jungsung.includes(i)}
                  onCheckedChange={() => toggleIndex("jungsung", i)}
                />
                <Label for={`jung-${i}`} class="cursor-pointer font-mono"
                  >{char}</Label
                >
              </div>
            {/each}
          {:else if activeTab === "jongsung"}
            {#each JONGSUNG as char, i}
              <div class="flex items-center space-x-2">
                <Checkbox
                  id={`jong-${i}`}
                  checked={targets.jongsung.includes(i)}
                  onCheckedChange={() => toggleIndex("jongsung", i)}
                />
                <Label for={`jong-${i}`} class="cursor-pointer font-mono"
                  >{char || "(None)"}</Label
                >
              </div>
            {/each}
          {/if}
        </div>
      </ScrollArea>
    </div>
  </Tabs>
</div>
