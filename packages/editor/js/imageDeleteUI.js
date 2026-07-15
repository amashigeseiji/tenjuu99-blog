/**
 * @vocab: 画像削除UI
 * @test tests/editor/image-library.test.js
 * 画像詳細表示（editor-options の右側）に削除操作を追加する。参照記事があれば
 * 参照記事一覧エンドポイントで確認したうえで確認ダイアログ（3択）を経て削除を実行する。
 * DOM描画・イベント配線に依存するため自動テストを持たない（手動確認のみ）。
 * @param {HTMLButtonElement} deleteBtn
 * @param {() => { path: string }|null} getEntry - 現在選択中の画像エントリを返す
 * @param {(message: string, choices?: { label: string, value: any }[]) => Promise<any>} showConfirm
 * @param {(message: string) => void} setFeedback
 * @param {(deletedPath: string) => void} onDeleted - 削除成功後、画像リストの再取得等を行うコールバック
 */
export function initImageDelete(deleteBtn, getEntry, showConfirm, setFeedback, onDeleted) {
  if (!deleteBtn) return
  deleteBtn.addEventListener('click', async () => {
    const entry = getEntry()
    if (!entry) return

    let articles = []
    try {
      const res = await fetch(`/get_image_references?imagePath=${encodeURIComponent(entry.path)}`)
      const json = await res.json()
      articles = json.articles || []
    } catch {
      setFeedback('サーバーに接続できませんでした。しばらくしてからお試しください。')
      return
    }

    let referenceHandling = 'keep'
    if (articles.length > 0) {
      const lines = articles.map(a => `${a.path}${a.status !== 'new' ? '（公開済み）' : ''}`)
      const choice = await showConfirm(
        `この画像を参照している記事があります:\n${lines.join('\n')}`,
        [
          { label: '参照はそのままにして削除', value: 'keep' },
          { label: '参照も除去して削除', value: 'update' },
          { label: '中止', value: null },
        ]
      )
      if (!choice) return
      referenceHandling = choice
    } else if (!(await showConfirm(`「${entry.path}」を削除します。よろしいですか？`))) {
      return
    }

    setFeedback('削除しています...')
    try {
      const res = await fetch('/delete_image', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ imagePath: entry.path, referenceHandling })
      })
      const json = await res.json().catch(() => ({}))
      if (!json.success) {
        setFeedback(`削除できませんでした: ${json.error ?? '不明なエラー'}`)
        return
      }
      setFeedback('削除しました')
      onDeleted(entry.path)
    } catch {
      setFeedback('サーバーに接続できませんでした。しばらくしてからお試しください。')
    }
  })
}
