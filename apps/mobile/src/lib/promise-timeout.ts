export class OperationTimeoutError extends Error {
  constructor(operation: string) {
    super(`${operation}_timed_out`);
    this.name = 'OperationTimeoutError';
  }
}

/** Bounds network-dependent account operations without swallowing late cleanup. */
export function withOperationTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new OperationTimeoutError(operation)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (failure) => {
        clearTimeout(timeout);
        reject(failure);
      },
    );
  });
}
