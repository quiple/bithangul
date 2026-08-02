import type {ComponentType, FontProject, JamoGroup} from '../types'

import {flattenBitmap} from '../bitmap'
import {getActiveVariationId} from '../component-utils'
import {
  CHOSUNG_COUNT,
  COMPONENT_TYPES,
  SYLLABLES_PER_CHOSUNG,
  HANGUL_SYLLABLE_COUNT,
  JUNGSUNG_COUNT,
  JONGSUNG_COUNT,
  TYPE_COUNTS,
} from '../hangul'

interface GenerationResult {
  // 11,172 chars * 32 bytes (16 rows * 2 bytes)
  buffer: ArrayBuffer
}

interface CompiledVariation {
  choMask: number
  jungMask: number
  jongMask: number
  coverage: number
}

type ComponentTable = Record<ComponentType, Int32Array[]>

self.onmessage = (event: MessageEvent<FontProject>) => {
  const result = generateFont(event.data)
  ;(self as unknown as Worker).postMessage(result, [result.buffer])
}

function createMask(items: number[] | undefined, count: number) {
  if (!items) return (1 << count) - 1
  let mask = 0
  for (const item of items) mask |= 1 << item
  return mask
}

function compileVariation(type: ComponentType, group: JamoGroup): CompiledVariation {
  let coverage = 1
  for (const conditionType of COMPONENT_TYPES) {
    if (conditionType !== type) coverage *= group.conditions[conditionType]?.length ?? TYPE_COUNTS[conditionType]
  }

  return {
    choMask: createMask(group.conditions.chosung, CHOSUNG_COUNT),
    jungMask: createMask(group.conditions.jungsung, JUNGSUNG_COUNT),
    jongMask: createMask(group.conditions.jongsung, JONGSUNG_COUNT),
    coverage,
  }
}

function createBestVariationTables(project: FontProject) {
  const tables = {
    chosung: new Int32Array(JUNGSUNG_COUNT * JONGSUNG_COUNT),
    jungsung: new Int32Array(CHOSUNG_COUNT * JONGSUNG_COUNT),
    jongsung: new Int32Array(CHOSUNG_COUNT * JUNGSUNG_COUNT),
  }
  for (const type of COMPONENT_TYPES) tables[type].fill(-1)

  const compiled = {
    chosung: project.groups.chosung.map((group) => compileVariation('chosung', group)),
    jungsung: project.groups.jungsung.map((group) => compileVariation('jungsung', group)),
    jongsung: project.groups.jongsung.map((group) => compileVariation('jongsung', group)),
  }

  for (let jung = 0; jung < JUNGSUNG_COUNT; jung++) {
    const jungBit = 1 << jung
    for (let jong = 0; jong < JONGSUNG_COUNT; jong++) {
      const jongBit = 1 << jong
      let bestCoverage = Number.MAX_SAFE_INTEGER
      for (let index = 0; index < compiled.chosung.length; index++) {
        const variation = compiled.chosung[index]
        if (variation.jungMask & jungBit && variation.jongMask & jongBit && variation.coverage < bestCoverage) {
          tables.chosung[jung * JONGSUNG_COUNT + jong] = index
          bestCoverage = variation.coverage
        }
      }
    }
  }

  for (let cho = 0; cho < CHOSUNG_COUNT; cho++) {
    const choBit = 1 << cho
    for (let jong = 0; jong < JONGSUNG_COUNT; jong++) {
      const jongBit = 1 << jong
      let bestCoverage = Number.MAX_SAFE_INTEGER
      for (let index = 0; index < compiled.jungsung.length; index++) {
        const variation = compiled.jungsung[index]
        if (variation.choMask & choBit && variation.jongMask & jongBit && variation.coverage < bestCoverage) {
          tables.jungsung[cho * JONGSUNG_COUNT + jong] = index
          bestCoverage = variation.coverage
        }
      }
    }
  }

  for (let cho = 0; cho < CHOSUNG_COUNT; cho++) {
    const choBit = 1 << cho
    for (let jung = 0; jung < JUNGSUNG_COUNT; jung++) {
      const jungBit = 1 << jung
      let bestCoverage = Number.MAX_SAFE_INTEGER
      for (let index = 0; index < compiled.jongsung.length; index++) {
        const variation = compiled.jongsung[index]
        if (variation.choMask & choBit && variation.jungMask & jungBit && variation.coverage < bestCoverage) {
          tables.jongsung[cho * JUNGSUNG_COUNT + jung] = index
          bestCoverage = variation.coverage
        }
      }
    }
  }

  return tables
}

function createComponentTable(project: FontProject) {
  const table = {} as ComponentTable
  const groupIndices = {} as Record<ComponentType, Map<string, number>>

  for (const type of COMPONENT_TYPES) {
    groupIndices[type] = new Map(project.groups[type].map((group, index) => [group.id, index]))
    table[type] = Array.from({length: TYPE_COUNTS[type]}, () => {
      const row = new Int32Array(project.groups[type].length)
      row.fill(-1)
      return row
    })
  }

  for (let componentIndex = 0; componentIndex < project.components.length; componentIndex++) {
    const component = project.components[componentIndex]
    const groupId = getActiveVariationId(component)
    const groupIndex = groupId ? groupIndices[component.type].get(groupId) : undefined
    const row = table[component.type][component.typeIndex]
    if (row && groupIndex !== undefined) row[groupIndex] = componentIndex
  }

  return table
}

function applyComponent(result: Uint16Array, bitmap: Uint16Array | undefined) {
  if (!bitmap) return
  for (let row = 0; row < 16; row++) result[row] |= bitmap[row]
}

function generateFont(project: FontProject): GenerationResult {
  const BYTES_PER_CHAR = 32
  const buffer = new ArrayBuffer(HANGUL_SYLLABLE_COUNT * BYTES_PER_CHAR)
  const view = new DataView(buffer)
  const bitmaps = project.components.map((component) => flattenBitmap(component.bitmap))
  const componentTable = createComponentTable(project)
  const bestVariation = createBestVariationTables(project)
  const result = new Uint16Array(16)

  for (let index = 0; index < HANGUL_SYLLABLE_COUNT; index++) {
    const cho = (index / SYLLABLES_PER_CHOSUNG) | 0
    const jung = ((index % SYLLABLES_PER_CHOSUNG) / JONGSUNG_COUNT) | 0
    const jong = index % JONGSUNG_COUNT

    result.fill(0)

    const choVariation = bestVariation.chosung[jung * JONGSUNG_COUNT + jong]
    const jungVariation = bestVariation.jungsung[cho * JONGSUNG_COUNT + jong]
    const jongVariation = bestVariation.jongsung[cho * JUNGSUNG_COUNT + jung]

    if (choVariation >= 0) applyComponent(result, bitmaps[componentTable.chosung[cho][choVariation]])
    if (jungVariation >= 0) applyComponent(result, bitmaps[componentTable.jungsung[jung][jungVariation]])
    if (jong > 0 && jongVariation >= 0) {
      applyComponent(result, bitmaps[componentTable.jongsung[jong][jongVariation]])
    }

    const offset = index * BYTES_PER_CHAR
    for (let row = 0; row < 16; row++) view.setUint16(offset + row * 2, result[row], false)
  }

  return {buffer}
}
