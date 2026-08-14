/**
 * @vocab 自動保存
 * @test tests/editor/editor-ui-cleanup.test.js
 * 編集中の内容を保存エンドポイントへ送る自動保存の実体。ファイル名が無ければ何もしない。
 * 保存に成功したら公開ステータスの再取得（onSaved）を促す。失敗してもエディタは動作を続ける。
 * @param {{ getFilename: () => string, getContent: () => string,
 *           onSaved: (filename: string) => void, fetchFn?: typeof fetch }} options
 * @returns {() => Promise<void>}
 */
export function createAutoSave({ getFilename, getContent, onSaved, fetchFn = (...a) => fetch(...a) }) {
  return async () => {
    const filename = getFilename()
    if (!filename) return
    try {
      const res = await fetchFn('/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, content: getContent() })
      })
      if (!res.ok) {
        console.log('[auto-save] 保存に失敗しました', res.status)
        return
      }
      onSaved(filename)
    } catch (e) {
      console.log('[auto-save] ネットワークエラー', e)
    }
  }
}
