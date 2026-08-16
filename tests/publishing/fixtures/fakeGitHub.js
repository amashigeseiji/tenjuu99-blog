import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import nodePath from 'node:path'

/**
 * テスト用の偽 GitHub。GitHub の Git Data API（refs / commits / trees / blobs）のうち
 * GitHub接続 が使う範囲を、bare な git リポジトリに対する git plumbing で実装した
 * `fetch` 互換の関数を返す。リモートの実体は本物の git リポジトリなので、
 * git 運用のマシン（clone）とのやり取りをそのまま検証できる。
 *
 * @param {object} options
 * @param {string} options.bareDir - bare リポジトリのパス
 * @param {string} options.owner
 * @param {string} options.repo
 * @param {string} [options.token] - 受け付けるトークン（省略時は認証を検査しない）
 * @param {() => void} [options.onRequest] - リクエストごとに呼ぶ（不通の再現などに使う）
 * @returns {{ fetch: typeof fetch, calls: Array<{ method: string, path: string }> }}
 */
export function createFakeGitHub({ bareDir, owner, repo, token, onRequest }) {
  const prefix = `/repos/${owner}/${repo}/git/`
  const calls = []
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: 'fake-github', GIT_AUTHOR_EMAIL: 'fake-github@example.com',
    GIT_COMMITTER_NAME: 'fake-github', GIT_COMMITTER_EMAIL: 'fake-github@example.com',
  }
  const git = (args, input) => execFileSync('git', args, { cwd: bareDir, env, input, encoding: 'buffer', stdio: ['pipe', 'pipe', 'pipe'] })
  const gitText = (args, input) => git(args, input).toString('utf-8')
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

  const fetchImpl = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url)
    const method = (init.method || 'GET').toUpperCase()
    calls.push({ method, path: url.pathname })
    if (onRequest) onRequest({ method, path: url.pathname })
    if (token !== undefined) {
      const auth = new Headers(init.headers).get('authorization')
      if (auth !== `Bearer ${token}`) return json(401, { message: 'Bad credentials' })
    }
    if (!url.pathname.startsWith(prefix)) return json(404, { message: 'Not Found' })
    const rest = url.pathname.slice(prefix.length)
    const body = init.body ? JSON.parse(init.body) : null

    // refs
    let m = rest.match(/^ref\/heads\/(.+)$/) || rest.match(/^refs\/heads\/(.+)$/)
    if (m) {
      const branch = m[1]
      if (method === 'GET') {
        try {
          const sha = gitText(['rev-parse', '--verify', `refs/heads/${branch}`]).trim()
          return json(200, { ref: `refs/heads/${branch}`, object: { type: 'commit', sha } })
        } catch {
          return json(404, { message: 'Not Found' })
        }
      }
      if (method === 'PATCH') {
        const current = gitText(['rev-parse', '--verify', `refs/heads/${branch}`]).trim()
        if (!body.force) {
          try {
            git(['merge-base', '--is-ancestor', current, body.sha])
          } catch {
            return json(422, { message: 'Update is not a fast forward' })
          }
        }
        git(['update-ref', `refs/heads/${branch}`, body.sha, current])
        return json(200, { ref: `refs/heads/${branch}`, object: { type: 'commit', sha: body.sha } })
      }
    }
    // commits
    m = rest.match(/^commits\/([0-9a-f]+)$/)
    if (m && method === 'GET') {
      const raw = gitText(['cat-file', '-p', m[1]])
      const tree = raw.match(/^tree ([0-9a-f]+)/m)[1]
      const parents = [...raw.matchAll(/^parent ([0-9a-f]+)/gm)].map(x => ({ sha: x[1] }))
      return json(200, { sha: m[1], tree: { sha: tree }, parents })
    }
    if (rest === 'commits' && method === 'POST') {
      const args = ['commit-tree', body.tree]
      for (const p of body.parents || []) args.push('-p', p)
      args.push('-m', body.message)
      const sha = gitText(args, undefined).trim()
      return json(201, { sha })
    }
    // trees
    m = rest.match(/^trees\/([0-9a-f]+)$/)
    if (m && method === 'GET') {
      const lines = gitText(['ls-tree', '-r', m[1]]).split('\n').filter(Boolean)
      const tree = lines.map(line => {
        const [meta, path] = line.split('\t')
        const [mode, type, sha] = meta.split(' ')
        return { path, mode, type, sha }
      })
      return json(200, { sha: m[1], tree, truncated: false })
    }
    if (rest === 'trees' && method === 'POST') {
      const indexFile = nodePath.join(mkdtempSync(nodePath.join(tmpdir(), 'fake-gh-index-')), 'index')
      const gitIdx = (args, input) => execFileSync('git', args, { cwd: bareDir, env: { ...env, GIT_INDEX_FILE: indexFile }, input, encoding: 'utf-8' })
      if (body.base_tree) gitIdx(['read-tree', body.base_tree])
      // sha が null の項目は削除（mode 0 の index-info は当該パスを索引から外す）
      const indexInfo = body.tree.map(entry => entry.sha === null
        ? `0 0000000000000000000000000000000000000000\t${entry.path}`
        : `${entry.mode} ${entry.sha}\t${entry.path}`).join('\n') + '\n'
      gitIdx(['update-index', '--index-info'], indexInfo)
      const sha = gitIdx(['write-tree']).trim()
      rmSync(nodePath.dirname(indexFile), { recursive: true, force: true })
      return json(201, { sha })
    }
    // blobs
    m = rest.match(/^blobs\/([0-9a-f]+)$/)
    if (m && method === 'GET') {
      let content
      try {
        content = git(['cat-file', 'blob', m[1]])
      } catch {
        return json(404, { message: 'Not Found' })
      }
      return json(200, { sha: m[1], size: content.length, encoding: 'base64', content: content.toString('base64') })
    }
    if (rest === 'blobs' && method === 'POST') {
      const content = body.encoding === 'base64' ? Buffer.from(body.content, 'base64') : Buffer.from(body.content, 'utf-8')
      const sha = gitText(['hash-object', '-w', '--stdin'], content).trim()
      return json(201, { sha })
    }
    return json(404, { message: `Not Found: ${method} ${url.pathname}` })
  }
  return { fetch: fetchImpl, calls }
}

/**
 * 共有リモート（bare リポジトリ）と、git 運用のマシン（clone）を用意するヘルパー。
 * @returns {{ dir: string, bareDir: string, clone: (name: string) => string, git: (cwd: string, ...args: string[]) => string }}
 */
export function setupBareRemote() {
  const dir = mkdtempSync(nodePath.join(tmpdir(), 'gh-means-'))
  const bareDir = nodePath.join(dir, 'remote.git')
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf-8' })
  git(dir, 'init', '--bare', '-b', 'main', bareDir)
  const configure = (repo) => {
    git(repo, 'config', 'user.email', 'test@example.com')
    git(repo, 'config', 'user.name', 'test')
    git(repo, 'config', 'commit.gpgsign', 'false')
  }
  const clone = (name) => {
    const repo = nodePath.join(dir, name)
    git(dir, 'clone', '-q', bareDir, repo)
    configure(repo)
    if (!git(repo, 'branch', '--list').trim()) {
      // 空のリモートを clone した直後は main が無い: 最初のコミットで作る
      git(repo, 'checkout', '-q', '-b', 'main')
      git(repo, 'commit', '-q', '--allow-empty', '-m', 'init')
      git(repo, 'push', '-q', '-u', 'origin', 'main')
    } else {
      git(repo, 'branch', '-q', '--set-upstream-to=origin/main', 'main')
    }
    return repo
  }
  const contentRoot = (name) => {
    const root = nodePath.join(dir, name)
    mkdirSync(root, { recursive: true })
    return root
  }
  return { dir, bareDir, clone, contentRoot, git }
}
