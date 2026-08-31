import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Debouncer } from './debounce'

describe('Debouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('runs the callback once after the delay elapses', () => {
    const debouncer = new Debouncer()
    const cb = vi.fn()
    debouncer.schedule(cb, 1000)
    vi.advanceTimersByTime(999)
    expect(cb).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('resets the timer when scheduled again before it fires', () => {
    const debouncer = new Debouncer()
    const cb = vi.fn()
    debouncer.schedule(cb, 1000)
    vi.advanceTimersByTime(500)
    debouncer.schedule(cb, 1000)
    vi.advanceTimersByTime(999)
    expect(cb).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('flush runs the pending callback immediately', () => {
    const debouncer = new Debouncer()
    const cb = vi.fn()
    debouncer.schedule(cb, 1000)
    debouncer.flush()
    expect(cb).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1000)
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('flush is a no-op when nothing is pending', () => {
    const debouncer = new Debouncer()
    expect(() => debouncer.flush()).not.toThrow()
  })

  it('cancel prevents the callback from running', () => {
    const debouncer = new Debouncer()
    const cb = vi.fn()
    debouncer.schedule(cb, 1000)
    debouncer.cancel()
    vi.advanceTimersByTime(1000)
    expect(cb).not.toHaveBeenCalled()
  })

  it('isPending reflects whether a timer is scheduled', () => {
    const debouncer = new Debouncer()
    expect(debouncer.isPending).toBe(false)
    debouncer.schedule(() => {}, 1000)
    expect(debouncer.isPending).toBe(true)
    vi.advanceTimersByTime(1000)
    expect(debouncer.isPending).toBe(false)
  })
})
