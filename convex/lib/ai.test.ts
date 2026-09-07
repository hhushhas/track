import { describe, expect, it } from 'vitest'

import {
  assistantProviderTimeoutMs,
  documentReaderProviderTimeoutMs,
  providerTimeoutMessage,
} from './ai'

describe('AI provider bounds', () => {
  it('keeps assistant and document reader waits finite and actionable', () => {
    expect(assistantProviderTimeoutMs).toBeGreaterThan(documentReaderProviderTimeoutMs)
    expect(providerTimeoutMessage('track-model', assistantProviderTimeoutMs)).toContain('Please try again')
  })
})
