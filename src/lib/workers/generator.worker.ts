import type {FontProject} from '../types'

import {generateFont} from '../font-generator'

self.onmessage = (event: MessageEvent<FontProject>) => {
  const result = generateFont(event.data)
  ;(self as unknown as Worker).postMessage(result, [result.buffer])
}
