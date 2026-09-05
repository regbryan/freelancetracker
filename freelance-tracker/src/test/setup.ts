import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest globals are off, so RTL's automatic cleanup never registers itself.
afterEach(cleanup)

// jsdom ships no ResizeObserver, and every Radix floating layer (popover, select)
// measures itself with one the moment its content mounts.
if (!('ResizeObserver' in globalThis)) {
  class NoopResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = NoopResizeObserver
}
