<script lang="ts">
  import {untrack} from 'svelte'

  import type {FontSettings} from '#lib/font-settings.js'
  import type {FontProject} from '#lib/types.js'

  import {Button} from '#lib/components/ui/button/index.js'
  import * as Dialog from '#lib/components/ui/dialog/index.js'
  import {Input} from '#lib/components/ui/input/index.js'
  import {getFontSettings, countCroppedPixels, MAX_GRID_SIZE} from '#lib/font-settings.js'

  let {
    project,
    hasDraft = false,
    onApply,
    onClose,
  }: {
    project: FontProject
    hasDraft?: boolean
    onApply: (settings: FontSettings) => void
    onClose: () => void
  } = $props()
  let draft = $state(untrack(() => getFontSettings(project)))
  let allowCrop = $state(false)
  let error = $state('')
  const croppedPixels = $derived(countCroppedPixels(project, draft.width, draft.height))
  $effect(() => {
    void draft.width
    void draft.height
    allowCrop = false
  })

  function submit(event: SubmitEvent) {
    event.preventDefault()
    error = ''
    if (!draft.name.trim() || !draft.styleName.trim()) {
      error = '폰트명과 스타일명을 입력해 주세요.'
      return
    }
    if (croppedPixels && !allowCrop) {
      error = '잘리는 픽셀 수를 확인하고 크기 축소에 동의해 주세요.'
      return
    }
    onApply({...$state.snapshot(draft), name: draft.name.trim(), styleName: draft.styleName.trim()})
  }

  const identityFields = [
    {key: 'designer', label: '디자이너', type: 'text'},
    {key: 'designerURL', label: '디자이너 웹사이트', type: 'url'},
    {key: 'manufacturer', label: '제작사', type: 'text'},
    {key: 'manufacturerURL', label: '제작사 웹사이트', type: 'url'},
  ] as const
</script>

<Dialog.Root open onOpenChange={(open) => !open && onClose()}>
  <Dialog.Content class="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-2xl">
    <Dialog.Header>
      <Dialog.Title>폰트 설정</Dialog.Title>
      <Dialog.Description>폰트 정보, 픽셀 크기와 내보내기 메트릭을 설정합니다.</Dialog.Description>
    </Dialog.Header>
    <form class="flex min-h-0 flex-1 flex-col gap-4" onsubmit={submit}>
      <div class="min-h-0 space-y-6 overflow-y-auto px-1 pb-1">
        <fieldset class="space-y-3">
          <legend class="mb-3 font-semibold">폰트 정보</legend>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="space-y-1.5">
              <label for="font-name" class="text-sm">폰트명 (패밀리)</label><Input
                id="font-name"
                name="name"
                bind:value={draft.name}
                required
                maxlength={200}
              />
            </div>
            <div class="space-y-1.5">
              <label for="font-style" class="text-sm">스타일명</label><Input
                id="font-style"
                name="styleName"
                bind:value={draft.styleName}
                required
                maxlength={100}
              />
            </div>
            <div class="space-y-1.5">
              <label for="font-major" class="text-sm">버전 · 주 번호</label><Input
                id="font-major"
                name="versionMajor"
                type="number"
                min={0}
                max={999}
                step={1}
                required
                bind:value={draft.versionMajor}
              />
            </div>
            <div class="space-y-1.5">
              <label for="font-minor" class="text-sm">버전 · 부 번호</label><Input
                id="font-minor"
                name="versionMinor"
                type="number"
                min={0}
                max={999}
                step={1}
                required
                bind:value={draft.versionMinor}
              />
            </div>
          </div>
          <div class="space-y-1.5">
            <label for="font-description" class="text-sm">설명</label><textarea
              id="font-description"
              name="description"
              rows="2"
              class="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
              bind:value={draft.description}></textarea>
          </div>
        </fieldset>
        <fieldset class="space-y-3">
          <legend class="mb-3 font-semibold">디자이너 · 제작사</legend>
          <div class="grid gap-3 sm:grid-cols-2">
            {#each identityFields as field}
              <div class="space-y-1.5">
                <label for="font-{field.key}" class="text-sm">{field.label}</label><Input
                  id="font-{field.key}"
                  name={field.key}
                  type={field.type}
                  bind:value={draft[field.key]}
                />
              </div>
            {/each}
          </div>
        </fieldset>
        <fieldset class="space-y-3">
          <legend class="mb-3 font-semibold">저작권 · 라이선스</legend>
          <div class="space-y-1.5">
            <label for="font-copyright" class="text-sm">저작권 표시</label><textarea
              id="font-copyright"
              name="copyright"
              rows="2"
              class="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
              bind:value={draft.copyright}></textarea>
          </div>
          <div class="space-y-1.5">
            <label for="font-license" class="text-sm">라이선스 내용</label><textarea
              id="font-license"
              name="license"
              rows="3"
              class="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
              bind:value={draft.license}></textarea>
          </div>
          <div class="space-y-1.5">
            <label for="font-license-url" class="text-sm">라이선스 URL</label><Input
              id="font-license-url"
              name="licenseURL"
              type="url"
              bind:value={draft.licenseURL}
            />
          </div>
        </fieldset>
        <fieldset class="space-y-3">
          <legend class="mb-3 font-semibold">픽셀 그리드 · 메트릭</legend>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="space-y-1.5">
              <label for="font-width" class="text-sm">너비 (px)</label><Input
                id="font-width"
                name="width"
                type="number"
                min={1}
                max={MAX_GRID_SIZE}
                step={1}
                required
                bind:value={draft.width}
              />
            </div>
            <div class="space-y-1.5">
              <label for="font-height" class="text-sm">높이 (px)</label><Input
                id="font-height"
                name="height"
                type="number"
                min={1}
                max={MAX_GRID_SIZE}
                step={1}
                required
                bind:value={draft.height}
                onchange={() => {
                  draft.baseline = Math.min(draft.baseline, draft.height || 16)
                }}
              />
            </div>
            <div class="space-y-1.5">
              <label for="font-baseline" class="text-sm">베이스라인 (위에서 px)</label><Input
                id="font-baseline"
                name="baseline"
                type="number"
                min={0}
                max={draft.height}
                step={1}
                required
                bind:value={draft.baseline}
              />
            </div>
          </div>
          <p class="text-xs text-muted-foreground">
            1–64px. 기존 그림의 왼쪽 위를 유지하고, 늘어난 영역은 빈 픽셀로 채웁니다.
          </p>
          {#if croppedPixels > 0}
            <div class="space-y-2 rounded-md border border-destructive/40 p-3 text-sm">
              <p>크기를 줄이면 범위 밖의 채워진 픽셀 {croppedPixels.toLocaleString()}개가 삭제됩니다.</p>
              <label class="flex items-start gap-2"
                ><input name="allowCrop" type="checkbox" bind:checked={allowCrop} required class="mt-1" />픽셀 삭제를
                확인했고 이 크기를 적용합니다.</label
              >
            </div>
          {/if}
        </fieldset>
        <fieldset class="space-y-3">
          <legend class="mb-3 font-semibold">Glyphs 내보내기</legend>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="space-y-1.5">
              <label for="font-upm" class="text-sm">UPM (Units per Em)</label><Input
                id="font-upm"
                name="unitsPerEm"
                type="number"
                min={16}
                max={16384}
                step={1}
                required
                bind:value={draft.unitsPerEm}
              />
            </div>
            <div class="space-y-1.5">
              <label for="font-pixel-size" class="text-sm">1픽셀 크기 (폰트 유닛)</label><Input
                id="font-pixel-size"
                name="pixelSize"
                type="number"
                min={1}
                max={1000}
                step={1}
                required
                bind:value={draft.pixelSize}
              />
            </div>
          </div>
          <p class="text-xs text-muted-foreground">
            글자 폭 {draft.width * draft.pixelSize} · 어센더 {draft.baseline * draft.pixelSize} · 디센더 {(draft.baseline -
              draft.height) *
              draft.pixelSize} 유닛. 공통 pixel 컴포넌트와 픽셀 크기의 그리드로 내보냅니다.
          </p>
          <p class="text-xs text-muted-foreground">
            HEX는 높이를 16·24·32·64px 중 다음 크기로, 너비를 8px 단위로 올림하여 빈 픽셀을 채웁니다. 프로젝트 크기는
            유지됩니다.
          </p>
        </fieldset>
      </div>
      {#if error}<p role="alert" class="text-sm text-destructive">{error}</p>{/if}
      {#if hasDraft}<p class="text-xs text-muted-foreground">
          설정을 적용하면 현재 편집 중인 픽셀과 베이스라인도 프로젝트에 반영됩니다.
        </p>{/if}
      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={onClose}>취소</Button>
        <Button type="submit">설정 적용</Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
