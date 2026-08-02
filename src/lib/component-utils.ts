import type {PixelComponent} from '$lib/types'

export function getActiveVariationId(component: Pick<PixelComponent, 'conditions'>) {
  return Object.keys(component.conditions || {}).find((groupId) => component.conditions[groupId])
}

export function getConditionKey(conditions: Record<string, boolean>) {
  return Object.keys(conditions || {})
    .filter((groupId) => conditions[groupId])
    .sort()
    .join(',')
}

export function getComponentKey(component: Pick<PixelComponent, 'type' | 'typeIndex' | 'conditions'>) {
  return `${component.type}:${component.typeIndex}:${getConditionKey(component.conditions)}`
}
