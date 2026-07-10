import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import nodePath from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * リモート（git のリモートリポジトリ）の現在の内容を参照する読み取り専用の抽象を作る。
 * @param {string} cwd - git リポジトリのルートパス
 * @returns {Promise<import('./publicationMeans.js').RemoteState>}
 */
async function createGitRemoteState(cwd) {
  try {
    const { stdout: refOut } = await execFileAsync(
      'git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { cwd }
    )
    const ref = refOut.trim()
    const [{ stdout: treeOut }, { stdout: diffOut }] = await Promise.all([
      execFileAsync('git', ['ls-tree', '-r', '--name-only', ref], { cwd }),
      execFileAsync('git', ['diff', '--name-only', ref], { cwd }),
    ])
    const remoteFiles = new Set(treeOut.trim().split('\n').filter(Boolean))
    const modifiedFiles = new Set(diffOut.trim().split('\n').filter(Boolean))
    return {
      existsInRemote: async (filePath) => remoteFiles.has(filePath),
      diffFromRemote: async (filePath) => modifiedFiles.has(filePath) ? 'modified' : '',
      // 構築後の refreshRemote（fetch）を反映できるよう、一覧は都度参照する
      listRemoteFiles: async () => {
        const { stdout } = await execFileAsync('git', ['ls-tree', '-r', '--name-only', ref], { cwd })
        return stdout.trim().split('\n').filter(Boolean)
      },
    }
  } catch (e) {
    // upstream 未設定など → getPublicationStatus が 'unknown' を返せるよう再スロー
    return {
      existsInRemote: async () => { throw e },
      diffFromRemote: async () => { throw e },
      listRemoteFiles: async () => { throw e },
    }
  }
}

/**
 * ローカルの公開物（原稿）をリモートへ反映する実行体を作る。
 * 変更がない（コミット不要）場合は何もせず成功とみなす。
 * @param {string} cwd - git リポジトリのルートパス
 * @returns {(files: string[]) => Promise<{ success: boolean, error?: string }>}
 */
function createGitReflect(cwd) {
  return async (files) => {
    await execFileAsync('git', ['add', '--', ...files], { cwd })
    const { stdout } = await execFileAsync('git', ['diff', '--cached', '--name-only'], { cwd })
    if (!stdout.trim()) return { success: true }
    await execFileAsync('git', ['commit', '-m', 'publish'], { cwd })
    try {
      await execFileAsync('git', ['push'], { cwd })
      return { success: true }
    } catch (error) {
      return { success: false, error: error.stderr || error.message }
    }
  }
}

/**
 * リモート（git の上流）からファイルを取り除く実行体を作る。索引からの除去のみで
 * 手元の実ファイルには関与しない（原稿は残る）。取り除くものが無ければ何もせず成功とみなす。
 * @param {string} cwd - git リポジトリのルートパス
 * @returns {(files: string[]) => Promise<{ success: boolean, error?: string }>}
 */
function createGitRemove(cwd) {
  return async (files) => {
    try {
      await execFileAsync('git', ['rm', '--cached', '--ignore-unmatch', '-q', '--', ...files], { cwd })
      const { stdout } = await execFileAsync('git', ['diff', '--cached', '--name-only'], { cwd })
      if (!stdout.trim()) return { success: true }
      await execFileAsync('git', ['commit', '-q', '-m', 'unpublish'], { cwd })
      await execFileAsync('git', ['push', '-q'], { cwd })
      return { success: true }
    } catch (error) {
      return { success: false, error: error.stderr || error.message }
    }
  }
}

/**
 * リモートの内容をローカルへ反映する実行体を作る。
 * 手元に未送信のコミットが無く履歴ごと進められるときは進め（以後の公開を妨げないため）、
 * 進められないときは対象ファイルだけを取り出す。索引は汚さない（次の公開に巻き込まれないため）。
 * @param {string} cwd - git リポジトリのルートパス
 * @returns {(files: string[]) => Promise<{ success: boolean, error?: string }>}
 */
function createGitTakeFromRemote(cwd) {
  return async (files) => {
    if (files.length === 0) return { success: true }
    try {
      let fastForwarded = false
      try {
        const { stdout } = await execFileAsync('git', ['rev-list', '@{u}..HEAD'], { cwd })
        if (!stdout.trim()) {
          await execFileAsync('git', ['merge', '--ff-only', '-q', '@{u}'], { cwd })
          fastForwarded = true
        }
      } catch {
        // 手元の変更と重なる等で履歴を進められない → 対象ファイルだけ取り出す
      }
      if (!fastForwarded) {
        await execFileAsync('git', ['checkout', '@{u}', '--', ...files], { cwd })
        await execFileAsync('git', ['restore', '--staged', '--', ...files], { cwd })
      }
      return { success: true }
    } catch (error) {
      return { success: false, error: error.stderr || error.message }
    }
  }
}

/**
 * ファイルごとの版の連なり（先後関係の読み）を参照する実行体を作る。
 * 手元・上流・共通の祖先の3点の内容を突き合わせて判定する。
 * @param {string} cwd - git リポジトリのルートパス
 * @returns {(filePath: string) => Promise<import('./publicationMeans.js').Lineage>}
 */
function createGitLineageOf(cwd) {
  const blobOf = async (ref, filePath) => {
    try {
      const { stdout } = await execFileAsync('git', ['rev-parse', `${ref}:${filePath}`], { cwd })
      return stdout.trim()
    } catch {
      return null
    }
  }
  const baseBlobOf = async (filePath) => {
    try {
      const { stdout } = await execFileAsync('git', ['merge-base', 'HEAD', '@{u}'], { cwd })
      return await blobOf(stdout.trim(), filePath)
    } catch {
      return null
    }
  }
  return async (filePath) => {
    const [remoteBlob, headBlob] = await Promise.all([
      blobOf('@{u}', filePath),
      blobOf('HEAD', filePath),
    ])
    let localBlob = null
    if (existsSync(nodePath.join(cwd, filePath))) {
      const { stdout } = await execFileAsync('git', ['hash-object', '--', filePath], { cwd })
      localBlob = stdout.trim()
    }
    if (localBlob === null) {
      if (remoteBlob === null) return 'localOnly'
      if (headBlob !== null) return 'deletedLocally'
      // HEAD にも無い: 共通の祖先が知っていれば手元の履歴で消されたもの、知らなければ他所で作られたもの
      return (await baseBlobOf(filePath)) !== null ? 'deletedLocally' : 'remoteOnly'
    }
    if (remoteBlob === null) return 'localOnly'
    if (localBlob === remoteBlob) return 'same'
    const baseBlob = await baseBlobOf(filePath)
    const remoteChanged = remoteBlob !== baseBlob
    const localChanged = localBlob !== baseBlob
    if (remoteChanged && localChanged) return 'diverged'
    return remoteChanged ? 'remoteAhead' : 'localAhead'
  }
}

/**
 * @vocab git公開手段
 * @test tests/publishing/publicationMeans.test.js
 * @test tests/publishing/sync.test.js
 * 公開手段の git による実現。原稿を公開物として送り、リモートへの反映を
 * commit と push で実行する。ビルドとサイトへの実反映はリモート側のデプロイ（CI/CD）に委ねる。
 * 除去・取り込み・版の連なりの参照も git の履歴を使って実現する。
 * @param {string} cwd - git リポジトリのルートパス
 * @returns {Promise<import('./publicationMeans.js').PublicationMeans>}
 */
export async function createGitPublicationMeans(cwd) {
  return {
    remoteState: await createGitRemoteState(cwd),
    reflect: createGitReflect(cwd),
    remove: createGitRemove(cwd),
    takeFromRemote: createGitTakeFromRemote(cwd),
    lineageOf: createGitLineageOf(cwd),
    refreshRemote: async () => {
      try {
        await execFileAsync('git', ['fetch', '-q'], { cwd })
        return { success: true }
      } catch (error) {
        return { success: false, error: error.stderr || error.message }
      }
    },
    deliverable: 'manuscript',
  }
}
