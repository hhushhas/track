import { describe, expect, it, vi } from 'vitest';

import { OperationTimeoutError, withOperationTimeout } from './promise-timeout';

describe('withOperationTimeout', () => {
  it('returns a result completed within the deadline', async () => {
    await expect(withOperationTimeout(Promise.resolve('done'), 100, 'sign_out')).resolves.toBe('done');
  });

  it('rejects a stalled operation with a stable internal reason', async () => {
    vi.useFakeTimers();
    try {
      const result = withOperationTimeout(new Promise<never>(() => undefined), 100, 'sign_out');
      const assertion = expect(result).rejects.toEqual(new OperationTimeoutError('sign_out'));
      await vi.advanceTimersByTimeAsync(100);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
