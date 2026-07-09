/**
 * @vocab 公開可否判定器
 * @test tests/editor/publish-availability.test.js
 * 公開ステータスの値（特に unknown）から、公開ボタンを無効化すべきかと
 * 利用者への表示文言を判定する。unknown の原因（means 不正/git remote 未設定等）を
 * 問わず同一の扱いをする。
 * @param {'new'|'modified'|'published'|'unknown'} status
 * @returns {{ disabled: boolean, label: string|null }}
 */
export function publishAvailability(status) {
  if (status === 'unknown') {
    return { disabled: true, label: '状態不明（公開不可）' }
  }
  return { disabled: false, label: null }
}
