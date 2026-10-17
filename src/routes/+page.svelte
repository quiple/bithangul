<script lang="ts">
  import {Download, Upload, FileCode, BookOpen} from '@lucide/svelte'
  import {onMount} from 'svelte'

  import type {FontProject, ComponentType, PixelComponent} from '#lib/types.js'

  import ComponentEditor from '#lib/components/pixel-editor/ComponentEditor.svelte'
  import ComponentList from '#lib/components/pixel-editor/ComponentList.svelte'
  import GroupManager from '#lib/components/pixel-editor/GroupManager.svelte'
  import SplitComponentDialog from '#lib/components/pixel-editor/SplitComponentDialog.svelte'
  import Preview from '#lib/components/Preview.svelte'
  import * as ButtonGroup from '#lib/components/ui/button-group/index.js'
  import {Button, buttonVariants} from '#lib/components/ui/button/index.js'
  import * as Dialog from '#lib/components/ui/dialog/index.js'
  import * as Resizable from '#lib/components/ui/resizable/index.js'
  import {Spinner} from '#lib/components/ui/spinner/index.js'
  import * as Tooltip from '#lib/components/ui/tooltip/index.js'
  import {downloadText} from '#lib/export.js'
  import {COMPONENT_TYPE_LABELS} from '#lib/hangul.js'
  import {serializeProject, deserializeProject} from '#lib/serialization.js'
  import {projectState} from '#lib/state.svelte.js'
  import ExportWorker from '#lib/workers/export.worker?worker'
  import GeneratorWorker from '#lib/workers/generator.worker?worker'

  let generatorWorker: Worker
  let exportWorker: Worker
  let generatorBusy = false
  let generationPending = false
  let generationFrame = 0
  let generatedData = $state<ArrayBuffer | null>(null)
  let isGenerating = $state(false)
  let isExportingBDF = $state(false)
  let isExportingHEX = $state(false)

  /** 초성·중성·종성 컴포넌트 목록의 스크롤 위치를 각각 보존 */
  let componentListScrollPositions = $state<Record<ComponentType, number>>({
    chosung: 0,
    jungsung: 0,
    jongsung: 0,
  })
  let componentListActiveTab = $state<ComponentType>('chosung')
  let exampleDialogOpen = $state(false)

  // Group Manager State
  let gmOpen = $state(false)
  let gmType = $state<ComponentType | null>(null)

  // Component context-menu actions
  let splitDialogOpen = $state(false)
  let splitTarget = $state<PixelComponent | null>(null)
  let deleteTarget = $state<PixelComponent | null>(null)
  let deletePlan = $derived(deleteTarget ? projectState.getComponentDeletionPlan(deleteTarget.id) : null)

  const EXAMPLES: {name: string; loader: () => Promise<FontProject>}[] = [
    {
      name: '둥근모꼴 (한글도깨비 8x4x4벌식)',
      loader: () => import('#lib/assets/Dunggeunmo.json').then((m) => m.default as unknown as FontProject),
    },
  ]

  function applyProject(data: unknown, clone = false) {
    const project = deserializeProject(clone ? structuredClone(data) : data)
    if (!project.components) throw new Error('컴포넌트 데이터가 없습니다.')
    projectState.loadProject(project)
    generatedData = null
    handleGenerate()
  }

  async function loadExample(loader: () => Promise<FontProject>) {
    try {
      applyProject(await loader(), true)
    } catch (err) {
      console.error('예제 불러오기 실패:', err)
      alert('예제를 불러오는 데 실패했습니다.')
    }
    exampleDialogOpen = false
  }

  onMount(() => {
    // Check if initial sync is needed
    if (projectState.project.components.length === 0) {
      projectState.syncComponents()
    }

    generatorWorker = new GeneratorWorker()
    generatorWorker.onmessage = (e) => {
      generatorBusy = false
      if (generationPending) {
        scheduleGeneration()
        return
      }
      generatedData = e.data.buffer
      isGenerating = false
    }

    exportWorker = new ExportWorker()
    exportWorker.onmessage = (e) => {
      const {type, result} = e.data
      const name = projectState.project.name || 'bithangul'
      if (type === 'bdf') {
        downloadText(result, `${name}.bdf`, 'text/plain')
        isExportingBDF = false
      } else if (type === 'hex') {
        downloadText(result, `${name}.hex`, 'text/plain')
        isExportingHEX = false
      }
    }

    return () => {
      if (generationFrame) cancelAnimationFrame(generationFrame)
      generatorWorker.terminate()
      exportWorker.terminate()
    }
  })

  function handleGenerate() {
    isGenerating = true
    generationPending = true
    scheduleGeneration()
  }

  function scheduleGeneration() {
    if (generatorBusy || generationFrame || !generationPending) return
    generationFrame = requestAnimationFrame(() => {
      generationFrame = 0
      if (generatorBusy || !generationPending) return
      generationPending = false
      generatorBusy = true
      generatorWorker.postMessage($state.snapshot(projectState.project))
    })
  }

  function handleSaveProject() {
    const serialized = serializeProject(projectState.project)
    const data = JSON.stringify(serialized)
    downloadText(data, `${projectState.project.name || 'font-project'}.json`, 'application/json')
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
        applyProject(JSON.parse(text))
      } catch (err) {
        console.error(err)
        alert('프로젝트를 불러오지 못했습니다.')
      }
    }
    input.click()
  }

  function handleExport(type: 'bdf' | 'hex') {
    if (!generatedData || isExportingBDF || isExportingHEX) return
    if (type === 'bdf') isExportingBDF = true
    else isExportingHEX = true

    const bufferCopy = generatedData.slice(0)
    exportWorker.postMessage(
      {type, buffer: bufferCopy, fontName: type === 'bdf' ? projectState.project.name || 'bithangul' : undefined},
      [bufferCopy],
    )
  }
</script>

<div class="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
  <header class="flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-card px-4">
    <div class="flex items-center gap-4">
      <h1 class="truncate text-lg font-bold">BitHangul</h1>
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
                class={buttonVariants({variant: 'outline', size: 'sm'})}
                onclick={() => handleExport('bdf')}
                disabled={!generatedData || isGenerating || isExportingBDF || isExportingHEX}
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
                class={buttonVariants({variant: 'outline', size: 'sm'})}
                onclick={() => handleExport('hex')}
                disabled={!generatedData || isGenerating || isExportingBDF || isExportingHEX}
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

  <Resizable.PaneGroup direction="horizontal" class="flex flex-1 overflow-hidden">
    <Resizable.Pane defaultSize={35} minSize={20} maxSize={60} class="flex flex-col bg-sidebar">
      {#if projectState.selectedComponentId && projectState.selectedComponent}
        {@const sel = projectState.selectedComponent}
        <ComponentEditor
          component={sel}
          onSave={(updated) => {
            projectState.updateComponent(updated.id, updated)
            projectState.selectComponent(null)
            handleGenerate()
          }}
          onCancel={() => {
            projectState.selectComponent(null)
          }}
        />
      {:else}
        <ComponentList
          components={projectState.project.components}
          scrollPositions={componentListScrollPositions}
          bind:activeTab={componentListActiveTab}
          onScrollPositionChange={(type, position) => {
            componentListScrollPositions = {...componentListScrollPositions, [type]: position}
          }}
          onSelect={(id) => {
            projectState.selectComponent(id)
          }}
          onSplit={(component) => {
            splitTarget = component
            splitDialogOpen = true
          }}
          onDelete={(component) => {
            deleteTarget = component
          }}
          onOpenGroupManager={(type) => {
            gmType = type
            gmOpen = true
          }}
        />
      {/if}
    </Resizable.Pane>
    <Resizable.Handle class="w-2 border-x bg-card" />
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
        <Button variant="outline" class="h-auto justify-start text-left" onclick={() => loadExample(example.loader)}>
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
      projectState.updateGroups(gmType, newGroups)
      handleGenerate()
    }
    gmOpen = false
  }}
/>

<SplitComponentDialog
  open={splitDialogOpen}
  component={splitTarget}
  onOpenChange={(open) => {
    splitDialogOpen = open
    if (!open) splitTarget = null
  }}
  onSplit={(selections, customName) => {
    if (!splitTarget) return
    const newComponent = projectState.splitComponent(splitTarget.id, selections, customName)
    if (newComponent) {
      handleGenerate()
      projectState.selectComponent(newComponent.id)
    }
  }}
/>

<Dialog.Root open={deleteTarget !== null} onOpenChange={(open) => !open && (deleteTarget = null)}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>바리에이션을 삭제할까요?</Dialog.Title>
      <Dialog.Description>
        {#if deletePlan && deletePlan.groups.length > 0}
          {COMPONENT_TYPE_LABELS[deletePlan.component.type]} 바리에이션 관리에서 ‘{deletePlan.groups
            .map(({group}) => group.name)
            .join(', ')}’ 규칙을 제거합니다. 이 규칙에서 파생된 모든 행의
          {deletePlan.affectedComponentCount}개 컴포넌트가 함께 정리됩니다.
        {:else}
          이 컴포넌트에는 삭제할 수 있는 바리에이션 규칙이 없습니다.
        {/if}
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (deleteTarget = null)}>취소</Button>
      <Button
        variant="destructive"
        disabled={!deletePlan || deletePlan.groups.length === 0}
        onclick={() => {
          if (deleteTarget) {
            const deleted = projectState.deleteComponent(deleteTarget.id)
            deleteTarget = null
            if (deleted) handleGenerate()
          }
        }}>바리에이션과 컴포넌트 삭제</Button
      >
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
