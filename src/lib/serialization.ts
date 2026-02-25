/**
 * 프로젝트 직렬화/역직렬화 유틸리티
 * bitmap 데이터를 hex 문자열로 변환하여 JSON 크기를 줄입니다.
 */
import type {FontProject} from '$lib/types'

import {bitmapToHex, hexToBitmap} from '$lib/bitmap'

/**
 * FontProject를 JSON-직렬화 가능한 형태로 변환합니다.
 * 2D 배열 bitmap을 hex 문자열로 압축합니다.
 */
export function serializeProject(proj: FontProject): any {
  const clone = structuredClone(proj) as any
  for (const c of clone.components) {
    if (Array.isArray(c.bitmap)) {
      c.bitmap = bitmapToHex(c.bitmap)
    }
  }
  return clone
}

/**
 * JSON에서 읽어온 데이터를 FontProject로 역직렬화합니다.
 * hex 문자열 bitmap을 2D 배열로 복원하고, 레거시 targets 형식을 conditions로 마이그레이션합니다.
 */
export function deserializeProject(data: any): FontProject {
  if (data.components) {
    for (const c of data.components) {
      if (typeof c.bitmap === 'string') {
        c.bitmap = hexToBitmap(c.bitmap)
      }

      // Legacy 'targets' migration to 'conditions' & 'groups'
      if ((c as any).targets && !c.conditions) {
        if (!data.groups) data.groups = {chosung: [], jungsung: [], jongsung: []}
        c.conditions = {}
        const targets = (c as any).targets
        for (const tType of ['chosung', 'jungsung', 'jongsung'] as const) {
          if (tType === c.type) continue
          if (targets[tType] && targets[tType].length > 0) {
            const itemsArr = [...targets[tType]].sort((a: number, b: number) => a - b)
            // Exclude the 'no_jongsung' scenario if it's [0] for jongsung
            if (tType === 'jongsung' && itemsArr.length === 1 && itemsArr[0] === 0) {
              c.conditions['no_jongsung'] = true
            } else {
              const str = itemsArr.join(',')
              let existingPattern = data.groups[tType].find(
                (g: any) => [...g.items].sort((a: number, b: number) => a - b).join(',') === str,
              )
              if (!existingPattern) {
                existingPattern = {
                  id: crypto.randomUUID(),
                  name: `Group ${data.groups[tType].length + 1}`,
                  items: itemsArr,
                }
                data.groups[tType].push(existingPattern)
              }
              c.conditions[existingPattern.id] = true
            }
          }
        }
      }
    }
  }
  return data as FontProject
}
