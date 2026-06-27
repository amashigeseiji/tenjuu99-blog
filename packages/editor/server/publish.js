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

const execFileAsync = promisify(execFile)

/**
 * @vocab: 公開ハンドラー (docs/dictionary.md#公開ハンドラー)
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
 * @vocab: 公開済み状態 (docs/dictionary.md#公開済み状態)
 * リモートの現在の内容を参照する読み取り専用の抽象
 * @param {string} cwd - git リポジトリのルートパス
 * @returns {import('./publicationStatus.js').PublishedState}
 */
export function createGitPublishedState(cwd) {
  const getUpstreamRef = async () => {
    const { stdout } = await execFileAsync(
      'git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { cwd }
    )
    return stdout.trim()
  }
  return {
    existsInRemote: async (filePath) => {
      const ref = await getUpstreamRef()
      try {
        await execFileAsync('git', ['cat-file', '-e', `${ref}:${filePath}`], { cwd })
        return true
      } catch {
        return false
      }
    },
    diffFromRemote: async (filePath) => {
      const ref = await getUpstreamRef()
      const { stdout } = await execFileAsync('git', ['diff', ref, '--', filePath], { cwd })
      return stdout.trim()
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
  const chunks = []
  req
    .on('data', chunk => chunks.push(chunk))
    .on('end', async () => {
      try {
        const body = JSON.parse(chunks.join(''))
        const { filePath, fileContent } = body
        if (!filePath) {
          res.writeHead(400, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: 'ファイル名がありません' }))
          return
        }
        const pagesDir = nodePath.join(srcDir, 'pages')
        const resolvedFilePath = nodePath.resolve(pagesDir, filePath)
        if (!resolvedFilePath.startsWith(pagesDir + nodePath.sep)) {
          res.writeHead(400, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: '不正なファイルパスです' }))
          return
        }
        const content = fileContent != null ? fileContent : fs.readFileSync(`${srcDir}/pages/${filePath}`, 'utf-8')
        if (fileContent != null) {
          const dir = `${srcDir}/pages/${filePath}`.split('/').slice(0, -1).join('/')
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
          fs.writeFileSync(`${srcDir}/pages/${filePath}`, fileContent)
        }
        const publishedState = createGitPublishedState(rootDir)
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
    })
  return true
}
