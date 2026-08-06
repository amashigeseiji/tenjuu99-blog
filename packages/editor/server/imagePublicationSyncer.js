import nodePath from 'node:path'
import { readLedger, setPublishedReferredBy, isDeclared, clearMovedFrom } from './imageLedger.js'

/**
 * @vocab: 画像公開同期器
 * @test tests/editor/image-library.test.js
 * 記事の同期操作（公開・更新・非公開）ごとに呼び出す。その記事が今参照している画像集合
 * （非公開時は空配列）を画像台帳の #公開済み参照 に反映し、参照を失い #検出外参照宣言 もない
 * 画像をリモートから取り除く（#画像公開状態 のGC判定）。
 * リモートからの除去に失敗した画像については台帳を書き換えない。参照の記録がそのまま残ることで、
 * 次の同期で同じ画像がもう一度評価され、取り除きなおせる（台帳が「取り除いた」と言いながら
 * リモートに残る、という食い違いを作らない）。
 * @param {string} articlePath - 記事パス（pagesDir からの相対パス、例: `post/hello.md`）
 * @param {string[]} currentImageRefs - 記事が現在参照している画像パス（srcDir からの相対パス、例: `src/image/post/cat.jpg`）。非公開時は空配列
 * @param {{ srcDir: string, ledgerPath: string }} deps
 * @param {import('@tenjuu99/blog/lib/publishing/publicationMeans.js').PublicationMeans} means
 * @returns {Promise<{ removed: string[], removedMovedFrom: string[], failed: string[] }>}
 *   removed: 取り除いた画像パス / removedMovedFrom: 取り除いた #移動元パス /
 *   failed: 取り除こうとして失敗した画像パス（移動元パスを含む）
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
  const failed = []
  for (const imagePath of toEvaluate) {
    const before = ledger[imagePath]?.publishedReferredBy ?? []
    const withoutArticle = before.filter(a => a !== articlePath)
    const after = currentLedgerKeys.has(imagePath) ? [...withoutArticle, articlePath] : withoutArticle

    if (after.length === 0 && !isDeclared(ledgerPath, imagePath)) {
      const fullPath = nodePath.join(imageDir, imagePath.slice('image/'.length))
      const result = await means.remove([fullPath])
      if (!result.success) {
        failed.push(imagePath)
        continue
      }
      setPublishedReferredBy(ledgerPath, imagePath, after)
      removed.push(imagePath)
      continue
    }
    setPublishedReferredBy(ledgerPath, imagePath, after)

    // 移動した画像が新しいパスで届いたなら、リモートに残る #移動元パス はもう誰も参照しない。
    // 記事がまだ旧パスを参照している（参照を書き換えずに移動した）場合はこの条件に入らないため、
    // 公開中のサイトが参照しているパスを取り除いてしまうことはない。
    const movedFrom = ledger[imagePath]?.movedFrom
    if (movedFrom && currentLedgerKeys.has(imagePath)) {
      const result = await means.remove([nodePath.join(imageDir, movedFrom.slice('image/'.length))])
      if (!result.success) {
        failed.push(movedFrom)
        continue
      }
      clearMovedFrom(ledgerPath, imagePath)
      removedMovedFrom.push(movedFrom)
    }
  }

  return { removed, removedMovedFrom, failed }
}
