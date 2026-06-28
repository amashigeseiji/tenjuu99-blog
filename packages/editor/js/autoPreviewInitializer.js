/**
 * @vocab プレビュー自動更新器
 * @test tests/editor/auto-preview.test.js
 */
import { createDebounce } from './debouncer.js'

export function initAutoPreview(textarea, onUpdate, delay = 500) {
  const debouncedUpdate = createDebounce(onUpdate, delay)
  textarea.addEventListener('input', debouncedUpdate)
  return debouncedUpdate
}
