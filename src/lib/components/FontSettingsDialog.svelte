<script lang="ts">
  import {
    Button,
    Dialog,
    DialogHeader,
    HStack,
    FormLayout,
    Grid,
    VStack,
    Heading,
    Text,
    TextInput,
    TextArea,
    NumberInput,
    CheckboxInput,
  } from '@astryx-svelte/core'
  import {untrack} from 'svelte'

  import type {FontSettings} from '#lib/font-settings.js'
  import type {FontProject} from '#lib/types.js'

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

<Dialog isOpen onOpenChange={(open) => !open && onClose()} purpose="form" width={672}>
  <DialogHeader
    title="폰트 설정"
    subtitle="폰트 정보, 픽셀 크기와 내보내기 메트릭을 설정합니다."
    onOpenChange={(open) => !open && onClose()}
  />
  <VStack padding={4} isScrollable class="min-h-0">
    <form id="font-settings" onsubmit={submit}>
      <FormLayout>
        <VStack gap={4} as="section" aria-labelledby="font-info-heading">
          <Heading level={3} id="font-info-heading">폰트 정보</Heading>
          <Grid columns={{minWidth: 240, max: 2}} gap={4}>
            <TextInput
              label="폰트명 (패밀리)"
              htmlName="name"
              value={draft.name}
              onChange={(value) => (draft.name = value)}
              isRequired
            />
            <TextInput
              label="스타일명"
              htmlName="styleName"
              value={draft.styleName}
              onChange={(value) => (draft.styleName = value)}
              isRequired
            />
            <NumberInput
              label="버전 · 주 번호"
              value={draft.versionMajor}
              onChange={(value) => (draft.versionMajor = value)}
              min={0}
              max={999}
              isIntegerOnly
              isRequired
              isWheelEnabled={false}
            />
            <NumberInput
              label="버전 · 부 번호"
              value={draft.versionMinor}
              onChange={(value) => (draft.versionMinor = value)}
              min={0}
              max={999}
              isIntegerOnly
              isRequired
              isWheelEnabled={false}
            />
          </Grid>
          <TextArea
            label="설명"
            htmlName="description"
            value={draft.description}
            onChange={(value) => (draft.description = value)}
            rows={2}
          />
        </VStack>
        <VStack gap={4} as="section" aria-labelledby="font-credits-heading">
          <Heading level={3} id="font-credits-heading">디자이너 · 제작사</Heading>
          <Grid columns={{minWidth: 240, max: 2}} gap={4}>
            {#each identityFields as field}
              <TextInput
                label={field.label}
                htmlName={field.key}
                value={draft[field.key]}
                onChange={(value) => (draft[field.key] = value)}
              />
            {/each}
          </Grid>
        </VStack>
        <VStack gap={4} as="section" aria-labelledby="font-license-heading">
          <Heading level={3} id="font-license-heading">저작권 · 라이선스</Heading>
          <TextArea
            label="저작권 표시"
            htmlName="copyright"
            value={draft.copyright}
            onChange={(value) => (draft.copyright = value)}
            rows={2}
          />
          <TextArea
            label="라이선스 내용"
            htmlName="license"
            value={draft.license}
            onChange={(value) => (draft.license = value)}
          />
          <TextInput
            label="라이선스 URL"
            htmlName="licenseURL"
            value={draft.licenseURL}
            onChange={(value) => (draft.licenseURL = value)}
          />
        </VStack>
        <VStack gap={4} as="section" aria-labelledby="font-grid-heading">
          <Heading level={3} id="font-grid-heading">픽셀 그리드 · 메트릭</Heading>
          <Grid columns={{minWidth: 240, max: 2}} gap={4}>
            <NumberInput
              label="너비 (px)"
              value={draft.width}
              onChange={(value) => (draft.width = value)}
              min={1}
              max={MAX_GRID_SIZE}
              isIntegerOnly
              isRequired
              hasNumberSteppers
              isWheelEnabled={false}
            />
            <NumberInput
              label="높이 (px)"
              value={draft.height}
              onChange={(value) => {
                draft.height = value
                draft.baseline = Math.min(draft.baseline, value)
              }}
              min={1}
              max={MAX_GRID_SIZE}
              isIntegerOnly
              isRequired
              hasNumberSteppers
              isWheelEnabled={false}
            />
            <NumberInput
              label="베이스라인 (위에서 px)"
              value={draft.baseline}
              onChange={(value) => (draft.baseline = value)}
              min={0}
              max={draft.height}
              isIntegerOnly
              isRequired
              hasNumberSteppers
              isWheelEnabled={false}
            />
          </Grid>
          <Text type="supporting">1–64px. 기존 그림의 왼쪽 위를 유지하고, 늘어난 영역은 빈 픽셀로 채웁니다.</Text>
          {#if croppedPixels > 0}
            <CheckboxInput
              label="픽셀 삭제를 확인했고 이 크기를 적용합니다."
              description={`크기를 줄이면 범위 밖의 채워진 픽셀 ${croppedPixels.toLocaleString()}개가 삭제됩니다.`}
              value={allowCrop}
              onChange={(value) => (allowCrop = value)}
              isRequired
            />
          {/if}
        </VStack>
        <VStack gap={4} as="section" aria-labelledby="font-glyphs-heading">
          <Heading level={3} id="font-glyphs-heading">Glyphs 내보내기</Heading>
          <Grid columns={{minWidth: 240, max: 2}} gap={4}>
            <NumberInput
              label="UPM (Units per Em)"
              value={draft.unitsPerEm}
              onChange={(value) => (draft.unitsPerEm = value)}
              min={16}
              max={16384}
              isIntegerOnly
              isRequired
              isWheelEnabled={false}
            />
            <NumberInput
              label="1픽셀 크기 (폰트 유닛)"
              value={draft.pixelSize}
              onChange={(value) => (draft.pixelSize = value)}
              min={1}
              max={1000}
              isIntegerOnly
              isRequired
              isWheelEnabled={false}
            />
          </Grid>
          <Text type="supporting"
            >글자 폭 {draft.width * draft.pixelSize} · 어센더 {draft.baseline * draft.pixelSize} · 디센더 {(draft.baseline -
              draft.height) *
              draft.pixelSize} 유닛. 공통 pixel 컴포넌트와 픽셀 크기의 그리드로 내보냅니다.</Text
          >
          <Text type="supporting"
            >HEX는 높이를 16·24·32·64px 중 다음 크기로, 너비를 8px 단위로 올림하여 빈 픽셀을 채웁니다. 프로젝트 크기는
            유지됩니다.</Text
          >
        </VStack>
        {#if error}<Text role="alert" class="text-error">{error}</Text>{/if}
        {#if hasDraft}<Text type="supporting"
            >설정을 적용하면 현재 편집 중인 픽셀과 베이스라인도 프로젝트에 반영됩니다.</Text
          >{/if}
      </FormLayout>
    </form>
  </VStack>
  <HStack padding={4} gap={2} justify="end" class="border-default shrink-0 border-t">
    <Button label="취소" onclick={onClose} />
    <Button label="설정 적용" variant="primary" type="submit" form="font-settings" />
  </HStack>
</Dialog>
