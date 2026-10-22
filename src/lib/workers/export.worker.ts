import type {FontExportType} from '../font-export'
import type {FontSettings} from '../font-settings'

import {exportBDF, exportHEX, exportGlyphs} from '../font-export'

self.onmessage = (e: MessageEvent<{type: FontExportType; buffer: ArrayBuffer; settings: FontSettings}>) => {
  const {type, buffer, settings} = e.data
  try {
    const exporters = {bdf: exportBDF, hex: exportHEX, glyphs: exportGlyphs}
    const result = exporters[type](buffer, settings)
    ;(self as unknown as Worker).postMessage({type, blob: new Blob([result], {type: 'text/plain;charset=utf-8'})})
  } catch (error) {
    ;(self as unknown as Worker).postMessage({type, error: error instanceof Error ? error.message : String(error)})
  }
}
