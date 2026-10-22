import type {PixelComponent} from './types.js'

export type NudgeDirection = 'up' | 'down' | 'left' | 'right'
export const NUDGE_OFFSETS = {up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0]} as const

/** A group move is atomic: no component may lose a filled pixel. */
export function canNudge(components: PixelComponent[], direction: NudgeDirection): boolean {
  let hasPixels = false
  for (const {bitmap} of components) {
    const height = bitmap.length
    const width = bitmap[0]?.length ?? 0
    if (!width || !height) continue
    // Only the departing edge can leave the grid. Stop scanning the interior
    // as soon as we know the project contains at least one filled pixel.
    if (direction === 'up' || direction === 'down') {
      const edge = bitmap[direction === 'up' ? 0 : height - 1]
      for (let x = 0; x < width; x++) if (edge[x]) return false
    } else {
      const x = direction === 'left' ? 0 : width - 1
      for (let y = 0; y < height; y++) if (bitmap[y][x]) return false
    }
    if (!hasPixels) hasPixels = bitmap.some((row) => row.some(Boolean))
  }
  return hasPixels
}

export function nudgeComponents(components: PixelComponent[], direction: NudgeDirection): PixelComponent[] | null {
  if (!canNudge(components, direction)) return null
  const [dx, dy] = NUDGE_OFFSETS[direction]
  return components.map((component) => ({
    ...component,
    bitmap: component.bitmap.map((row, y) => row.map((_, x) => component.bitmap[y - dy]?.[x - dx] ?? 0)),
  }))
}
