import type {FontProject, GroupsStructure, ComponentType} from '../types'

import {flattenBitmap} from '../bitmap'

interface GenerationResult {
  // 11,172 chars * 32 bytes (16 rows * 2 bytes)
  buffer: ArrayBuffer
}

self.onmessage = (e: MessageEvent<FontProject>) => {
  const project = e.data
  const result = generateFont(project)
  ;(self as unknown as Worker).postMessage(result, [result.buffer]) // Transfer buffer
}

function computeMaskForType(
  targetJamoType: ComponentType,
  compType: ComponentType,
  compTypeIndex: number,
  conditions: Record<string, boolean>,
  projectGroups: GroupsStructure,
): number {
  if (compType === targetJamoType) {
    return 1 << compTypeIndex
  }

  const count = targetJamoType === 'chosung' ? 19 : targetJamoType === 'jungsung' ? 21 : 28
  const groupsForTarget = projectGroups[targetJamoType]

  let mask = 0
  for (let i = 0; i < count; i++) {
    let match = true
    for (const [groupId, expected] of Object.entries(conditions)) {
      const g = groupsForTarget.find((x) => x.id === groupId)
      if (g) {
        if (g.items.includes(i) !== expected) {
          match = false
          break
        }
      }
    }
    if (match) {
      mask |= 1 << i
    }
  }
  return mask
}

function generateFont(project: FontProject): GenerationResult {
  const TOTAL_SYLLABLES = 11172
  const BYTES_PER_CHAR = 32 // 16 rows * 2 bytes
  const buffer = new ArrayBuffer(TOTAL_SYLLABLES * BYTES_PER_CHAR)
  const view = new DataView(buffer)

  const compCount = project.components.length
  const compBitmaps: Uint16Array[] = Array.from({length: compCount})
  const compChoMask: Uint32Array = new Uint32Array(compCount)
  const compJungMask: Uint32Array = new Uint32Array(compCount)
  const compJongMask: Uint32Array = new Uint32Array(compCount)
  const compSpecificity: Uint8Array = new Uint8Array(compCount)
  const componentsByType: Record<ComponentType, number[][]> = {
    chosung: Array.from({length: 19}, () => []),
    jungsung: Array.from({length: 21}, () => []),
    jongsung: Array.from({length: 28}, () => []),
  }

  const groups = project.groups || {chosung: [], jungsung: [], jongsung: []}

  for (let ci = 0; ci < compCount; ci++) {
    const comp = project.components[ci]
    compBitmaps[ci] = flattenBitmap(comp.bitmap)

    compChoMask[ci] = computeMaskForType('chosung', comp.type, comp.typeIndex, comp.conditions || {}, groups)
    compJungMask[ci] = computeMaskForType('jungsung', comp.type, comp.typeIndex, comp.conditions || {}, groups)
    compJongMask[ci] = computeMaskForType('jongsung', comp.type, comp.typeIndex, comp.conditions || {}, groups)
    compSpecificity[ci] = Object.values(comp.conditions || {}).filter(Boolean).length
    componentsByType[comp.type][comp.typeIndex].push(ci)
  }

  const result = new Uint16Array(16)

  for (let i = 0; i < TOTAL_SYLLABLES; i++) {
    const cho = (i / 588) | 0
    const jung = ((i % 588) / 28) | 0
    const jong = i % 28

    const choBit = 1 << cho
    const jungBit = 1 << jung
    const jongBit = 1 << jong

    for (let r = 0; r < 16; r++) result[r] = 0

    const applyBestMatch = (type: ComponentType, typeIndex: number) => {
      let bestIndex = -1
      let bestSpecificity = -1
      for (const ci of componentsByType[type][typeIndex]) {
        if (
          compChoMask[ci] & choBit &&
          compJungMask[ci] & jungBit &&
          compJongMask[ci] & jongBit &&
          compSpecificity[ci] > bestSpecificity
        ) {
          bestIndex = ci
          bestSpecificity = compSpecificity[ci]
        }
      }
      if (bestIndex === -1) return
      const bitmap = compBitmaps[bestIndex]
      for (let r = 0; r < 16; r++) {
        result[r] |= bitmap[r]
      }
    }

    applyBestMatch('chosung', cho)
    applyBestMatch('jungsung', jung)
    if (jong > 0) applyBestMatch('jongsung', jong)

    const offset = i * BYTES_PER_CHAR
    for (let r = 0; r < 16; r++) {
      view.setUint16(offset + r * 2, result[r], false)
    }
  }

  return {buffer}
}
