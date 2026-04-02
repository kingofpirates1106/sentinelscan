const DEFAULT_TIMEOUT_MS = 15_000

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TimeoutError'
  }
}

export async function withTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  label = 'request'
): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await task(controller.signal)
  } catch (error) {
    if ((error as any)?.name === 'AbortError') {
      throw new TimeoutError(`${label} timed out after ${timeoutMs}ms`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

