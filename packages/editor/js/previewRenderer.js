/**
 * @vocab プレビュー描画器
 * @test tests/editor/previewRenderer.test.js
 * 編集中の内容をプレビューエンドポイントへ送り、返った描画結果を sandbox 付き iframe で
 * プレビュー領域に反映する。iframe は初回だけ作り、以降は差し替える（ちらつき防止）。
 * @param {HTMLElement} previewEl プレビュー領域
 * @param {{ fetchFn?: typeof fetch, notify?: (message: string) => void }} [options]
 * @returns {(fields: object) => Promise<void>} 編集中の内容（フォームのフィールド）を渡して描画する
 */
export function createPreviewRenderer(previewEl, { fetchFn = (...a) => fetch(...a), notify = (m) => alert(m) } = {}) {
  return async (fields) => {
    try {
      const response = await fetchFn('/preview', {
        method: 'post',
        body: JSON.stringify(fields)
      })
      const json = await response.json()
      if (!response.ok) {
        notify(json.message)
        return
      }
      if (json.preview) {
        const old = previewEl.querySelector('iframe')
        if (!old) {
          const iframe = previewEl.ownerDocument.createElement('iframe')
          iframe.setAttribute('srcdoc', json.preview)
          iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts')
          previewEl.appendChild(iframe)
        } else {
          old.setAttribute('srcdoc', json.preview)
        }
      }
    } catch (e) {
      console.log(e.message)
    }
  }
}
