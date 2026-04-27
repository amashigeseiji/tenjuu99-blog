import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'

// ========================================
// TC-01, TC-02, TC-03: helper.js の修正確認
// ========================================

test('TC-01: helper の default export はオブジェクトである（top-level await なし）', async () => {
  // TODO: /tdd-run で実装
  throw new Error('Not implemented')
})

test('TC-02: helperReady は Promise としてエクスポートされる', async () => {
  // TODO: /tdd-run で実装
  throw new Error('Not implemented')
})

test('TC-03: await helperReady 後に helper にヘルパー関数が設定されている', async () => {
  // TODO: /tdd-run で実装
  throw new Error('Not implemented')
})

// ========================================
// TC-04, TC-05: render.js の修正確認
// ========================================

test('TC-04: render() はヘルパー関数呼び出しを含むテンプレートを処理できる', async () => {
  // TODO: /tdd-run で実装
  throw new Error('Not implemented')
})

test('TC-05: render.js のソースに helperReady が含まれている', () => {
  // TODO: /tdd-run で実装
  throw new Error('Not implemented')
})
