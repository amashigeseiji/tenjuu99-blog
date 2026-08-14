/**
 * @vocab 操作実行器
 * @test tests/editor/operationExecutor.test.js
 * 進行中の表示・結果の伝達・完了後の更新という操作の一連の流れを、一つの定型として実行する。
 * 公開・非公開・削除・取り込み・リモートのみ画像の除去がこの定型を共有し、
 * 接続失敗の文言はここに一本化される。
 * @param {(message: string) => void} setFeedback 結果・進行中の表示先
 * @param {typeof fetch} [fetchFn]
 * @returns {(operation: {
 *   confirm?: () => Promise<boolean>,
 *   button?: { disabled: boolean } | null,
 *   progress?: string,
 *   endpoint: string,
 *   body?: object,
 *   success: (json: object) => string,
 *   failure: (json: object, resOk: boolean) => string,
 *   onSuccess?: (json: object) => Promise<void> | void,
 * }) => Promise<void>}
 */
export function createOperationExecutor(setFeedback, fetchFn = (...a) => fetch(...a)) {
  return async ({ confirm, button = null, progress, endpoint, body = {}, success, failure, onSuccess }) => {
    if (confirm && !(await confirm())) return
    if (button) button.disabled = true
    if (progress) setFeedback(progress)
    try {
      const res = await fetchFn(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        setFeedback(failure(json, res.ok))
        return
      }
      setFeedback(success(json))
      if (onSuccess) await onSuccess(json)
    } catch {
      setFeedback('サーバーに接続できませんでした。しばらくしてからお試しください。')
    } finally {
      if (button) button.disabled = false
    }
  }
}
