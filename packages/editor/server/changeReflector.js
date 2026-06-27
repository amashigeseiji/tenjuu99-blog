/**
 * @vocab: 変更反映器 (plans/editor-publish/dictionary.md#変更反映器)
 * @test tests/editor/publish.test.js
 */

/**
 * 遷移実行体。commit と push を注入することで実際の git なしにテストできる。
 * @typedef {object} PublishActions
 * @property {(files: string[]) => Promise<boolean>} commit - ファイル群をステージしてコミットする。変更がなければ false を返す
 * @property {() => Promise<{ success: boolean, error?: string }>} push - リモートへプッシュする
 */

/**
 * @param {string[]} files - コミット対象ファイルパスの配列
 * @param {PublishActions} publishActions
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function reflect(files, publishActions) {
  const committed = await publishActions.commit(files)
  // 変更がない（コミット不要）場合は成功とみなす
  if (!committed) return { success: true }
  return await publishActions.push()
}

/**
 * @vocab: 公開する (plans/editor-publish/dictionary.md#公開する)
 * 未公開 → 公開済み 遷移。更新する と現在は同じ実装だが、
 * 将来「非公開にする」「削除する」などの遷移が加わったとき実装が分岐する。
 * @param {string[]} files - コミット対象ファイルパスの配列
 * @param {PublishActions} publishActions
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function publish(files, publishActions) {
  return reflect(files, publishActions)
}

/**
 * @vocab: 更新する (plans/editor-publish/dictionary.md#更新する)
 * 更新あり → 公開済み 遷移。公開する と現在は同じ実装だが、
 * 将来「非公開にする」「削除する」などの遷移が加わったとき実装が分岐する。
 * @param {string[]} files - コミット対象ファイルパスの配列
 * @param {PublishActions} publishActions
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function update(files, publishActions) {
  return reflect(files, publishActions)
}
