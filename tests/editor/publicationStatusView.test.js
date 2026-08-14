import { describe, it } from 'node:test'
import assert from 'node:assert'
import { createPublicationStatusView } from '../../packages/editor/js/publicationStatusView.js'

const makeFakeElements = ({ syncLinkStatus } = {}) => ({
  statusEl: { textContent: 'x', dataset: {} },
  publishBtn: { disabled: false, title: '' },
  unpublishBtn: { hidden: false, disabled: false },
  deleteBtn: { hidden: false },
  syncLinkStatus,
})

describe('公開ステータス表示器 は 記事の公開ステータスを取得し、ラベルと操作の可否に反映できる', () => {
  it('公開済みの記事ではラベルが表示され、公開は不可・非公開は可・削除は隠れる', async () => {
    const synced = []
    const els = makeFakeElements({ syncLinkStatus: (path, status) => synced.push([path, status]) })
    const fetchFn = async () => ({ ok: true, json: async () => ({ status: 'published' }) })
    const view = createPublicationStatusView(els, fetchFn)
    await view.refresh('post/a.md')
    assert.strictEqual(els.statusEl.textContent, '(公開済み)')
    assert.strictEqual(els.statusEl.dataset.status, 'published')
    assert.strictEqual(els.publishBtn.disabled, true)
    assert.strictEqual(els.unpublishBtn.hidden, false)
    assert.strictEqual(els.unpublishBtn.disabled, false)
    assert.strictEqual(els.deleteBtn.hidden, true)
    // サイドバーリンクの data-status の同期が依頼される
    assert.deepStrictEqual(synced, [['post/a.md', 'published']])
  })

  it('未公開（new）の記事では公開・削除が可になり、非公開が隠れる', async () => {
    const els = makeFakeElements()
    const fetchFn = async () => ({ ok: true, json: async () => ({ status: 'new' }) })
    const view = createPublicationStatusView(els, fetchFn)
    await view.refresh('post/a.md')
    assert.strictEqual(els.publishBtn.disabled, false)
    assert.strictEqual(els.deleteBtn.hidden, false)
    assert.strictEqual(els.unpublishBtn.hidden, true)
  })

  it('ステータスが取得できないときは参照不能（unknown）として公開ボタンを無効化する', async () => {
    const els = makeFakeElements()
    const view = createPublicationStatusView(els, async () => { throw new Error('down') })
    await view.refresh('post/a.md')
    assert.strictEqual(els.statusEl.textContent, '状態不明（公開不可）')
    assert.strictEqual(els.statusEl.dataset.status, 'unknown')
    assert.strictEqual(els.publishBtn.disabled, true)
    assert.strictEqual(els.publishBtn.title, '状態不明（公開不可）')
  })

  it('ファイル未指定・表示先なしでは何もしない', async () => {
    const view = createPublicationStatusView({ statusEl: null },
      async () => { throw new Error('called') })
    await view.refresh('')
    await view.refresh('post/a.md')
  })
})
