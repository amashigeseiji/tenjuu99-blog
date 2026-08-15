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

/**
 * @vocab 版の連なり
 * @test tests/publishing/gitHubPublicationMeans.test.js
 * 手元・リモート・同期の基点の三者の内容（フィンガープリント。無ければ null）の同異から、
 * 版の先後関係を判定する。git では merge-base が担っていた「共通の祖先」を基点が代替する。
 * 基点が無いときは、両側に存在して内容が異なるものを 'diverged' として正直に退化させる。
 * リモートに無いものは基点の有無によらず 'localOnly'（リモートで消されたものの伝播は git 手段と同じ読みに揃える）。
 * @param {{ local: string|null, remote: string|null, base: string|null }} fingerprints
 * @returns {import('./publicationMeans.js').Lineage}
 */
export function judge({ local, remote, base }) {
  if (remote === null) return 'localOnly'
  if (local === null) return base !== null ? 'deletedLocally' : 'remoteOnly'
  if (local === remote) return 'same'
  const remoteChanged = remote !== base
  const localChanged = local !== base
  if (remoteChanged && localChanged) return 'diverged'
  return remoteChanged ? 'remoteAhead' : 'localAhead'
}
