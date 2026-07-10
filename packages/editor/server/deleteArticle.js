import { rm } from 'node:fs/promises'

/**
 * @vocab: 削除する
 * @test tests/editor/sync-operations.test.js
 * 未公開 → 未存在 遷移。未公開の記事をローカルから取り除く。
 * リモートには関与しない（公開済みの記事は先に非公開にする）。
 * 関数名が deleteArticle なのは delete が予約語のため。
 * @param {string} absoluteFilePath - 削除対象の絶対パス
 * @returns {Promise<void>}
 */
export async function deleteArticle(absoluteFilePath) {
  await rm(absoluteFilePath)
}
