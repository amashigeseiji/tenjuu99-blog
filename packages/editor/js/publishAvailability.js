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

/**
 * @vocab 公開可否判定器
 * @test tests/editor/sync-operations.test.js
 * 記事の状態ごとに行える操作（公開・非公開・削除・取り込み）を判定する。
 * 削除は未公開のみ、非公開は公開済み・更新ありのみ。unknown ではどの操作も行えない。
 * @param {'new'|'modified'|'published'|'unknown'|'remote-only'} status
 * @returns {{ publish: boolean, unpublish: boolean, delete: boolean, pull: boolean }}
 */
export function resolveOperations(status) {
  switch (status) {
    case 'new':
      return { publish: true, unpublish: false, delete: true, pull: false }
    case 'modified':
      return { publish: true, unpublish: true, delete: false, pull: false }
    case 'published':
      return { publish: false, unpublish: true, delete: false, pull: false }
    case 'remote-only':
      return { publish: false, unpublish: true, delete: false, pull: true }
    default:
      return { publish: false, unpublish: false, delete: false, pull: false }
  }
}
