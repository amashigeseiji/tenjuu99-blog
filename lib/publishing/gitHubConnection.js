/**
 * @vocab GitHub接続
 * 接続の誤り。届かない事情（認証情報が無い・通らない・不通）や、リモートが進んでいて
 * 書き込めないことを、種別（kind）つきで呼び出し側に伝える（沈黙しない）。
 */
export class GitHubConnectionError extends Error {
  /**
   * @param {'noCredential'|'unauthorized'|'unreachable'|'remoteAdvanced'|'notFound'|'rateLimited'|'api'} kind
   * @param {string} message
   * @param {{ status?: number, cause?: unknown }} [details]
   */
  constructor(kind, message, { status, cause } = {}) {
    super(message, cause !== undefined ? { cause } : undefined)
    this.name = 'GitHubConnectionError'
    this.kind = kind
    this.status = status
  }
}

/**
 * リモートの現在の版。id は版の識別、treeId はその版の内容一式の識別、
 * files はパス → { fingerprint, mode }（fingerprint はフィンガープリントと一致する）。
 * @typedef {object} RemoteVersion
 * @property {string} id
 * @property {string} treeId
 * @property {Map<string, { fingerprint: string, mode: string }>} files
 */

/** 通常のファイル（実行属性なし）の mode。反映するファイルはこの形で書く */
export const BLOB_MODE = '100644'

/**
 * @vocab GitHub接続
 * @test tests/publishing/gitHubPublicationMeans.test.js
 * GitHub公開手段の読み書きが通る薄い口。認証情報提供者からいま有効な認証情報を得て添え、
 * リモートの現在の版とファイル一覧・内容を読み、新しい版（追加・更新・削除をまとめたもの）を
 * 書き込む。通信の関数は注入可能（既定は globalThis.fetch）。
 * @param {object} options
 * @param {string} options.owner - リモートの所有者
 * @param {string} options.repo - リポジトリ名
 * @param {string} [options.branch='main'] - 反映先のブランチ
 * @param {import('./credential.js').CredentialProvider} options.credentialProvider
 * @param {typeof fetch} [options.fetch]
 * @param {string} [options.apiBase='https://api.github.com']
 * @returns {{
 *   readCurrentVersion: () => Promise<RemoteVersion>,
 *   readContent: (fingerprint: string) => Promise<Buffer>,
 *   writeVersion: (input: { base: RemoteVersion, changes: Array<{ path: string, content: Buffer|null }>, message: string }) => Promise<{ id: string, treeId: string }>,
 * }}
 */
export function createGitHubConnection({
  owner, repo, branch = 'main', credentialProvider,
  fetch: fetchImpl = globalThis.fetch, apiBase = 'https://api.github.com',
}) {
  const repoBase = `${apiBase}/repos/${owner}/${repo}/git`

  /** 認証情報を添えて API を呼び、届かない事情を種別つきの誤りに変換する */
  const call = async (method, path, body) => {
    const credential = await credentialProvider()
    if (!credential?.token) {
      throw new GitHubConnectionError('noCredential', 'GitHub の認証情報が見つかりません。手元の置き場所にトークンを置いてください')
    }
    let response
    try {
      response = await fetchImpl(`${repoBase}/${path}`, {
        method,
        headers: {
          authorization: `Bearer ${credential.token}`,
          accept: 'application/vnd.github+json',
          'x-github-api-version': '2022-11-28',
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
    } catch (cause) {
      throw new GitHubConnectionError('unreachable', `GitHub に届きません: ${cause?.message ?? cause}`, { cause })
    }
    if (response.ok) return await response.json()
    let message = response.statusText
    try { message = (await response.json()).message ?? message } catch { /* 本文が JSON でない */ }
    if (response.status === 429 || (response.status === 403 && /rate limit/i.test(message))) {
      throw new GitHubConnectionError('rateLimited', `GitHub の利用回数の上限に達しました。しばらく待ってからやり直してください: ${message}`, { status: response.status })
    }
    if (response.status === 401 || response.status === 403) {
      throw new GitHubConnectionError('unauthorized', `GitHub の認証情報が通りません: ${message}`, { status: response.status })
    }
    if (response.status === 404) {
      throw new GitHubConnectionError('notFound', `GitHub 上に見つかりません（${owner}/${repo} @ ${branch}）: ${message}`, { status: 404 })
    }
    if (response.status === 422 && method === 'PATCH' && path.startsWith('refs/')) {
      throw new GitHubConnectionError('remoteAdvanced', 'リモートが進んでいるため書き込めませんでした', { status: 422 })
    }
    throw new GitHubConnectionError('api', `GitHub がエラーを返しました（${response.status}）: ${message}`, { status: response.status })
  }

  const readCurrentVersion = async () => {
    const ref = await call('GET', `ref/heads/${branch}`)
    const id = ref.object.sha
    const commit = await call('GET', `commits/${id}`)
    const treeId = commit.tree.sha
    const tree = await call('GET', `trees/${treeId}?recursive=1`)
    if (tree.truncated) {
      throw new GitHubConnectionError('api', 'リモートのファイル一覧が大きすぎて全部を読めませんでした')
    }
    const files = new Map()
    for (const entry of tree.tree) {
      if (entry.type === 'blob') files.set(entry.path, { fingerprint: entry.sha, mode: entry.mode })
    }
    return { id, treeId, files }
  }

  const readContent = async (fingerprint) => {
    const blob = await call('GET', `blobs/${fingerprint}`)
    if (blob.encoding !== 'base64') return Buffer.from(blob.content, 'utf-8')
    return Buffer.from(blob.content, 'base64')
  }

  const writeVersion = async ({ base, changes, message }) => {
    const tree = []
    for (const change of changes) {
      if (change.content === null) {
        tree.push({ path: change.path, mode: BLOB_MODE, type: 'blob', sha: null })
        continue
      }
      const blob = await call('POST', 'blobs', { content: Buffer.from(change.content).toString('base64'), encoding: 'base64' })
      const mode = base.files.get(change.path)?.mode ?? BLOB_MODE
      tree.push({ path: change.path, mode, type: 'blob', sha: blob.sha })
    }
    const newTree = await call('POST', 'trees', { base_tree: base.treeId, tree })
    const commit = await call('POST', 'commits', { message, tree: newTree.sha, parents: [base.id] })
    await call('PATCH', `refs/heads/${branch}`, { sha: commit.sha, force: false })
    return { id: commit.sha, treeId: newTree.sha }
  }

  return { readCurrentVersion, readContent, writeVersion }
}
