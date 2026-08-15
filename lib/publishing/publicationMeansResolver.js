import { createGitPublicationMeans } from './gitPublicationMeans.js'
import { createGitHubPublicationMeans } from './gitHubPublicationMeans.js'
import { createGitHubConnection } from './gitHubConnection.js'
import { createCredentialProvider, defaultCredentialLocation } from './credential.js'
import { createSyncBase, defaultSyncBaseLocation } from './syncBase.js'

/**
 * 手段名 → 組み立て関数。各関数は解決器に渡された構成一式を受け取る。
 * @type {Record<string, (options: ResolveOptions) => Promise<import('./publicationMeans.js').PublicationMeans>>}
 */
const registry = {
  git: async ({ cwd }) => await createGitPublicationMeans(cwd),
  github: async ({ cwd, github, credentialProvider, fetch }) => {
    if (!github?.owner || !github?.repo) {
      throw new Error('公開手段 github にはリモートの識別（publish.github.owner / repo）が必要です')
    }
    const connection = createGitHubConnection({
      owner: github.owner,
      repo: github.repo,
      branch: github.branch ?? 'main',
      ...(github.api_base ? { apiBase: github.api_base } : {}),
      credentialProvider: credentialProvider ?? createCredentialProvider({ location: defaultCredentialLocation(cwd), means: 'github' }),
      ...(fetch ? { fetch } : {}),
    })
    const syncBase = createSyncBase({ location: defaultSyncBaseLocation(cwd) })
    return await createGitHubPublicationMeans({ cwd, connection, syncBase })
  },
}

/**
 * 解決器に渡す構成。blog.json の `publish` をそのまま展開したもの＋コンテンツルート。
 * @typedef {object} ResolveOptions
 * @property {string} [means='git'] - 手段名（git | github）
 * @property {string} cwd - コンテンツルート（git 手段ではリポジトリのルート）
 * @property {{ owner: string, repo: string, branch?: string, api_base?: string }} [github] - GitHub 手段のリモートの識別（api_base は GitHub Enterprise 等で API の入口が異なるとき）
 * @property {import('./credential.js').CredentialProvider} [credentialProvider] - 認証情報の提供者（省略時は手元だけの置き場所から読む）
 * @property {typeof fetch} [fetch] - 通信の関数（テスト等での注入用）
 */

/**
 * @vocab 公開手段解決器
 * @test tests/publishing/publicationMeans.test.js
 * @test tests/publishing/gitHubPublicationMeans.test.js
 * 構成にもとづいて使う公開手段を決めて提供する。手段の差し替え点はここに一本化される。
 * GitHub 手段では、構成のリモートの識別と認証情報の提供者を与えて組み立てる。
 * @param {ResolveOptions} options - 構成（means 未指定時の既定は git）
 * @returns {Promise<import('./publicationMeans.js').PublicationMeans>}
 */
export async function resolvePublicationMeans({ means = 'git', ...options }) {
  const create = registry[means]
  if (!create) throw new Error(`未知の公開手段です: ${means}`)
  return await create(options)
}
