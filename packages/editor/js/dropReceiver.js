import { insertImageMarkdown } from './image_upload.js'
import { uploadImage } from './imageUploader.js'

/**
 * @vocab ドロップレシーバー
 * @vocab ドロップレシーバー拡張
 * @test tests/editor/editor-image-upload.test.js
 * @test tests/editor/auto-preview.test.js
 * テキストエリアへの画像ドロップを受け付け、#画像アップローダー で送信した結果の
 * Markdown 参照を #Markdown挿入器 でカーソル位置に挿入する。
 * @param {HTMLTextAreaElement} textarea
 * @param {() => string} getMdFile
 * @param {() => void} onUpdate 挿入後のプレビュー更新
 * @param {() => void} [cancelPendingDebounce] ドロップ時に保留中の自動更新を取り消す
 * @param {typeof uploadImage} [upload]
 */
export const initDropReceiver = (textarea, getMdFile, onUpdate, cancelPendingDebounce, upload = uploadImage) => {
  textarea.addEventListener('dragover', (e) => {
    e.preventDefault()
  })
  textarea.addEventListener('drop', async (e) => {
    e.preventDefault()
    if (cancelPendingDebounce) cancelPendingDebounce()
    const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'))
    let inserted = false
    for (const file of files) {
      const markdownUrl = await upload(file, getMdFile())
      if (markdownUrl) {
        const start = textarea.selectionStart
        const content = textarea.value
        const next = insertImageMarkdown(content, start, markdownUrl)
        textarea.value = next
        textarea.selectionStart = textarea.selectionEnd = start + (next.length - content.length)
        inserted = true
      }
    }
    if (inserted && onUpdate) onUpdate()
  })
}
