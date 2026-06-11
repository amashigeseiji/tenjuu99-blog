import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import helper, { helperReady } from '../lib/helper.js'
import render from '../lib/render.js'

// ========================================
// TC-01, TC-02, TC-03: helper.js の修正確認
// ========================================

test('TC-01: helper の default export はオブジェクトである（top-level await なし）', async () => {
  assert.strictEqual(typeof helper, 'object')
  assert.strictEqual(helper instanceof Promise, false)
})

test('TC-02: helperReady は Promise としてエクスポートされる', async () => {
  assert.strictEqual(helperReady instanceof Promise, true)
})

test('TC-03: await helperReady 後に helper にヘルパー関数が設定されている', async () => {
  await helperReady
  assert.strictEqual(typeof helper.additionalHelper, 'function')
})

// ========================================
// TC-04, TC-05: render.js の修正確認
// ========================================

test('TC-04: render() はヘルパー関数呼び出しを含むテンプレートを処理できる', async () => {
  const result = await render(null, {
    markdown: '{{additionalHelper()}}',
    __filetype: 'html'
  })
  assert.strictEqual(result, 'これは追加ヘルパーによって出力されているメッセージです。')
})

test('TC-05: render.js のソースに helperReady が含まれている', () => {
  const source = readFileSync('./lib/render.js', 'utf8')
  assert.ok(source.includes('helperReady'))
})
