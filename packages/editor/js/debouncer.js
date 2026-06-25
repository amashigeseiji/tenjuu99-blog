/**
 * @vocab Debouncer (plans/editor-realtime-preview/dictionary.md#デバウンサー)
 * @test tests/editor/auto-preview.test.js
 */
export function createDebounce(fn, delay) {
  let timer = null
  return function (...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn(...args)
    }, delay)
  }
}
