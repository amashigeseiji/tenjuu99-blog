import fs from 'node:fs'
import nodePath from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { styleText } from 'node:util'
import config from '@tenjuu99/blog/lib/config.js'
import { rootDir, srcDir } from '@tenjuu99/blog/lib/dir.js'
import { collectTarget } from './publishTargetCollector.js'
import { publish, update } from './changeReflector.js'
import { getPublicationStatus } from './publicationStatus.js'
import { parseJsonBody } from '@tenjuu99/blog/lib/server/helper/parseRequestBody.js'

const execFileAsync = promisify(execFile)

/**
 * @vocab: 公開ハンドラー
 * @test tests/editor/publish.test.js
 * @param {{ filePath: string, fileContent: string, srcDir?: string }} options
 * @param {import('./publicationStatus.js').PublishedState} publishedState
 * @param {import('./changeReflector.js').PublishActions} publishActions
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function handlePublish({ filePath, fileContent, srcDir: srcDirParam = 'src' }, publishedState, publishActions) {
  const target = collectTarget(filePath, fileContent, srcDirParam)
  const files = [target.markdownFile, ...target.imageFiles]
  const state = await getPublicationStatus(target.markdownFile, publishedState)
  if (state === 'new') return await publish(files, publishActions)
  if (state === 'modified') return await update(files, publishActions)
  if (state === 'unknown') return { success: false, error: 'リモートへの接続に失敗しました（upstream branch が未設定の可能性があります）' }
  // published 状態はローカルとリモートが一致しているため操作不要
  return { success: true }
}

/**
 * @vocab: 公開済み状態
 * リモートの現在の内容を参照する読み取り専用の抽象
 * @param {string} cwd - git リポジトリのルートパス
 * @returns {import('./publicationStatus.js').PublishedState}
 */
export async function createGitPublishedState(cwd) {
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
 * @param {string} cwd - git リポジトリのルートパス
 * @returns {import('./changeReflector.js').PublishActions}
 */
function createGitPublishActions(cwd) {
  return {
    commit: async (files) => {
      await execFileAsync('git', ['add', '--', ...files], { cwd })
      const { stdout } = await execFileAsync('git', ['diff', '--cached', '--name-only'], { cwd })
      if (!stdout.trim()) return false
      await execFileAsync('git', ['commit', '-m', 'publish'], { cwd })
      return true
    },
    push: async () => {
      try {
        await execFileAsync('git', ['push'], { cwd })
        return { success: true }
      } catch (error) {
        return { success: false, error: error.stderr || error.message }
      }
    }
  }
}

export const path = '/publish'

export const post = async (req, res) => {
  let body
  try {
    body = await parseJsonBody(req)
  } catch (e) {
    res.writeHead(400, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ success: false, error: e.message }))
    return true
  }
  try {
    const { filePath, fileContent } = body
    if (!filePath) {
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ success: false, error: 'ファイル名がありません' }))
      return true
    }
    const pagesDir = nodePath.join(srcDir, 'pages')
    const resolvedFilePath = nodePath.resolve(pagesDir, filePath)
    if (!resolvedFilePath.startsWith(pagesDir + nodePath.sep)) {
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ success: false, error: '不正なファイルパスです' }))
      return true
    }
    const content = fileContent != null ? fileContent : fs.readFileSync(`${srcDir}/pages/${filePath}`, 'utf-8')
    if (fileContent != null) {
      const dir = `${srcDir}/pages/${filePath}`.split('/').slice(0, -1).join('/')
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(`${srcDir}/pages/${filePath}`, fileContent)
    }
    const publishedState = await createGitPublishedState(rootDir)
    const publishActions = createGitPublishActions(rootDir)
    const result = await handlePublish(
      { filePath, fileContent: content, srcDir: config.src_dir },
      publishedState,
      publishActions
    )
    console.log(styleText(result.success ? 'green' : 'red', `[publish] ${filePath} ${result.success ? 'ok' : result.error}`))
    res.writeHead(result.success ? 200 : 500, { 'content-type': 'application/json' })
    res.end(JSON.stringify(result))
  } catch (error) {
    res.writeHead(500, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ success: false, error: error.message }))
  }
  return true
}
