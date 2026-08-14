import { describe, it } from 'node:test'
import assert from 'node:assert'
import { createPreviewRenderer } from '../../packages/editor/js/previewRenderer.js'

const makeFakePreviewEl = () => {
  let iframe = null
  const makeIframe = () => {
    const attrs = {}
    return { attrs, setAttribute(k, v) { attrs[k] = v } }
  }
  return {
    querySelector: () => iframe,
    appendChild(el) { iframe = el },
    ownerDocument: { createElement: () => makeIframe() },
    get iframe() { return iframe },
  }
}

describe('プレビュー描画器 は 編集中の内容から描画結果を取得してプレビュー領域に反映できる', () => {
  it('初回は sandbox 付き iframe が作られ、描画結果が srcdoc に入る', async () => {
    const previewEl = makeFakePreviewEl()
    let captured
    const fetchFn = async (url, opts) => {
      captured = { url, body: JSON.parse(opts.body) }
      return { ok: true, json: async () => ({ preview: '<p>rendered</p>' }) }
    }
    const renderPreview = createPreviewRenderer(previewEl, { fetchFn })
    await renderPreview({ inputFileName: 'a.md', content: '# hello' })
    assert.strictEqual(captured.url, '/preview')
    assert.strictEqual(captured.body.content, '# hello')
    assert.strictEqual(previewEl.iframe.attrs.srcdoc, '<p>rendered</p>')
    assert.strictEqual(previewEl.iframe.attrs.sandbox, 'allow-same-origin allow-scripts')
  })

  it('2回目以降は既存の iframe の srcdoc が差し替えられる', async () => {
    const previewEl = makeFakePreviewEl()
    const fetchFn = async () => ({ ok: true, json: async () => ({ preview: '<p>v2</p>' }) })
    const renderPreview = createPreviewRenderer(previewEl, { fetchFn })
    await renderPreview({})
    const first = previewEl.iframe
    await renderPreview({})
    assert.strictEqual(previewEl.iframe, first)
    assert.strictEqual(first.attrs.srcdoc, '<p>v2</p>')
  })

  it('エラー応答ではメッセージが通知され、プレビューは変更されない', async () => {
    const previewEl = makeFakePreviewEl()
    const fetchFn = async () => ({ ok: false, json: async () => ({ message: 'filename is requried.' }) })
    let notified
    const renderPreview = createPreviewRenderer(previewEl, { fetchFn, notify: (m) => { notified = m } })
    await renderPreview({})
    assert.strictEqual(notified, 'filename is requried.')
    assert.strictEqual(previewEl.iframe, null)
  })
})
