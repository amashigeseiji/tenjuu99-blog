import { createDebounce } from './debouncer.js'

/**
 * @vocab 自動保存初期化器
 * @test tests/editor/editor-ui-cleanup.test.js
 * @param {EventTarget} textarea
 * @param {() => void} onSave
 * @param {number} delay
 * @returns {import('./debouncer.js').Debounce}
 */
export function initAutoSave(textarea, onSave, delay = 500) {
  const debouncedSave = createDebounce(onSave, delay)
  textarea.addEventListener('input', debouncedSave)
  return debouncedSave
}
