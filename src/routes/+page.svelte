<script lang="ts">
  import * as Resizable from '$lib/components/ui/resizable/index.js';
  import { onMount, tick } from 'svelte';
  import { projectState } from '$lib/state.svelte';
  import ComponentList from '$lib/components/pixel-editor/ComponentList.svelte';
  import ComponentEditor from '$lib/components/pixel-editor/ComponentEditor.svelte';
  import Preview from '$lib/components/Preview.svelte';
  import { Button, buttonVariants } from '$lib/components/ui/button';
  import * as ButtonGroup from '$lib/components/ui/button-group/index.js';
  import { Spinner } from '$lib/components/ui/spinner/index.js';
  import { Download, Upload, Play, FileType, FileCode } from '@lucide/svelte';
  import GeneratorWorker from '$lib/workers/generator.worker?worker';
  import { exportBDF, exportHEX, downloadText } from '$lib/export';
  import * as Tooltip from "$lib/components/ui/tooltip/index.js";

  let worker: Worker;
  let generatedData = $state<ArrayBuffer | null>(null);
  let isGenerating = $state(false);
  let isExportingBDF = $state(false);
  let isExportingHEX = $state(false);

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

  async function handleExportBDF() {
    if (!generatedData || isExportingBDF) return;
    isExportingBDF = true;
    try {
      // 대용량 문자열 생성을 비동기로 처리하여 UI 블로킹 방지
      await tick();
      const bufferCopy = generatedData.slice(0);
      const bdf = exportBDF(bufferCopy, projectState.project.name || 'bithangul');
      downloadText(bdf, `${projectState.project.name || 'bithangul'}.bdf`, 'text/plain');
    } catch (err) {
      console.error('BDF 내보내기 실패:', err);
      alert('BDF 내보내기에 실패했습니다.');
    } finally {
      isExportingBDF = false;
    }
  }

  async function handleExportHEX() {
    if (!generatedData || isExportingHEX) return;
    isExportingHEX = true;
    try {
      await tick();
      const bufferCopy = generatedData.slice(0);
      const hex = exportHEX(bufferCopy);
      downloadText(hex, `${projectState.project.name || 'bithangul'}.hex`, 'text/plain');
    } catch (err) {
      console.error('HEX 내보내기 실패:', err);
      alert('HEX 내보내기에 실패했습니다.');
    } finally {
      isExportingHEX = false;
    }
  }
</script>

<div class="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
  <!-- Toolbar -->
  <header class="h-14 border-b px-4 gap-2 flex items-center justify-between shrink-0 bg-card">
    <div class="flex items-center gap-4">
      <h1 class="font-bold text-lg truncate">BitHangul</h1>
      <ButtonGroup.Root>
        <Button variant="outline" size="sm" onclick={handleLoadProject}>
          <Upload /> 로드
        </Button>
        <Button variant="outline" size="sm" onclick={handleSaveProject}>
          <Download /> 저장
        </Button>
      </ButtonGroup.Root>
    </div>

    <div class="flex items-center">
      <ButtonGroup.Root>
        <ButtonGroup.Root>
          <Button size="sm" onclick={handleGenerate} disabled={isGenerating}>
            {#if isGenerating}
              <Spinner />
            {:else}
              <Play />
            {/if}
            {isGenerating ? '생성 중…' : '한글 음절 생성'}
          </Button>
        </ButtonGroup.Root>
        <ButtonGroup.Root>
          <Tooltip.Provider delayDuration={0}>
            <Tooltip.Root>
              <Tooltip.Trigger class={buttonVariants({ variant: "outline", size: "sm" })} onclick={handleExportBDF}
              disabled={!generatedData || isExportingBDF || isExportingHEX}>
                {#if isExportingHEX}<Spinner />{:else}<FileCode />{/if}
                {isExportingBDF ? '내보내는 중…' : 'BDF로 내보내기'}
              </Tooltip.Trigger>
              <Tooltip.Content>
                <p>폰트를 비트맵 배포 형식(BDF)으로 내보냅니다.</p>
              </Tooltip.Content>
            </Tooltip.Root>
          </Tooltip.Provider>

          <Tooltip.Provider delayDuration={0}>
            <Tooltip.Root>
              <Tooltip.Trigger class={buttonVariants({ variant: "outline", size: "sm" })} onclick={handleExportHEX}
              disabled={!generatedData || isExportingBDF || isExportingHEX}>
                {#if isExportingHEX}<Spinner />{:else}<FileCode />{/if}
                {isExportingHEX ? '내보내는 중…' : 'HEX로 내보내기'}
              </Tooltip.Trigger>
              <Tooltip.Content align="end">
                <p>폰트를 GNU Unifont HEX 형식으로 내보냅니다.</p>
              </Tooltip.Content>
            </Tooltip.Root>
          </Tooltip.Provider>
        </ButtonGroup.Root>
      </ButtonGroup.Root>
    </div>
  </header>

  <!-- Main Content -->
  <Resizable.PaneGroup direction="horizontal" class="flex-1 flex overflow-hidden">
    <!-- Left Panel -->
    <Resizable.Pane defaultSize={35} minSize={20} maxSize={60} class="flex flex-col bg-sidebar">
      {#if projectState.selectedComponentId && projectState.selectedComponent}
        <!-- Edit Mode -->
        {@const sel = projectState.selectedComponent}
        {@const siblings = projectState.project.components.filter(
          (c) => c.id !== sel.id && c.type === sel.type && c.typeIndex === sel.typeIndex,
        )}
        <ComponentEditor
          component={sel}
          siblingComponents={siblings}
          onSave={(updated) => {
            projectState.updateComponent(updated.id, updated);
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
          onAdd={(type, typeIndex) => projectState.addComponent(type, typeIndex)}
          onDelete={(id) => projectState.deleteComponent(id)}
        />
      {/if}
    </Resizable.Pane>
    <Resizable.Handle class="bg-card border-x w-2" />
    <!-- Right Panel (Preview) -->
    <Resizable.Pane defaultSize={65} minSize={40} class="overflow-hidden">
      <Preview {generatedData} />
    </Resizable.Pane>
  </Resizable.PaneGroup>
</div>
