import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {test} from 'node:test'

import type {FontProject} from '../src/lib/types.ts'

import {
  bitmapToHex,
  hexToBitmap,
  createEmptyBitmap,
  flattenBitmap,
  bytesPerRow,
  packedPixel,
} from '../src/lib/bitmap.ts'
import {exportBDF, exportHEX, exportGlyphs, getHEXDimensions} from '../src/lib/font-export.ts'
import {generateFont} from '../src/lib/font-generator.ts'
import {getFontSettings, applyFontSettings, countCroppedPixels} from '../src/lib/font-settings.ts'
import {serializeProject, deserializeProject} from '../src/lib/serialization.ts'

function fixture(width = 16, height = 16): FontProject {
  const bitmap = createEmptyBitmap(width, height)
  bitmap[0][0] = 1
  bitmap[height - 1][width - 1] = 1
  return {
    name: 'Test Font',
    width,
    height,
    baseline: height - 2,
    groupModelVersion: 2,
    groups: {chosung: [{id: 'cho', name: '기본 초성', conditions: {}}], jungsung: [], jongsung: []},
    components: [{id: 'c', type: 'chosung', typeIndex: 0, conditions: {cho: true}, bitmap}],
  }
}

test('byte-aligned storage preserves pixels across 8/16/32-bit boundaries and rectangular grids', () => {
  for (const [width, height] of [
    [1, 1],
    [8, 16],
    [13, 19],
    [16, 16],
    [17, 24],
    [33, 18],
    [64, 64],
  ]) {
    const bitmap = createEmptyBitmap(width, height)
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) bitmap[y][x] = +(x === width - 1 || (x + y) % 3 === 0)
    assert.deepEqual(hexToBitmap(bitmapToHex(bitmap), width, height), bitmap)
    assert.equal(flattenBitmap(bitmap).length, bytesPerRow(width) * height)
  }
})

test('legacy example opens at 16×16 with baseline 14 and unchanged bitmap bytes', () => {
  const source = JSON.parse(readFileSync(new URL('../src/lib/assets/Dunggeunmo.json', import.meta.url), 'utf8'))
  const original = new Map(source.components.map((c) => [c.id, c.bitmap]))
  const loaded = deserializeProject(source)
  const settings = getFontSettings(loaded)
  assert.equal(settings.name, '둥근모꼴')
  assert.equal(settings.designer, '김중태')
  assert.equal(settings.designerURL, 'https://ith.kr')
  assert.equal(settings.manufacturer, 'quiple')
  assert.equal(settings.manufacturerURL, 'https://quiple.dev')
  assert.equal(settings.license, 'Public domain')
  assert.deepEqual(getFontSettings(deserializeProject(serializeProject(loaded))), settings)
  assert.equal(settings.baseline, 14)
  assert.equal(getFontSettings(loaded).width, 16)
  for (const c of loaded.components) assert.equal(bitmapToHex(c.bitmap), original.get(c.id))
})

test('resize preserves top-left pixels, counts cropping and round-trips font metadata', () => {
  const project = fixture(17, 24)
  const settings = {
    ...getFontSettings(project),
    width: 33,
    height: 32,
    baseline: 25,
    name: '테스트 "Font"',
    designer: 'A\\B',
    license: 'Line 1\nLine 2',
    pixelSize: 40,
  }
  const grown = applyFontSettings(project, settings)
  assert.equal(grown.components[0].bitmap[23][16], 1)
  assert.equal(grown.components[0].bitmap[31][32], 0)
  assert.equal(countCroppedPixels(grown, 16, 16), 1)
  const roundTrip = deserializeProject(serializeProject(grown))
  assert.deepEqual(getFontSettings(roundTrip), settings)
  assert.deepEqual(roundTrip.components[0].bitmap, grown.components[0].bitmap)
  const shrunk = applyFontSettings(grown, {...settings, width: 8, height: 8})
  assert.equal(shrunk.baseline, 8)
  assert.equal(shrunk.components[0].bitmap[0][0], 1)
  assert.equal(project.width, 17)
})

test('generation and BDF preserve rightmost pixels beyond column 32 and baseline metrics', () => {
  const project = fixture(33, 18)
  const settings = getFontSettings(project)
  const {buffer} = generateFont(project)
  const bytes = new Uint8Array(buffer)
  assert.equal(buffer.byteLength, 11172 * 5 * 18)
  assert.ok(packedPixel(bytes, 33, 0, 0))
  assert.ok(packedPixel(bytes, 33, 17, 32))
  assert.ok(!packedPixel(bytes, 33, 0, 1))
  const bdf = exportBDF(buffer, settings)
  assert.match(bdf, /FONTBOUNDINGBOX 33 18 0 -2/)
  assert.match(bdf, /FONT_ASCENT 16\nFONT_DESCENT 2/)
  assert.match(bdf, /DWIDTH 33 0\nBBX 33 18 0 -2/)
  const bitmap = bdf.split('BITMAP\n')[1].split('\nENDCHAR')[0].split('\n')
  assert.equal(bitmap.length, 18)
  assert.equal(bitmap[0], '8000000000')
  assert.equal(bitmap[17], '0000000080')
})

test('8×16 and 16×16 HEX remain compatible', () => {
  for (const width of [8, 16]) {
    const project = fixture(width, 16)
    const output = exportHEX(generateFont(project).buffer, getFontSettings(project))
    assert.equal(output.split('\n').length, 11172)
    assert.equal(output.split('\n')[0], `AC00:${bitmapToHex(project.components[0].bitmap).toUpperCase()}`)
  }
})

test('Glyphs pixel references, Unicode values and scaled baseline/metadata are exported', () => {
  const project = fixture(17, 24)
  const settings = {
    ...getFontSettings(project),
    baseline: 20,
    designer: '테스트 디자이너',
    copyright: 'Copyright "test"',
    license: 'one\ntwo',
  }
  const output = exportGlyphs(generateFont(project).buffer, settings)
  assert.match(output, /\.formatVersion = 3/)
  assert.match(output, /unicode = 44032/)
  assert.match(output, /ref = pixel/)
  assert.match(output, /pos = \(0,950\)/)
  assert.match(output, /pos = \(800,-200\)/)
  assert.match(output, /key = designers/)
  assert.match(output, /gridLength = 50/)
  assert.match(output, /width = 850/)
  assert.match(output, /Copyright \\"test\\"/)
})

test('HEX pads height upward and byte-aligns width without cropping or changing the project', () => {
  for (const [width, height, outputHeight] of [
    [1, 1, 16],
    [13, 15, 16],
    [17, 17, 24],
    [33, 24, 24],
    [31, 25, 32],
    [64, 33, 64],
    [63, 64, 64],
  ]) {
    const project = fixture(width, height)
    const before = serializeProject(project)
    const settings = getFontSettings(project)
    const dimensions = getHEXDimensions(settings)
    assert.deepEqual(dimensions, {width: Math.ceil(width / 8) * 8, height: outputHeight})
    const output = exportHEX(generateFont(project).buffer, settings)
    const first = output.split('\n')[0].split(':')[1]
    const decoded = hexToBitmap(first, dimensions.width, dimensions.height)
    assert.equal(decoded[0][0], 1)
    assert.equal(decoded[height - 1][width - 1], 1)
    assert.equal(
      decoded.flat().reduce((sum, pixel) => sum + pixel, 0),
      width * height === 1 ? 1 : 2,
    )
    assert.equal(first.length, (dimensions.width / 8) * outputHeight * 2)
    assert.deepEqual(serializeProject(project), before)
  }
})

test('example export matches the file verified in Glyphs 3.5.1', () => {
  const project = deserializeProject(
    JSON.parse(readFileSync(new URL('../src/lib/assets/Dunggeunmo.json', import.meta.url), 'utf8')),
  )
  // Keep the metadata of the file verified in Glyphs fixed while example credits evolve.
  const settings = getFontSettings({...project, name: 'Dunggeunmo', fontInfo: undefined})
  const output = exportGlyphs(generateFont(project).buffer, settings)
  assert.ok(output.startsWith('{\n.appVersion = "3335";\n.formatVersion = 3;\naxes = ('))
  assert.match(output, /nodes = \(\n\(0,0,l\),/)
  assert.doesNotMatch(output, /"\.formatVersion"/)
  assert.equal(
    createHash('sha256').update(output).digest('hex'),
    'a36853e936950d791f0663ab964f1ccf79255285b503af03781b05cd771b99e1',
  )
})
