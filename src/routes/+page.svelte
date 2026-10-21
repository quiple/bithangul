<script lang="ts">
  import {
    AppShell,
    Layout,
    LayoutPanel,
    LayoutContent,
    ResizeHandle,
    Button,
    ButtonGroup,
    DropdownMenu,
    Dialog,
    DialogHeader,
    HStack,
    VStack,
    Heading,
    Text,
  } from '@astryx-svelte/core'
  import {useResizable} from '@astryx-svelte/core'
  import {FileCode} from '@lucide/svelte'
  import {onMount} from 'svelte'
  import {innerWidth} from 'svelte/reactivity/window'

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
  import {canNudge, nudgeComponents, type NudgeDirection} from '#lib/nudge.js'
  import {serializeProject, deserializeProject} from '#lib/serialization.js'
  import {projectState} from '#lib/state.svelte.js'
  import ExportWorker from '#lib/workers/export.worker?worker'
  import GeneratorWorker from '#lib/workers/generator.worker?worker'

  const panel = useResizable(() => ({
    defaultSize: '35%',
    minSizePx: (innerWidth.current ?? 1200) * 0.2,
    maxSizePx: (innerWidth.current ?? 1200) * 0.6,
  }))

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

  // Group Manager State
  let gmOpen = $state(false)
  let gmType = $state<ComponentType | null>(null)

  // Component context-menu actions
  let splitDialogOpen = $state(false)
  let splitTarget = $state<PixelComponent | null>(null)
  let deleteTarget = $state<PixelComponent | null>(null)
  let deletePlan = $derived(deleteTarget ? projectState.getComponentDeletionPlan(deleteTarget.id) : null)

  const moveDirections = [
    {direction: 'up', label: '위로 1px 이동', key: 'ArrowUp', shortcut: 'Ctrl+Alt+↑'},
    {direction: 'down', label: '아래로 1px 이동', key: 'ArrowDown', shortcut: 'Ctrl+Alt+↓'},
    {direction: 'left', label: '왼쪽으로 1px 이동', key: 'ArrowLeft', shortcut: 'Ctrl+Alt+←'},
    {direction: 'right', label: '오른쪽으로 1px 이동', key: 'ArrowRight', shortcut: 'Ctrl+Alt+→'},
  ] as const
  let moveMessage = $state('')
  const moveComponents = $derived.by(() => {
    const draft = projectState.selectedComponentId ? editor?.getDraft() : undefined
    return projectState.project.components.map((component) =>
      component.id === draft?.component.id ? draft.component : component,
    )
  })
  const moveItems = $derived(
    moveDirections.map(({direction, label, shortcut}) => ({
      label,
      description: shortcut,
      isDisabled: !canNudge(moveComponents, direction),
      onClick: () => moveAllGlyphs(direction),
    })),
  )

  function moveAllGlyphs(direction: NudgeDirection) {
    const moved = nudgeComponents(moveComponents, direction)
    if (!moved) {
      moveMessage = '이동할 픽셀이 없거나, 이동하면 픽셀이 그리드 밖으로 벗어납니다.'
      return
    }
    const draft = projectState.selectedComponentId ? editor?.getDraft() : undefined
    if (draft) projectState.project.baseline = draft.baseline
    for (const component of moved) projectState.updateComponent(component.id, component)
    settingsRevision++
    moveMessage = `모든 글리프를 ${moveDirections.find((item) => item.direction === direction)!.label.replace(' 이동', '')} 이동했습니다.`
    handleGenerate()
  }

  function handleNudgeKey(event: KeyboardEvent) {
    if (
      !event.ctrlKey ||
      !event.altKey ||
      event.metaKey ||
      event.shiftKey ||
      event.isComposing ||
      event.defaultPrevented
    )
      return
    if (settingsProject || gmOpen || splitDialogOpen || deleteTarget) return
    if (
      event
        .composedPath()
        .some(
          (target) =>
            target instanceof HTMLElement &&
            (target.matches('input, textarea, select, [role="textbox"], [role="spinbutton"]') ||
              target.isContentEditable),
        )
    )
      return
    const move = moveDirections.find((item) => item.key === event.key)
    if (!move) return
    event.preventDefault()
    event.stopPropagation()
    moveAllGlyphs(move.direction)
  }

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

<svelte:window onkeydowncapture={handleNudgeKey} />

<!-- Frame: wrapping toolbar | editor 35% (20–60%, resizable) | preview fills remaining 65% initially.
     Narrow screens retain independently scrollable panels; toolbar actions wrap. -->
<AppShell contentPadding={0} variant="surface" mobileNav={false}>
  {#snippet topNav()}
    <HStack padding={3} gap={3} justify="between" align="center" wrap="wrap" class="border-b border-border">
      <HStack gap={2} align="center" wrap="wrap">
        <Heading level={3} accessibilityLevel={1}>BitHangul</Heading>
        <HStack gap={1} as="nav" aria-label="메인 메뉴">
          <DropdownMenu
            button={{label: '파일', variant: 'ghost', size: 'sm'}}
            hasChevron={false}
            menuWidth={220}
            items={[
              {label: '불러오기…', onClick: handleLoadProject},
              {label: '저장', onClick: handleSaveProject},
              {type: 'divider'},
              {label: '폰트 설정', onClick: openFontSettings},
            ]}
          />
          <DropdownMenu
            button={{label: '편집', variant: 'ghost', size: 'sm'}}
            hasChevron={false}
            menuWidth={220}
            items={[{label: '모든 글리프 이동…', items: moveItems}]}
          />
        </HStack>
        <DropdownMenu
          button={{label: '예제 불러오기', variant: 'ghost', size: 'sm'}}
          hasChevron={false}
          menuWidth={300}
          items={EXAMPLES.map((example) => ({
            label: example.name,
            description: '현재 프로젝트를 이 예제로 대체합니다.',
            onClick: () => loadExample(example.loader),
          }))}
        />
      </HStack>
      <ButtonGroup label="폰트 내보내기" size="sm">
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
      </ButtonGroup>
    </HStack>
  {/snippet}
  <Text role="status" aria-live="polite" class="sr-only">{moveMessage}</Text>
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

<Dialog
  padding={0}
  isOpen={deleteTarget !== null}
  onOpenChange={(open) => !open && (deleteTarget = null)}
  purpose="required"
>
  <DialogHeader class="bg-transparent backdrop-filter-none [&>div]:p-4" title="바리에이션을 삭제할까요?" />
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
