<script lang="ts">
  import * as Resizable from '$lib/components/ui/resizable/index.js';
  import { onMount, tick } from 'svelte';
  import { projectState } from '$lib/state.svelte';
  import ComponentList from '$lib/components/pixel-editor/ComponentList.svelte';
  import ComponentEditor from '$lib/components/pixel-editor/ComponentEditor.svelte';
  import GroupManager from '$lib/components/pixel-editor/GroupManager.svelte';
  import Preview from '$lib/components/Preview.svelte';
  import { Button, buttonVariants } from '$lib/components/ui/button';
  import * as ButtonGroup from '$lib/components/ui/button-group/index.js';
  import { Spinner } from '$lib/components/ui/spinner/index.js';
  import { Download, Upload, FileCode, BookOpen } from '@lucide/svelte';
  import GeneratorWorker from '$lib/workers/generator.worker?worker';
  import ExportWorker from '$lib/workers/export.worker?worker';
  import { downloadText } from '$lib/export';
  import * as Tooltip from '$lib/components/ui/tooltip/index.js';
  import * as Dialog from '$lib/components/ui/dialog/index.js';
  import type { FontProject, ComponentType } from '$lib/types';

  let generatorWorker: Worker;
  let exportWorker: Worker;
  let generatedData = $state<ArrayBuffer | null>(null);
  let isGenerating = $state(false);
  let isExportingBDF = $state(false);
  let isExportingHEX = $state(false);

  /** 컴포넌트 목록 스크롤 위치 보존 */
  let componentListScrollTop = $state(0);
  let exampleDialogOpen = $state(false);

  // Group Manager State
  let gmOpen = $state(false);
  let gmType = $state<ComponentType | null>(null);

  const EXAMPLES: { name: string; loader: () => Promise<FontProject> }[] = [
    {
      name: '둥근모꼴 (한글도깨비 8x4x4벌식)',
      loader: () => import('$lib/assets/Dunggeunmo.json').then((m) => m.default as unknown as FontProject),
    },
  ];

  async function loadExample(loader: () => Promise<FontProject>) {
    try {
      let data = await loader();
      data = deserializeProject(data);
      if (data.components) {
        projectState.loadProject(data);
        generatedData = null;
        handleGenerate();
      }
    } catch (err) {
      console.error('예제 불러오기 실패:', err);
      alert('예제를 불러오는 데 실패했습니다.');
    }
    exampleDialogOpen = false;
  }

  onMount(() => {
    // Check if initial sync is needed
    if (projectState.project.components.length === 0) {
      projectState.syncComponents();
    }

    generatorWorker = new GeneratorWorker();
    generatorWorker.onmessage = (e) => {
      generatedData = e.data.buffer;
      isGenerating = false;
    };

    exportWorker = new ExportWorker();
    exportWorker.onmessage = (e) => {
      const { type, result } = e.data;
      const name = projectState.project.name || 'bithangul';
      if (type === 'bdf') {
        downloadText(result, `${name}.bdf`, 'text/plain');
        isExportingBDF = false;
      } else if (type === 'hex') {
        downloadText(result, `${name}.hex`, 'text/plain');
        isExportingHEX = false;
      }
    };

    return () => {
      generatorWorker.terminate();
      exportWorker.terminate();
    };
  });

  function handleGenerate() {
    isGenerating = true;
    const snapshot = $state.snapshot(projectState.project);
    generatorWorker.postMessage(snapshot);
  }

  function serializeProject(proj: FontProject): any {
    const clone = structuredClone(proj) as any;
    for (const c of clone.components) {
      if (Array.isArray(c.bitmap)) {
        let hex = '';
        for (let r = 0; r < 16; r++) {
          let val = 0;
          for (let col = 0; col < 16; col++) {
            if (c.bitmap[r][col]) val |= 1 << (15 - col);
          }
          hex += val.toString(16).padStart(4, '0');
        }
        c.bitmap = hex;
      }
    }
    return clone;
  }

  function handleSaveProject() {
    const serialized = serializeProject($state.snapshot(projectState.project));
    const data = JSON.stringify(serialized);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectState.project.name || 'font-project'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function deserializeProject(data: any): FontProject {
    if (data.components) {
      for (const c of data.components) {
        if (typeof c.bitmap === 'string') {
          const hex = c.bitmap;
          const bitmap: number[][] = [];
          for (let r = 0; r < 16; r++) {
            const val = parseInt(hex.substring(r * 4, r * 4 + 4), 16);
            const row: number[] = [];
            for (let col = 0; col < 16; col++) {
              row.push((val >> (15 - col)) & 1);
            }
            bitmap.push(row);
          }
          c.bitmap = bitmap;
        }
      }
    }
    return data as FontProject;
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
        let data = JSON.parse(text);
        data = deserializeProject(data);
        if (data.components) {
          projectState.loadProject(data);
          generatedData = null;
          handleGenerate();
        }
      } catch (err) {
        console.error(err);
        alert('Failed to load project');
      }
    };
    input.click();
  }

  function handleExportBDF() {
    if (!generatedData || isExportingBDF) return;
    isExportingBDF = true;
    const bufferCopy = generatedData.slice(0);
    exportWorker.postMessage({ type: 'bdf', buffer: bufferCopy, fontName: projectState.project.name || 'bithangul' }, [
      bufferCopy,
    ]);
  }

  function handleExportHEX() {
    if (!generatedData || isExportingHEX) return;
    isExportingHEX = true;
    const bufferCopy = generatedData.slice(0);
    exportWorker.postMessage({ type: 'hex', buffer: bufferCopy }, [bufferCopy]);
  }
</script>

<div class="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
  <header class="h-14 border-b px-4 gap-2 flex items-center justify-between shrink-0 bg-card">
    <div class="flex items-center gap-4">
      <h1 class="font-bold text-lg truncate">BitHangul</h1>
      <ButtonGroup.Root>
        <ButtonGroup.Root>
          <Button variant="outline" size="sm" onclick={handleLoadProject}>
            <Upload /> 불러오기...
          </Button>
          <Button variant="outline" size="sm" onclick={handleSaveProject}>
            <Download /> 저장
          </Button>
        </ButtonGroup.Root>
        <ButtonGroup.Root>
          <Button variant="outline" size="sm" onclick={() => (exampleDialogOpen = true)}>
            <BookOpen /> 예제 불러오기...
          </Button>
        </ButtonGroup.Root>
      </ButtonGroup.Root>
    </div>

    <div class="flex items-center">
      <ButtonGroup.Root>
        <ButtonGroup.Root>
          <Tooltip.Provider>
            <Tooltip.Root>
              <Tooltip.Trigger
                class={buttonVariants({ variant: 'outline', size: 'sm' })}
                onclick={handleExportBDF}
                disabled={!generatedData || isExportingBDF || isExportingHEX}
              >
                {#if isExportingBDF}<Spinner />{:else}<FileCode />{/if}
                {isExportingBDF ? '내보내는 중…' : 'BDF로 내보내기'}
              </Tooltip.Trigger>
              <Tooltip.Content>
                <p>폰트를 비트맵 배포 형식(BDF)으로 내보냅니다.</p>
              </Tooltip.Content>
            </Tooltip.Root>
          </Tooltip.Provider>

          <Tooltip.Provider>
            <Tooltip.Root>
              <Tooltip.Trigger
                class={buttonVariants({ variant: 'outline', size: 'sm' })}
                onclick={handleExportHEX}
                disabled={!generatedData || isExportingBDF || isExportingHEX}
              >
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

  <Resizable.PaneGroup direction="horizontal" class="flex-1 flex overflow-hidden">
    <Resizable.Pane defaultSize={35} minSize={20} maxSize={60} class="flex flex-col bg-sidebar">
      {#if projectState.selectedComponentId && projectState.selectedComponent}
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
            handleGenerate();
          }}
          onCancel={() => {
            projectState.selectComponent(null);
          }}
        />
      {:else}
        <ComponentList
          components={projectState.project.components}
          bind:scrollTop={componentListScrollTop}
          onSelect={(id) => {
            projectState.selectComponent(id);
          }}
          onOpenGroupManager={(type) => {
            gmType = type;
            gmOpen = true;
          }}
        />
      {/if}
    </Resizable.Pane>
    <Resizable.Handle class="bg-card border-x w-2" />
    <Resizable.Pane defaultSize={65} minSize={40} class="overflow-hidden">
      <Preview {generatedData} />
    </Resizable.Pane>
  </Resizable.PaneGroup>
</div>

<Dialog.Root bind:open={exampleDialogOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>예제 불러오기</Dialog.Title>
      <Dialog.Description>예제 프로젝트를 선택하면 현재 프로젝트를 대체합니다.</Dialog.Description>
    </Dialog.Header>
    <div class="flex flex-col gap-2">
      {#each EXAMPLES as example}
        <Button variant="outline" class="justify-start text-left h-auto" onclick={() => loadExample(example.loader)}>
          <BookOpen class="size-4 shrink-0" />
          <span class="font-medium">{example.name}</span>
        </Button>
      {/each}
    </div>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (exampleDialogOpen = false)}>취소</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<GroupManager
  open={gmOpen}
  type={gmType}
  initialGroups={gmType ? projectState.project.groups[gmType] || [] : []}
  onOpenChange={(v) => (gmOpen = v)}
  onSave={(newGroups) => {
    if (gmType) {
      projectState.updateGroups(gmType, newGroups);
      handleGenerate();
    }
    gmOpen = false;
  }}
/>
