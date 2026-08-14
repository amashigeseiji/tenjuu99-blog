/**
 * @vocab アクティブ状態同期器
 * @test tests/editor/activeStateSynchronizer.test.js
 * サイドバーのアクティブ表示を現在の表示対象に一致させる。表示対象からサイドバーリンクへの
 * 照合（href の組み立て）をここへ一本化する。リンクの data-status の同期も同じ照合で行う。
 * @param {Pick<Document, 'querySelector' | 'querySelectorAll'>} doc
 * @returns {{ syncActive: (target: { type: string, path: string } | null) => void,
 *             syncStatus: (path: string, status: string) => void }}
 */
export function createActiveStateSynchronizer(doc) {
  const hrefFor = (target) => target.type === 'image'
    ? `/editor?image=${encodeURIComponent(target.path)}`
    : `/editor?md=${encodeURIComponent(target.path)}`
  const findLink = (target) => doc.querySelector(`.sidebar a[href="${hrefFor(target)}"]`)

  return {
    syncActive(target) {
      doc.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'))
      if (!target?.path) return
      const link = findLink(target)
      if (link) link.classList.add('active')
    },
    syncStatus(path, status) {
      const link = findLink({ type: 'article', path })
      if (link) link.dataset.status = status || ''
    },
  }
}
