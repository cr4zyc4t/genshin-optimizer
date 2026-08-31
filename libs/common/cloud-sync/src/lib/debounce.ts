/**
 * A simple restartable debounce timer. Unlike a generic `debounce(fn, ms)` wrapper, this
 * keeps a single pending callback and lets the delay be changed between calls (needed since
 * the user can change `CloudSyncSettings.debounceMs` at runtime).
 */
export class Debouncer {
  private timer: ReturnType<typeof setTimeout> | undefined
  private pending: (() => void) | undefined

  /**
   * (Re)schedule `callback` to run after `delayMs`. Calling this again before the delay
   * elapses cancels the previous timer and restarts it — the standard debounce behavior.
   */
  schedule(callback: () => void, delayMs: number): void {
    this.cancel()
    this.pending = callback
    this.timer = setTimeout(() => {
      this.timer = undefined
      const cb = this.pending
      this.pending = undefined
      cb?.()
    }, delayMs)
  }

  /** Run the pending callback immediately (if any) and cancel the timer. */
  flush(): void {
    const cb = this.pending
    this.cancel()
    cb?.()
  }

  /** Cancel the pending callback without running it. */
  cancel(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer)
      this.timer = undefined
    }
    this.pending = undefined
  }

  get isPending(): boolean {
    return this.timer !== undefined
  }
}
