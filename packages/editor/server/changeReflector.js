/**
 * @vocab: 変更反映器
 * @test tests/editor/publish.test.js
 */

/**
 * @vocab: 公開する
 * 未公開 → 公開済み 遷移。ローカルにある公開物をリモートに反映する。
 * 更新する と現在は同じ実装だが、
 * 将来「非公開にする」「削除する」などの遷移が加わったとき実装が分岐する。
 * @param {string[]} files - 反映対象ファイルパスの配列
 * @param {import('@tenjuu99/blog/lib/publishing/publicationMeans.js').PublicationMeans} means
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function publish(files, means) {
  return await means.reflect(files)
}

/**
 * @vocab: 更新する
 * 更新あり → 公開済み 遷移。公開する と現在は同じ実装だが、
 * 将来「非公開にする」「削除する」などの遷移が加わったとき実装が分岐する。
 * @param {string[]} files - 反映対象ファイルパスの配列
 * @param {import('@tenjuu99/blog/lib/publishing/publicationMeans.js').PublicationMeans} means
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function update(files, means) {
  return await means.reflect(files)
}
