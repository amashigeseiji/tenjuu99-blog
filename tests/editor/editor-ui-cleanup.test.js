import { describe, it } from 'node:test'
import assert from 'node:assert'
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initAutoSave } from '../../packages/editor/js/autoSaveInitializer.js'
import { saveFile } from '../../packages/editor/server/save.js'

// ルートテスト: ツリーが完成するまで green にしない
// @vocab: エディタ (docs/dictionary.md#エディタ)
describe('エディタは整合した操作フローを提供できる', () => {
  it('テキスト入力が止まった後に保存が実行され整合した操作フローを提供できる', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const dir = mkdtempSync(join(tmpdir(), 'root-test-'))
    try {
      const textarea = new EventTarget()

      initAutoSave(textarea, async () => {
        await saveFile('post/auto.md', '# auto saved', dir)
      }, 300)

      textarea.dispatchEvent(new Event('input'))
      assert.equal(existsSync(join(dir, 'post/auto.md')), false, '入力直後は保存されない')

      t.mock.timers.tick(300)
      assert.ok(existsSync(join(dir, 'post/auto.md')), '入力停止後にファイルが保存される')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  // ── 自動保存器 ──────────────────────────────────────────────────────────────

  // @vocab: 自動保存 (plans/editor-ui-cleanup/dictionary.md#自動保存)
  describe('自動保存器は入力を契機に保存できる', () => {
    // @vocab: 自動保存初期化器 (plans/editor-ui-cleanup/dictionary.md#自動保存初期化器)
    // @test: tests/editor/editor-ui-cleanup.test.js
    describe('自動保存初期化器は入力停止を検知して保存コールバックを呼べる', () => {
      it('textareaへの入力が止まった後、保存コールバックが呼ばれる', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout'] })
        const textarea = new EventTarget()
        const calls = []
        initAutoSave(textarea, () => calls.push(1), 300)

        textarea.dispatchEvent(new Event('input'))
        assert.equal(calls.length, 0, 'debounce前は呼ばれない')

        t.mock.timers.tick(300)
        assert.equal(calls.length, 1, 'debounce後に1回呼ばれる')
      })

      it('入力が連続するとき、最後の入力から一定時間後に1回だけ呼ばれる', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout'] })
        const textarea = new EventTarget()
        const calls = []
        initAutoSave(textarea, () => calls.push(1), 300)

        textarea.dispatchEvent(new Event('input'))
        t.mock.timers.tick(200)
        textarea.dispatchEvent(new Event('input'))
        t.mock.timers.tick(200)
        assert.equal(calls.length, 0, '最後の入力から300ms経過していない')

        t.mock.timers.tick(100)
        assert.equal(calls.length, 1, '最後の入力から300ms後に1回呼ばれる')
      })
    })

    // @vocab: 保存エンドポイント (plans/editor-ui-cleanup/dictionary.md#保存エンドポイント)
    // @test: tests/editor/editor-ui-cleanup.test.js
    describe('保存エンドポイントはリダイレクトなしにファイルを保存できる', () => {
      it('ファイル名と内容を受け取ってファイルを保存し success を返す', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'save-test-'))
        try {
          const result = await saveFile('post/hello.md', '# Hello', dir)
          assert.deepStrictEqual(result, { success: true })
          assert.equal(readFileSync(join(dir, 'post/hello.md'), 'utf-8'), '# Hello')
        } finally {
          rmSync(dir, { recursive: true, force: true })
        }
      })

      it('サブディレクトリが存在しない場合は作成してから保存する', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'save-test-'))
        try {
          await saveFile('book/new/file.md', 'content', dir)
          assert.ok(existsSync(join(dir, 'book/new/file.md')))
        } finally {
          rmSync(dir, { recursive: true, force: true })
        }
      })
    })
  })

  // ── 新規作成器 ──────────────────────────────────────────────────────────────

  // @vocab: 新規作成 (plans/editor-ui-cleanup/dictionary.md#新規作成)
  describe('新規作成器はファイルを新規作成できる', () => {
    // @vocab: 新規作成UI (plans/editor-ui-cleanup/dictionary.md#新規作成UI)
    describe('新規作成UIはファイル名とテンプレートを受け付けられる', () => {
      it('手動確認のみ（ブラウザUI）', { skip: true }, () => {})
    })

    // @vocab: 保存エンドポイント (plans/editor-ui-cleanup/dictionary.md#保存エンドポイント)
    // 共有ノード: 自動保存器と同じ saveFile を利用する（テストは自動保存器側に集約）
    describe('保存エンドポイントはリダイレクトなしにファイルを保存できる', () => {
      it('新規ファイルを作成して未公開状態で保存する（saveFile を利用）', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'save-test-'))
        try {
          const result = await saveFile('book/my-new-book.md', '---\ntitle: My Book\n---\n', dir)
          assert.deepStrictEqual(result, { success: true })
          assert.ok(existsSync(join(dir, 'book/my-new-book.md')))
        } finally {
          rmSync(dir, { recursive: true, force: true })
        }
      })
    })
  })
})
