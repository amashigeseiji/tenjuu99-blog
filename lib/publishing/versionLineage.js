/**
 * @vocab 版の連なり
 * @test tests/publishing/sync.test.js
 * 版の先後関係の読みから、取り込みの可否と見送りの理由（執筆者に伝わる言葉）を判定する。
 * @param {import('./publicationMeans.js').Lineage} lineage
 * @returns {{ pullable: boolean, reason?: string }}
 */
export function classify(lineage) {
  switch (lineage) {
    case 'remoteOnly':
    case 'remoteAhead':
      return { pullable: true }
    case 'diverged':
      return {
        pullable: false,
        reason: '手元とリモートの両方で変わっているため、手元の内容を守って取り込みを見送りました',
      }
    case 'deletedLocally':
      return {
        pullable: false,
        reason: '手元で削除されている記事のため、取り込みで戻すことはしませんでした',
      }
    default:
      // same / localOnly / localAhead: 取り込むものが無い（見送りの通知も不要）
      return { pullable: false }
  }
}
