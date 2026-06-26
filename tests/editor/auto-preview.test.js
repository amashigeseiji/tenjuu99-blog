import { describe, it } from 'node:test'
import assert from 'node:assert'
import { initAutoPreview } from '../../packages/editor/js/autoPreviewInitializer.js'
import { createDebounce } from '../../packages/editor/js/debouncer.js'

// ルートテスト: ツリーが完成するまで green にしない
// @vocab: プレビュー自動更新器 (plans/editor-realtime-preview/dictionary.md#プレビュー自動更新器)
describe('プレビュー自動更新器 は 入力イベントと画像挿入を検知してプレビューを自動更新できる', () => {
  it('textareaへの入力が止まった後、プレビューが自動更新される', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const textarea = new EventTarget()
    const calls = []
    initAutoPreview(textarea, () => calls.push(1), 300)

    textarea.dispatchEvent(new Event('input'))
    assert.equal(calls.length, 0, 'debounce前は呼ばれない')

    t.mock.timers.tick(300)
    assert.equal(calls.length, 1, 'debounce後に1回呼ばれる')
  })
})

// ─── デバウンサー ───────────────────────────────────────────────

// @vocab: デバウンサー (plans/editor-realtime-preview/dictionary.md#デバウンサー)
// @test: tests/editor/auto-preview.test.js
describe('デバウンサー は 連続呼び出しのうち最後から一定時間後のみ処理を実行できる', () => {
  // @vocab: 遅延実行 (plans/editor-realtime-preview/dictionary.md#デバウンサー)
  describe('遅延実行 は 指定時間後にコールバックを実行できる', () => {
    it('指定時間前は実行されず、指定時間後に1回だけ実行される', (t) => {
      t.mock.timers.enable({ apis: ['setTimeout'] })
      const calls = []
      const debounced = createDebounce(() => calls.push(1), 200)
      debounced()
      assert.equal(calls.length, 0, '呼び出し直後は実行されない')
      t.mock.timers.tick(199)
      assert.equal(calls.length, 0, '199ms後はまだ実行されない')
      t.mock.timers.tick(1)
      assert.equal(calls.length, 1, '200ms後に1回実行される')
    })
  })

  // @vocab: タイマーリセット (plans/editor-realtime-preview/dictionary.md#デバウンサー)
  describe('タイマーリセット は 遅延中に再呼び出されたとき前のタイマーをキャンセルできる', () => {
    it('連続呼び出しでは最後の呼び出しから計測した時間後にのみ実行される', (t) => {
      t.mock.timers.enable({ apis: ['setTimeout'] })
      const calls = []
      const debounced = createDebounce(() => calls.push(1), 200)
      debounced()
      t.mock.timers.tick(150)
      debounced()
      t.mock.timers.tick(150)
      assert.equal(calls.length, 0, '最初の呼び出しから300ms後だがリセットされている')
      t.mock.timers.tick(50)
      assert.equal(calls.length, 1, '2回目の呼び出しから200ms後に実行される')
    })
  })

  describe('キャンセル は 遅延中の実行を取り消せる', () => {
    it('cancel後は指定時間が経過してもコールバックが実行されない', (t) => {
      t.mock.timers.enable({ apis: ['setTimeout'] })
      const calls = []
      const debounced = createDebounce(() => calls.push(1), 200)
      debounced()
      debounced.cancel()
      t.mock.timers.tick(200)
      assert.equal(calls.length, 0, 'キャンセル後はコールバックが呼ばれない')
    })
  })
})

// ─── 自動プレビュー初期化器 ───────────────────────────────────────

// @vocab: 自動プレビュー初期化器 (plans/editor-realtime-preview/dictionary.md#プレビュー自動更新器)
// @test: tests/editor/auto-preview.test.js
describe('自動プレビュー初期化器 は textareaの入力イベントにデバウンサーを接続できる', () => {
  it('textareaにinputイベントが発生するとデバウンス後にonUpdateが呼ばれる', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const textarea = new EventTarget()
    const calls = []
    initAutoPreview(textarea, () => calls.push(1), 300)

    textarea.dispatchEvent(new Event('input'))
    assert.equal(calls.length, 0, 'input直後はまだ呼ばれない')
    t.mock.timers.tick(300)
    assert.equal(calls.length, 1, '300ms後に呼ばれる')
  })

  describe('ドロップ後更新 は 画像挿入後にプレビュー更新コールバックを呼び出せる', () => {
    // drag/drop イベントはブラウザ依存 — 手動確認のみ
    it.skip('手動確認のみ: 画像ドロップ後にプレビューが即時更新される')
  })
})
