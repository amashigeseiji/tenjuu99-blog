import { execFile } from 'node:child_process'
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
    }
  } catch (e) {
    // upstream 未設定など → getPublicationStatus が 'unknown' を返せるよう再スロー
    return {
      existsInRemote: async () => { throw e },
      diffFromRemote: async () => { throw e },
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
 * @vocab git公開手段
 * @test tests/publishing/publicationMeans.test.js
 * 公開手段の git による実現。原稿を公開物として送り、リモートへの反映を
 * commit と push で実行する。ビルドとサイトへの実反映はリモート側のデプロイ（CI/CD）に委ねる。
 * @param {string} cwd - git リポジトリのルートパス
 * @returns {Promise<import('./publicationMeans.js').PublicationMeans>}
 */
export async function createGitPublicationMeans(cwd) {
  return {
    remoteState: await createGitRemoteState(cwd),
    reflect: createGitReflect(cwd),
    deliverable: 'manuscript',
  }
}
