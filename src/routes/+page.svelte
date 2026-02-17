<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { projectState } from '$lib/state.svelte';
  import ComponentList from '$lib/components/pixel-editor/ComponentList.svelte';
  import ComponentEditor from '$lib/components/pixel-editor/ComponentEditor.svelte';
  import Preview from '$lib/components/Preview.svelte';
  import { Button } from '$lib/components/ui/button';
  import {
    Download,
    Upload,
    Play,
    FileType,
    FileCode
  } from '@lucide/svelte';
  import GeneratorWorker from '$lib/workers/generator.worker?worker';
  import type { FontProject, PixelComponent } from '$lib/types';

  let worker: Worker;
  let generatedData = $state<ArrayBuffer | null>(null);
  let isGenerating = $state(false);

  onMount(() => {
    worker = new GeneratorWorker();
    worker.onmessage = (e) => {
        generatedData = e.data.buffer;
        isGenerating = false;
    };

    return () => {
        worker.terminate();
    };
  });

  function handleGenerate() {
    isGenerating = true;
    const snapshot = $state.snapshot(projectState.project);
    worker.postMessage(snapshot);
  }

  function handleSaveProject() {
    const data = JSON.stringify($state.snapshot(projectState.project), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectState.project.name || 'font-project'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleLoadProject() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) return;
        const text = await file.text();
        try {
            const data = JSON.parse(text);
            if (data.components) {
                projectState.loadProject(data);
                generatedData = null;
            }
        } catch (err) {
            console.error(err);
            alert('Failed to load project');
        }
    };
    input.click();
  }

  function handleExportBDF() {
    alert("BDF Export implementation requires specific BDF format generation logic. Not implemented.");
  }

  function handleExportHEX() {
      alert("HEX Export implementation requires specific HEX format generation logic. Not implemented.");
  }

</script>

<div class="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
  <!-- Toolbar -->
  <header class="h-14 border-b px-4 flex items-center justify-between shrink-0 bg-card">
    <div class="flex items-center space-x-4">
      <h1 class="font-bold text-lg">Hangul Pixel Font Gen</h1>
      <div class="h-6 w-px bg-border mx-2"></div>
      <Button variant="outline" size="sm" onclick={handleLoadProject}>
        <Upload /> Load
      </Button>
      <Button variant="outline" size="sm" onclick={handleSaveProject}>
        <Download /> Save
      </Button>
    </div>

    <div class="flex items-center space-x-2">
      <Button variant="secondary" size="sm" onclick={handleGenerate} disabled={isGenerating}>
        <Play class={isGenerating ? 'animate-spin' : ''} />
        {isGenerating ? 'Generating...' : 'Generate'}
      </Button>
      <div class="h-6 w-px bg-border mx-2"></div>
      <Button variant="ghost" size="sm" onclick={handleExportBDF}>
        <FileType /> BDF
      </Button>
      <Button variant="ghost" size="sm" onclick={handleExportHEX}>
        <FileCode /> HEX
      </Button>
    </div>
  </header>

  <!-- Main Content -->
  <div class="flex-1 flex overflow-hidden min-h-0">
    <!-- Left Panel -->
    <div class="w-[400px] border-r flex flex-col bg-sidebar relative shrink-0">
       {#if projectState.selectedComponentId && projectState.selectedComponent}
         <!-- Edit Mode -->
         <ComponentEditor
            component={projectState.selectedComponent}
            onSave={(updated) => {
                projectState.updateComponent(updated.id, updated);
                // Go back to list
                projectState.selectComponent(null);
            }}
            onCancel={() => {
                projectState.selectComponent(null);
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
    </div>

    <!-- Right Panel (Preview) -->
    <div class="flex-1 bg-muted/10 min-w-0 relative">
       <Preview generatedData={generatedData} />
    </div>
  </div>
</div>
