import type {ComponentType, JamoGroup} from '$lib/types'

import {COMPONENT_TYPES, COMPONENT_TYPE_LABELS, JAMO_BY_TYPE, getJamoLabel} from '$lib/hangul'

export function getVariationGroupName(type: ComponentType, conditions: JamoGroup['conditions']) {
  const parts: string[] = []

  for (const conditionType of COMPONENT_TYPES) {
    const items = conditions[conditionType]
    if (conditionType === type || !items || items.length === JAMO_BY_TYPE[conditionType].length) continue

    const labels = items.map((index) => getJamoLabel(conditionType, index, '없음')).join('')
    parts.push(conditionType === 'jongsung' ? `받침 ${labels}` : labels)
  }

  return parts.join(' · ') || `기본 ${COMPONENT_TYPE_LABELS[type]}`
}
