import type {FontProject} from './types'

import {resizeBitmap} from './bitmap'
import {normalizeBaseline} from './font-metrics'

export interface FontSettings {
  name: string
  width: number
  height: number
  baseline: number
  styleName: string
  versionMajor: number
  versionMinor: number
  designer: string
  designerURL: string
  manufacturer: string
  manufacturerURL: string
  copyright: string
  license: string
  licenseURL: string
  description: string
  unitsPerEm: number
  pixelSize: number
}

export const MAX_GRID_SIZE = 64
export function normalizeDimension(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(1, Math.min(MAX_GRID_SIZE, Math.round(value)))
    : 16
}

export function getFontSettings(project: FontProject): FontSettings {
  const width = normalizeDimension(project.width)
  const height = normalizeDimension(project.height)
  const info = project.fontInfo || {}
  const integer = (value: unknown, fallback: number, min: number, max: number) =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback
  const text = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback)
  return {
    name: text(project.name, 'My Font'),
    width,
    height,
    baseline: normalizeBaseline(project.baseline, height),
    styleName: text(info.styleName, 'Regular'),
    versionMajor: integer(info.versionMajor, 1, 0, 999),
    versionMinor: integer(info.versionMinor, 0, 0, 999),
    designer: text(info.designer),
    designerURL: text(info.designerURL),
    manufacturer: text(info.manufacturer),
    manufacturerURL: text(info.manufacturerURL),
    copyright: text(info.copyright),
    license: text(info.license),
    licenseURL: text(info.licenseURL),
    description: text(info.description),
    unitsPerEm: integer(info.unitsPerEm, 1000, 16, 16384),
    pixelSize: integer(info.pixelSize, 50, 1, 1000),
  }
}

export function applyFontSettings(project: FontProject, settings: FontSettings): FontProject {
  const {name, width, height, baseline, ...fontInfo} = settings
  return {
    ...project,
    name,
    width,
    height,
    baseline: normalizeBaseline(baseline, height),
    fontInfo,
    components: project.components.map((component) => ({
      ...component,
      bitmap: resizeBitmap(component.bitmap, width, height),
    })),
  }
}

export function countCroppedPixels(project: FontProject, width: number, height: number) {
  let count = 0
  for (const component of project.components) {
    component.bitmap.forEach((row, r) =>
      row.forEach((pixel, c) => {
        if (pixel && (r >= height || c >= width)) count++
      }),
    )
  }
  return count
}
