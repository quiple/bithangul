<script lang="ts">
  import {untrack} from 'svelte'

  import type {FontSettings} from '#lib/font-settings.js'
  import type {FontProject} from '#lib/types.js'

  import {Button} from '#lib/components/ui/button/index.js'
  import {Checkbox} from '#lib/components/ui/checkbox/index.js'
  import * as Dialog from '#lib/components/ui/dialog/index.js'
  import * as Field from '#lib/components/ui/field/index.js'
  import {Input} from '#lib/components/ui/input/index.js'
  import {Textarea} from '#lib/components/ui/textarea/index.js'
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
      <div class="min-h-0 overflow-y-auto px-1 pb-1">
        <Field.Group>
          <Field.Set>
            <Field.Legend>폰트 정보</Field.Legend>
            <div class="grid gap-3 sm:grid-cols-2">
              <Field.Field>
                <Field.Label for="font-name">폰트명 (패밀리)</Field.Label><Input
                  id="font-name"
                  name="name"
                  bind:value={draft.name}
                  required
                  maxlength={200}
                />
              </Field.Field>
              <Field.Field>
                <Field.Label for="font-style">스타일명</Field.Label><Input
                  id="font-style"
                  name="styleName"
                  bind:value={draft.styleName}
                  required
                  maxlength={100}
                />
              </Field.Field>
              <Field.Field>
                <Field.Label for="font-major">버전 · 주 번호</Field.Label><Input
                  id="font-major"
                  name="versionMajor"
                  type="number"
                  min={0}
                  max={999}
                  step={1}
                  required
                  bind:value={draft.versionMajor}
                />
              </Field.Field>
              <Field.Field>
                <Field.Label for="font-minor">버전 · 부 번호</Field.Label><Input
                  id="font-minor"
                  name="versionMinor"
                  type="number"
                  min={0}
                  max={999}
                  step={1}
                  required
                  bind:value={draft.versionMinor}
                />
              </Field.Field>
            </div>
            <Field.Field>
              <Field.Label for="font-description">설명</Field.Label><Textarea
                id="font-description"
                name="description"
                rows={2}
                bind:value={draft.description}
              ></Textarea>
            </Field.Field>
          </Field.Set>
          <Field.Set>
            <Field.Legend>디자이너 · 제작사</Field.Legend>
            <div class="grid gap-3 sm:grid-cols-2">
              {#each identityFields as field}
                <Field.Field>
                  <Field.Label for="font-{field.key}">{field.label}</Field.Label><Input
                    id="font-{field.key}"
                    name={field.key}
                    type={field.type}
                    bind:value={draft[field.key]}
                  />
                </Field.Field>
              {/each}
            </div>
          </Field.Set>
          <Field.Set>
            <Field.Legend>저작권 · 라이선스</Field.Legend>
            <Field.Field>
              <Field.Label for="font-copyright">저작권 표시</Field.Label><Textarea
                id="font-copyright"
                name="copyright"
                rows={2}
                bind:value={draft.copyright}
              ></Textarea>
            </Field.Field>
            <Field.Field>
              <Field.Label for="font-license">라이선스 내용</Field.Label><Textarea
                id="font-license"
                name="license"
                rows={3}
                bind:value={draft.license}
              ></Textarea>
            </Field.Field>
            <Field.Field>
              <Field.Label for="font-license-url">라이선스 URL</Field.Label><Input
                id="font-license-url"
                name="licenseURL"
                type="url"
                bind:value={draft.licenseURL}
              />
            </Field.Field>
          </Field.Set>
          <Field.Set>
            <Field.Legend>픽셀 그리드 · 메트릭</Field.Legend>
            <div class="grid gap-3 sm:grid-cols-2">
              <Field.Field>
                <Field.Label for="font-width">너비 (px)</Field.Label><Input
                  id="font-width"
                  name="width"
                  aria-describedby="font-grid-description"
                  type="number"
                  min={1}
                  max={MAX_GRID_SIZE}
                  step={1}
                  required
                  bind:value={draft.width}
                />
              </Field.Field>
              <Field.Field>
                <Field.Label for="font-height">높이 (px)</Field.Label><Input
                  id="font-height"
                  name="height"
                  aria-describedby="font-grid-description"
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
              </Field.Field>
              <Field.Field>
                <Field.Label for="font-baseline">베이스라인 (위에서 px)</Field.Label><Input
                  id="font-baseline"
                  name="baseline"
                  type="number"
                  min={0}
                  max={draft.height}
                  step={1}
                  required
                  bind:value={draft.baseline}
                />
              </Field.Field>
            </div>
            <Field.Description id="font-grid-description">
              1–64px. 기존 그림의 왼쪽 위를 유지하고, 늘어난 영역은 빈 픽셀로 채웁니다.
            </Field.Description>
            {#if croppedPixels > 0}
              <Field.Field orientation="horizontal" class="rounded-md border border-destructive/40 p-3">
                <Checkbox
                  id="font-allow-crop"
                  name="allowCrop"
                  bind:checked={allowCrop}
                  required
                  aria-describedby="font-crop-description"
                />
                <Field.Content>
                  <Field.Label for="font-allow-crop">픽셀 삭제를 확인했고 이 크기를 적용합니다.</Field.Label>
                  <Field.Description id="font-crop-description"
                    >크기를 줄이면 범위 밖의 채워진 픽셀 {croppedPixels.toLocaleString()}개가 삭제됩니다.</Field.Description
                  >
                </Field.Content>
              </Field.Field>
            {/if}
          </Field.Set>
          <Field.Set>
            <Field.Legend>Glyphs 내보내기</Field.Legend>
            <div class="grid gap-3 sm:grid-cols-2">
              <Field.Field>
                <Field.Label for="font-upm">UPM (Units per Em)</Field.Label><Input
                  id="font-upm"
                  name="unitsPerEm"
                  type="number"
                  min={16}
                  max={16384}
                  step={1}
                  required
                  bind:value={draft.unitsPerEm}
                />
              </Field.Field>
              <Field.Field>
                <Field.Label for="font-pixel-size">1픽셀 크기 (폰트 유닛)</Field.Label><Input
                  id="font-pixel-size"
                  name="pixelSize"
                  type="number"
                  min={1}
                  max={1000}
                  step={1}
                  required
                  bind:value={draft.pixelSize}
                />
              </Field.Field>
            </div>
            <Field.Description>
              글자 폭 {draft.width * draft.pixelSize} · 어센더 {draft.baseline * draft.pixelSize} · 디센더 {(draft.baseline -
                draft.height) *
                draft.pixelSize} 유닛. 공통 pixel 컴포넌트와 픽셀 크기의 그리드로 내보냅니다.
            </Field.Description>
            <Field.Description>
              HEX는 높이를 16·24·32·64px 중 다음 크기로, 너비를 8px 단위로 올림하여 빈 픽셀을 채웁니다. 프로젝트 크기는
              유지됩니다.
            </Field.Description>
          </Field.Set>
        </Field.Group>
      </div>
      {#if error}<Field.Error>{error}</Field.Error>{/if}
      {#if hasDraft}<Field.Description>
          설정을 적용하면 현재 편집 중인 픽셀과 베이스라인도 프로젝트에 반영됩니다.
        </Field.Description>{/if}
      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={onClose}>취소</Button>
        <Button type="submit">설정 적용</Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
