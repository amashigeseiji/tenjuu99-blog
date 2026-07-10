import { classify } from './versionLineage.js'

/**
 * @vocab 取り込む
 * @test tests/publishing/sync.test.js
 * リモートの内容を、手元の執筆内容を失わずにローカルへ反映する。
 * 安全に取り込めない記事は版の連なりにもとづいて見送り、理由とともに返す。
 * @param {import('./publicationMeans.js').PublicationMeans} means
 * @param {{ scope?: string }} [options] - scope: 取り込み対象のパス接頭辞（例: 'src/pages/'。原稿以外に手を出さないため）
 * @returns {Promise<{ success: boolean, applied: string[], skipped: Array<{ file: string, reason: string }>, error?: string }>}
 */
export async function pull(means, { scope } = {}) {
  if (means.refreshRemote) {
    const refreshed = await means.refreshRemote()
    if (!refreshed.success) return { success: false, applied: [], skipped: [], error: refreshed.error }
  }
  let remoteFiles
  try {
    remoteFiles = await means.remoteState.listRemoteFiles()
  } catch (e) {
    return { success: false, applied: [], skipped: [], error: e.message }
  }
  const candidates = scope ? remoteFiles.filter(f => f.startsWith(scope)) : remoteFiles
  const applied = []
  const skipped = []
  for (const file of candidates) {
    const verdict = classify(await means.lineageOf(file))
    if (verdict.pullable) applied.push(file)
    else if (verdict.reason) skipped.push({ file, reason: verdict.reason })
  }
  if (applied.length > 0) {
    const taken = await means.takeFromRemote(applied)
    if (!taken.success) return { success: false, applied: [], skipped, error: taken.error }
  }
  return { success: true, applied, skipped }
}
