<script lang="ts">
  import {
    AppShell,
    Layout,
    LayoutPanel,
    LayoutContent,
    ResizeHandle,
    Button,
    Dialog,
    DialogHeader,
    HStack,
    VStack,
    Heading,
    Text,
  } from '@astryx-svelte/core'
  import {useResizable} from '@astryx-svelte/core/hooks'
  import {Download, Upload, FileCode, BookOpen, Settings} from '@lucide/svelte'
  import {onMount} from 'svelte'

  import type {FontProject, ComponentType, PixelComponent} from '#lib/types.js'

  import FontSettingsDialog from '#lib/components/FontSettingsDialog.svelte'
  import ComponentEditor from '#lib/components/pixel-editor/ComponentEditor.svelte'
  import ComponentList from '#lib/components/pixel-editor/ComponentList.svelte'
  import GroupManager from '#lib/components/pixel-editor/GroupManager.svelte'
  import SplitComponentDialog from '#lib/components/pixel-editor/SplitComponentDialog.svelte'
  import Preview from '#lib/components/Preview.svelte'
  import {downloadText} from '#lib/export.js'
  import {getHEXDimensions, type FontExportType} from '#lib/font-export.js'
  import {applyFontSettings, getFontSettings, type FontSettings} from '#lib/font-settings.js'
  import {COMPONENT_TYPE_LABELS} from '#lib/hangul.js'
  import {serializeProject, deserializeProject} from '#lib/serialization.js'
  import {projectState} from '#lib/state.svelte.js'
  import ExportWorker from '#lib/workers/export.worker?worker'
  import GeneratorWorker from '#lib/workers/generator.worker?worker'

  const panel = useResizable({defaultSize: 480, minSizePx: 280, maxSizePx: 900, autoSaveId: 'bithangul-editor'})

  let generatorWorker: Worker
  let exportWorker: Worker
  let generatorBusy = false
  let generationPending = false
  let generationFrame = 0
  let generatedData = $state<ArrayBuffer | null>(null)
  let isGenerating = $state(false)
  let isExportingBDF = $state(false)
  let isExportingHEX = $state(false)
  let isExportingGlyphs = $state(false)
  let exportError = $state('')
  let exportFilename = ''
  const exporting = $derived(isExportingBDF || isExportingHEX || isExportingGlyphs)
  const settings = $derived(getFontSettings(projectState.project))
  let settingsProject = $state<FontProject | null>(null)
  let settingsHasDraft = $state(false)
  let settingsRevision = $state(0)
  let editor = $state<{getDraft: () => {component: PixelComponent; baseline: number}} | undefined>()

  function openFontSettings() {
    const snapshot = structuredClone($state.snapshot(projectState.project))
    const draft = projectState.selectedComponentId ? editor?.getDraft() : undefined
    settingsHasDraft = Boolean(draft)
    if (draft) {
      snapshot.baseline = draft.baseline
      snapshot.components = snapshot.components.map((component) =>
        component.id === draft.component.id ? draft.component : component,
      )
    }
    settingsProject = snapshot
  }

  function saveFontSettings(next: FontSettings) {
    if (!settingsProject) return
    const selectedId = projectState.selectedComponentId
    projectState.loadProject(applyFontSettings($state.snapshot(settingsProject), next))
    projectState.selectComponent(selectedId)
    settingsRevision++
    settingsProject = null
    generatedData = null
    handleGenerate()
  }

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
      const {type, result, error} = e.data
      isExportingBDF = false
      isExportingHEX = false
      isExportingGlyphs = false
      if (error) {
        exportError = error
        return
      }
      downloadText(result, `${exportFilename}.${type}`, 'text/plain')
    }
    exportWorker.onerror = () => {
      isExportingBDF = isExportingHEX = isExportingGlyphs = false
      exportError = '내보내기에 실패했습니다. 다시 시도해 주세요.'
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

  function handleExport(type: FontExportType) {
    if (!generatedData || isGenerating || exporting) return
    exportError = ''
    exportFilename = projectState.project.name || 'bithangul'
    if (type === 'hex') {
      const {width, height} = getHEXDimensions(settings)
      exportFilename += `-${width}x${height}`
    }
    if (type === 'bdf') isExportingBDF = true
    else if (type === 'hex') isExportingHEX = true
    else isExportingGlyphs = true
    const bufferCopy = generatedData.slice(0)
    exportWorker.postMessage({type, buffer: bufferCopy, settings: $state.snapshot(settings)}, [bufferCopy])
  }
</script>

<!-- Frame: wrapping toolbar | editor 480px (280–900px, resizable) | preview fills remaining space.
     Narrow screens retain independently scrollable panels; toolbar actions wrap. -->
<AppShell contentPadding={0} variant="surface" mobileNav={false}>
  {#snippet topNav()}
    <HStack padding={3} gap={3} justify="between" align="center" wrap="wrap" class="border-default border-b">
      <HStack gap={2} align="center" wrap="wrap">
        <Heading level={3} accessibilityLevel={1}>BitHangul</Heading>
        <Button label="불러오기…" size="sm" onclick={handleLoadProject}>{#snippet icon()}<Upload />{/snippet}</Button>
        <Button label="저장" size="sm" onclick={handleSaveProject}>{#snippet icon()}<Download />{/snippet}</Button>
        <Button label="폰트 설정" size="sm" onclick={openFontSettings}>{#snippet icon()}<Settings />{/snippet}</Button>
        <Button label="예제 불러오기…" size="sm" onclick={() => (exampleDialogOpen = true)}
          >{#snippet icon()}<BookOpen />{/snippet}</Button
        >
      </HStack>
      <HStack gap={2} wrap="wrap">
        <Button
          label="BDF로 내보내기"
          size="sm"
          onclick={() => handleExport('bdf')}
          isDisabled={!generatedData || isGenerating || exporting}
          isLoading={isExportingBDF}
          tooltip="폰트를 비트맵 배포 형식(BDF)으로 내보냅니다.">{#snippet icon()}<FileCode />{/snippet}</Button
        >
        <Button
          label="HEX로 내보내기"
          size="sm"
          onclick={() => handleExport('hex')}
          isDisabled={!generatedData || isGenerating || exporting}
          isLoading={isExportingHEX}
          tooltip={`HEX는 ${getHEXDimensions(settings).width}×${getHEXDimensions(settings).height}px로 빈 픽셀을 채워 저장합니다. 확장 크기는 불러오는 도구에서 높이를 지정해야 합니다.`}
          >{#snippet icon()}<FileCode />{/snippet}</Button
        >
        <Button
          label="Glyphs로 내보내기"
          size="sm"
          onclick={() => handleExport('glyphs')}
          isDisabled={!generatedData || isGenerating || exporting}
          isLoading={isExportingGlyphs}>{#snippet icon()}<FileCode />{/snippet}</Button
        >
      </HStack>
    </HStack>
  {/snippet}
  <Layout>
    {#snippet header()}{#if exportError}<Text role="alert" class="text-error">{exportError}</Text>{/if}{/snippet}
    {#snippet start()}
      <LayoutPanel resizable={panel.props} isScrollable={false} padding={0} label="컴포넌트 편집">
        {#if projectState.selectedComponentId && projectState.selectedComponent}
          {@const sel = projectState.selectedComponent}
          {#key settingsRevision}
            <ComponentEditor
              bind:this={editor}
              component={sel}
              onSave={(updated, baseline) => {
                projectState.project.baseline = baseline
                projectState.updateComponent(updated.id, updated)
                projectState.selectComponent(null)
                handleGenerate()
              }}
              onCancel={() => {
                projectState.selectComponent(null)
              }}
            />
          {/key}
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
      </LayoutPanel>
      <ResizeHandle resizable={panel.props} label="편집 패널 너비" hasDivider />
    {/snippet}
    <LayoutContent padding={0} isScrollable={false} label="폰트 미리보기">
      <Preview {generatedData} width={settings.width} height={settings.height} />
    </LayoutContent>
  </Layout>
</AppShell>

<Dialog isOpen={exampleDialogOpen} onOpenChange={(value) => (exampleDialogOpen = value)}>
  <DialogHeader
    title="예제 불러오기"
    subtitle="예제 프로젝트를 선택하면 현재 프로젝트를 대체합니다."
    onOpenChange={(value) => (exampleDialogOpen = value)}
  />
  <VStack padding={4} gap={2}>
    {#each EXAMPLES as example}
      <Button label={example.name} onclick={() => loadExample(example.loader)}
        >{#snippet icon()}<BookOpen />{/snippet}</Button
      >
    {/each}
  </VStack>
  <HStack padding={4} justify="end"><Button label="취소" onclick={() => (exampleDialogOpen = false)} /></HStack>
</Dialog>
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

<Dialog isOpen={deleteTarget !== null} onOpenChange={(open) => !open && (deleteTarget = null)} purpose="required">
  <DialogHeader title="바리에이션을 삭제할까요?" />
  <VStack padding={4}>
    <Text>
      {#if deletePlan && deletePlan.groups.length > 0}
        {COMPONENT_TYPE_LABELS[deletePlan.component.type]} 바리에이션 관리에서 ‘{deletePlan.groups
          .map(({group}) => group.name)
          .join(', ')}’ 규칙을 제거합니다. 이 규칙에서 파생된 모든 행의 {deletePlan.affectedComponentCount}개 컴포넌트가
        함께 정리됩니다.
      {:else}이 컴포넌트에는 삭제할 수 있는 바리에이션 규칙이 없습니다.{/if}
    </Text>
  </VStack>
  <HStack padding={4} gap={2} justify="end" wrap="wrap">
    <Button label="취소" onclick={() => (deleteTarget = null)} />
    <Button
      label="바리에이션과 컴포넌트 삭제"
      variant="destructive"
      isDisabled={!deletePlan || deletePlan.groups.length === 0}
      onclick={() => {
        if (deleteTarget) {
          const deleted = projectState.deleteComponent(deleteTarget.id)
          deleteTarget = null
          if (deleted) handleGenerate()
        }
      }}
    />
  </HStack>
</Dialog>
{#if settingsProject}
  <FontSettingsDialog
    project={settingsProject}
    hasDraft={settingsHasDraft}
    onApply={saveFontSettings}
    onClose={() => (settingsProject = null)}
  />
{/if}
