/**
 * リモートの現在の内容を参照する読み取り専用の抽象。
 * git 依存を外部から注入することで実際のリモートリポジトリなしにテストできる。
 * @typedef {object} PublishedState
 * @property {(filePath: string) => Promise<boolean>} existsInRemote - ファイルがリモートに存在するか
 * @property {(filePath: string) => Promise<string>} diffFromRemote - リモートとの差分（差分なしなら空文字列）
 */

/**
 * @vocab: 公開ステータス判定器 (plans/editor-publish/dictionary.md#公開ステータス判定器)
 * @test tests/editor/publish.test.js
 * @param {string} filePath - git ルートからの相対パス（例: `src/pages/post/hello.md`）
 * @param {PublishedState} publishedState
 * @returns {Promise<'new'|'modified'|'published'|'unknown'>}
 */
export async function getPublicationStatus(filePath, publishedState) {
  try {
    const exists = await publishedState.existsInRemote(filePath)
    if (!exists) return 'new'
    const diff = await publishedState.diffFromRemote(filePath)
    return diff ? 'modified' : 'published'
  } catch {
    return 'unknown'
  }
}
