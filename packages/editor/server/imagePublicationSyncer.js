import nodePath from 'node:path'
import { readLedger, setPublishedReferredBy, isDeclared, clearMovedFrom } from './imageLedger.js'

/**
 * @vocab: 画像公開同期器
 * @test tests/editor/image-library.test.js
 * 記事の同期操作（公開・更新・非公開）ごとに呼び出す。その記事が今参照している画像集合
 * （非公開時は空配列）を画像台帳の #公開済み参照 に反映し、参照を失い #検出外参照宣言 もない
 * 画像をリモートから取り除く（#画像公開状態 のGC判定）。
 * @param {string} articlePath - 記事パス（pagesDir からの相対パス、例: `post/hello.md`）
 * @param {string[]} currentImageRefs - 記事が現在参照している画像パス（srcDir からの相対パス、例: `src/image/post/cat.jpg`）。非公開時は空配列
 * @param {{ srcDir: string, ledgerPath: string }} deps
 * @param {import('@tenjuu99/blog/lib/publishing/publicationMeans.js').PublicationMeans} means
 * @returns {Promise<{ removed: string[] }>}
 */
export async function syncImagePublicationState(articlePath, currentImageRefs, deps, means) {
  const { srcDir, ledgerPath } = deps
  const imageDir = nodePath.join(srcDir, 'image')
  const currentLedgerKeys = new Set(
    currentImageRefs.map(f => `image/${nodePath.relative(imageDir, f)}`)
  )

  const ledger = readLedger(ledgerPath)
  const previouslyReferenced = Object.keys(ledger)
    .filter(imagePath => (ledger[imagePath].publishedReferredBy ?? []).includes(articlePath))

  const toEvaluate = new Set([...previouslyReferenced, ...currentLedgerKeys])

  const removed = []
  const removedMovedFrom = []
  for (const imagePath of toEvaluate) {
    const before = ledger[imagePath]?.publishedReferredBy ?? []
    const withoutArticle = before.filter(a => a !== articlePath)
    const after = currentLedgerKeys.has(imagePath) ? [...withoutArticle, articlePath] : withoutArticle
    setPublishedReferredBy(ledgerPath, imagePath, after)

    if (after.length === 0 && !isDeclared(ledgerPath, imagePath)) {
      const fullPath = nodePath.join(imageDir, imagePath.slice('image/'.length))
      await means.remove([fullPath])
      removed.push(imagePath)
      continue
    }

    // 移動した画像が新しいパスで届いたなら、リモートに残る #移動元パス はもう誰も参照しない。
    // 記事がまだ旧パスを参照している（参照を書き換えずに移動した）場合はこの条件に入らないため、
    // 公開中のサイトが参照しているパスを取り除いてしまうことはない。
    const movedFrom = ledger[imagePath]?.movedFrom
    if (movedFrom && currentLedgerKeys.has(imagePath)) {
      await means.remove([nodePath.join(imageDir, movedFrom.slice('image/'.length))])
      clearMovedFrom(ledgerPath, imagePath)
      removedMovedFrom.push(movedFrom)
    }
  }

  return { removed, removedMovedFrom }
}
