<script lang="ts">
  import * as Resizable from "$lib/components/ui/resizable/index.js"
  import { onMount, tick } from 'svelte'
  import { projectState } from '$lib/state.svelte'
  import ComponentList from '$lib/components/pixel-editor/ComponentList.svelte'
  import ComponentEditor from '$lib/components/pixel-editor/ComponentEditor.svelte'
  import Preview from '$lib/components/Preview.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as ButtonGroup from "$lib/components/ui/button-group/index.js"
  import {
    Download,
    Upload,
    Play,
    FileType,
    FileCode
  } from '@lucide/svelte'
  import GeneratorWorker from '$lib/workers/generator.worker?worker'

  let worker: Worker
  let generatedData = $state<ArrayBuffer | null>(null)
  let isGenerating = $state(false)

  onMount(() => {
    worker = new GeneratorWorker()
    worker.onmessage = (e) => {
      generatedData = e.data.buffer
      isGenerating = false
    }

    return () => {
      worker.terminate()
    }
  })

  function handleGenerate() {
    isGenerating = true
    const snapshot = $state.snapshot(projectState.project)
    worker.postMessage(snapshot)
  }

  function handleSaveProject() {
    const data = JSON.stringify($state.snapshot(projectState.project), null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectState.project.name || 'font-project'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleLoadProject() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement
      const file = target.files?.[0]
      if (!file) return
      const text = await file.text()
      try {
        const data = JSON.parse(text)
        if (data.components) {
          projectState.loadProject(data)
          generatedData = null
        }
      } catch (err) {
        console.error(err)
        alert('Failed to load project')
      }
    }
    input.click()
  }

  function handleExportBDF() {
    alert("BDF Export implementation requires specific BDF format generation logic. Not implemented.")
  }

  function handleExportHEX() {
      alert("HEX Export implementation requires specific HEX format generation logic. Not implemented.")
  }

</script>

<div class="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
  <!-- Toolbar -->
  <header class="h-14 border-b px-4 gap-2 flex items-center justify-between shrink-0 bg-card">
    <div class="flex items-center gap-4">
      <h1 class="font-bold text-lg truncate">BitHangul</h1>
      <ButtonGroup.Root>
        <Button variant="outline" size="sm" onclick={handleLoadProject}>
          <Upload /> Load
        </Button>
        <Button variant="outline" size="sm" onclick={handleSaveProject}>
          <Download /> Save
        </Button>
      </ButtonGroup.Root>
    </div>

    <div class="flex items-center">
      <ButtonGroup.Root>
        <ButtonGroup.Root>
          <Button size="sm" onclick={handleGenerate} disabled={isGenerating}>
            <Play class={isGenerating ? 'animate-spin' : ''} />
            {isGenerating ? 'Generating...' : 'Generate'}
          </Button>
        </ButtonGroup.Root>
        <ButtonGroup.Root>
          <Button variant="outline" size="sm" onclick={handleExportBDF} disabled={Boolean(!generatedData)}>
            <FileType /> Export to BDF
          </Button>
          <Button variant="outline" size="sm" onclick={handleExportHEX} disabled={Boolean(!generatedData)}>
            <FileCode /> Export to HEX
          </Button>
        </ButtonGroup.Root>
      </ButtonGroup.Root>
    </div>
  </header>

  <!-- Main Content -->
  <Resizable.PaneGroup direction="horizontal" class="flex-1 flex overflow-hidden">
    <!-- Left Panel -->
    <Resizable.Pane defaultSize={4} class="flex flex-col bg-sidebar">
      {#if projectState.selectedComponentId && projectState.selectedComponent}
        <!-- Edit Mode -->
        <ComponentEditor
          component={projectState.selectedComponent}
          onSave={(updated) => {
            projectState.updateComponent(updated.id, updated)
            projectState.selectComponent(null)
          }}
          onCancel={() => {
            projectState.selectComponent(null)
          }}
        />
      {:else}
        <!-- List Mode -->
        <ComponentList
          components={projectState.project.components}
          selectedId={projectState.selectedComponentId}
          onSelect={(id) => projectState.selectComponent(id)}
          onAdd={() => projectState.addComponent()}
          onDelete={(id) => projectState.deleteComponent(id)}
        />
      {/if}
    </Resizable.Pane>
    <Resizable.Handle class="bg-card border-x w-2" />
    <!-- Right Panel (Preview) -->
    <Resizable.Pane defaultSize={8}>
      <Preview generatedData={generatedData} />
    </Resizable.Pane>
  </Resizable.PaneGroup>
</div>
