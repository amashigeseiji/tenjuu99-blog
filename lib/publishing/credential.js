import { existsSync, readFileSync } from 'node:fs'
import nodePath from 'node:path'

/**
 * @vocab 認証情報
 * 公開手段がリモートへ届くために示す本人性の証し。形は手段ごとに異なる
 * （GitHub ならトークン）。共有される設定（blog.json）にもリモートにも含めず、
 * コンテンツルートごと・マシンごとに手元だけに置かれる。
 * @typedef {{ token: string }} Credential
 */

/**
 * @vocab 認証情報提供者
 * いま有効な認証情報を返す提供者。届く必要のある側（接続）は、置き場所や取得の仕方ではなく
 * この形にだけ依存する。無いときは null を返す（例外にはしない）。
 * @typedef {() => Promise<Credential|null>} CredentialProvider
 */

/**
 * 認証情報の既定の置き場所。コンテンツルート内の非公開の場所（手元だけに残る）。
 * @param {string} contentRoot
 * @returns {string}
 */
export function defaultCredentialLocation(contentRoot) {
  return nodePath.join(contentRoot, '.blog', 'credentials.json')
}

/**
 * @vocab 認証情報
 * @test tests/publishing/gitHubPublicationMeans.test.js
 * 手元だけの置き場所から、手段名で区切られた認証情報を読み出す。
 * 置き場所が無い・その手段の項目が無い・読めないときは null（無いと分かる）。
 * @param {string} location - 置き場所（JSON ファイル。形は { "<手段名>": { ... } }）
 * @param {string} means - 手段名（例: 'github'）
 * @returns {Credential|null}
 */
export function readCredential(location, means) {
  if (!existsSync(location)) return null
  try {
    const parsed = JSON.parse(readFileSync(location, 'utf-8'))
    const entry = parsed?.[means]
    return entry && typeof entry === 'object' ? entry : null
  } catch {
    return null
  }
}

/**
 * @vocab 認証情報提供者
 * @test tests/publishing/gitHubPublicationMeans.test.js
 * 呼ばれるたびに置き場所から読む提供者を作る（置き直しが次の呼び出しに反映される）。
 * @param {{ location: string, means: string }} options
 * @returns {CredentialProvider}
 */
export function createCredentialProvider({ location, means }) {
  return async () => readCredential(location, means)
}
