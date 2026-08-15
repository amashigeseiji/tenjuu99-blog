import { matchTemplate, buildFrontmatterString } from './frontmatter_template.js'
import { addLibraryImage } from './imageUploader.js'

/**
 * @vocab 新規作成UI
 * @test tests/editor/editor-ui-cleanup.test.js
 * @test tests/editor/editor-image-upload.test.js
 * ファイル名とテンプレートを受け付けて未公開のファイルを作る。画像ファイルの選択有無が
 * モードを決める: 選択済みなら画像追加（ファイル名入力は image/ 相対の配置パス）、
 * 未選択なら記事作成（src/pages/ 相対）。作成後の表示切り替えはコールバックに委ねる。
 * @param {{ nameInput: HTMLInputElement, templateSelect: HTMLSelectElement,
 *           imageInput: HTMLInputElement, errorEl: HTMLElement, confirmBtn: HTMLElement,
 *           getTemplates: () => Array<object>,
 *           onArticleCreated: (filename: string, content: string) => Promise<void> | void,
 *           onImageAdded: (imagePath: string) => Promise<void> | void,
 *           fetchFn?: typeof fetch, addImage?: typeof addLibraryImage }} options
 * @returns {{ resetForm: () => void }}
 */
export function initNewFileCreationUI({
  nameInput, templateSelect, imageInput, errorEl, confirmBtn,
  getTemplates,
  onArticleCreated,
  onImageAdded,
  fetchFn = (...a) => fetch(...a),
  addImage = addLibraryImage,
}) {
  imageInput.addEventListener('change', () => {
    const file = imageInput.files[0]
    if (file) {
      nameInput.value = file.name
      templateSelect.value = ''
      templateSelect.disabled = true
    } else {
      templateSelect.disabled = false
    }
  })

  // ファイル名入力に応じてテンプレートを auto-select
  nameInput.addEventListener('input', () => {
    if (imageInput.files[0]) return
    const template = matchTemplate(nameInput.value, getTemplates())
    templateSelect.value = template ? template.path_prefix : ''
  })

  // Enter キーで確定
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      confirmBtn.click()
    }
  })

  // 重複チェック付き作成。エラー時はタブを閉じない
  confirmBtn.addEventListener('click', async () => {
    const filename = nameInput.value.trim()
    if (!filename) return

    // 画像モード: 記事作成ではなく画像ライブラリへの追加として扱う
    const imageFile = imageInput.files[0]
    if (imageFile) {
      const result = await addImage(imageFile, filename)
      if (!result.ok) {
        errorEl.textContent = result.message ?? '画像の追加に失敗しました'
        return
      }
      imageInput.value = ''
      templateSelect.disabled = false
      await onImageAdded(result.imagePath)
      return
    }

    const selectedPrefix = templateSelect.value
    const selectedTemplate = selectedPrefix
      ? getTemplates().find(t => t.path_prefix === selectedPrefix)
      : null
    const baseName = filename.split('/').pop().replace(/\.[^.]+$/, '')
    const content = selectedTemplate
      ? buildFrontmatterString(selectedTemplate, baseName)
      : `---\ntitle: ${baseName}\n---\n`

    const res = await fetchFn('/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, content, createOnly: true })
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      errorEl.textContent = json.error ?? 'ファイルの作成に失敗しました'
      return
    }
    await onArticleCreated(filename, content)
  })

  // タブを開いたときのフォーム初期化: テンプレート選択肢の再構築と入力のクリア
  const resetForm = () => {
    templateSelect.innerHTML = '<option value="">テンプレートなし</option>'
    for (const tmpl of getTemplates()) {
      const option = templateSelect.ownerDocument.createElement('option')
      option.value = tmpl.path_prefix
      option.textContent = `テンプレート: ${tmpl.path_prefix}`
      templateSelect.appendChild(option)
    }
    nameInput.value = ''
    errorEl.textContent = ''
    imageInput.value = ''
    templateSelect.disabled = false
    nameInput.focus()
  }

  return { resetForm }
}
