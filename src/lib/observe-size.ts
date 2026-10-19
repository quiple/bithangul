import {createAttachmentKey} from 'svelte/attachments'

/** Measure an Astryx scroll region without an extra layout wrapper. */
export function observeSize(update: (element: HTMLElement) => void) {
  return {
    [createAttachmentKey()]: (element: HTMLElement) => {
      update(element)
      const observer = new ResizeObserver(() => update(element))
      observer.observe(element)
      return () => observer.disconnect()
    },
  }
}
