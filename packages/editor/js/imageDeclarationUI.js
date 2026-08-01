/**
 * @vocab: 画像詳細表示
 * @test tests/editor/image-library.test.js
 * 画像詳細表示のメタデータ欄に #検出外参照宣言 の付与・解除トグルを追加する。
 * DOM描画・イベント配線に依存するため自動テストを持たない（手動確認のみ）。
 * @param {HTMLInputElement} checkbox
 * @param {() => { path: string }|null} getEntry - 現在選択中の画像エントリを返す
 * @param {(message: string) => void} setFeedback
 * @param {(imagePath: string, declared: boolean) => void} onToggled - 反映成功後、画像リストのキャッシュ更新等を行うコールバック
 */
export function initImageDeclaration(checkbox, getEntry, setFeedback, onToggled) {
  if (!checkbox) return
  checkbox.addEventListener('change', async () => {
    const entry = getEntry()
    if (!entry) return
    const declared = checkbox.checked
    try {
      const res = await fetch('/image_declaration', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ imagePath: entry.path, declared })
      })
      const json = await res.json().catch(() => ({}))
      if (!json.success) {
        checkbox.checked = !declared
        setFeedback(`宣言を更新できませんでした: ${json.error ?? '不明なエラー'}`)
        return
      }
      onToggled(entry.path, declared)
    } catch {
      checkbox.checked = !declared
      setFeedback('サーバーに接続できませんでした。しばらくしてからお試しください。')
    }
  })
}
