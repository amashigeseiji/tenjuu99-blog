/**
 * @vocab: インラインファイル名編集UI
 * @test tests/editor/image-library.test.js
 * 画像詳細表示のメタデータ欄にある「ファイル名」表示をクリックで編集フォームに切り替える。
 * 保存の実行そのものは既存の画像移動UI（initImageMove）が担う——この装置は
 * 表示⇄フォームの切り替えのみを担当し、渡された保存ボタンへの配線は呼び出し側が行う。
 * DOM描画・イベント配線に依存するため自動テストを持たない（手動確認のみ）。
 * @param {HTMLElement} panelEl - 画像詳細パネル（.image-detail-filename を含む）
 * @param {() => { path: string }|null} getEntry - 現在選択中の画像エントリを返す
 */
export function initInlineFileNameEdit(panelEl, getEntry) {
  const displayEl = panelEl?.querySelector('.image-detail-filename-display')
  const editBtn = panelEl?.querySelector('.image-detail-filename-edit-btn')
  const formEl = panelEl?.querySelector('.image-detail-filename-form')
  const inputEl = panelEl?.querySelector('.image-detail-filename-input')
  const cancelBtn = panelEl?.querySelector('.image-detail-filename-cancel-btn')
  if (!displayEl || !editBtn || !formEl || !inputEl || !cancelBtn) return

  const showDisplay = () => {
    formEl.hidden = true
    displayEl.hidden = false
    editBtn.hidden = false
  }

  editBtn.addEventListener('click', () => {
    const entry = getEntry()
    if (!entry) return
    inputEl.value = entry.path.replace(/^image\//, '')
    displayEl.hidden = true
    editBtn.hidden = true
    formEl.hidden = false
    inputEl.focus()
  })

  cancelBtn.addEventListener('click', showDisplay)
}
