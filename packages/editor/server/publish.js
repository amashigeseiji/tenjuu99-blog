import fs from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { styleText } from 'node:util'
import config from '@tenjuu99/blog/lib/config.js'
import { rootDir, srcDir } from '@tenjuu99/blog/lib/dir.js'
import { collectTarget } from './publishTargetCollector.js'
import { reflect } from './changeReflector.js'

const execFileAsync = promisify(execFile)

/**
 * @vocab PublishHandler (plans/editor-publish/dictionary.md#公開ハンドラー)
 * @test tests/editor/publish.test.js
 */
export async function handlePublish({ filePath, fileContent, srcDir: srcDirParam = 'src' }, publishActions) {
  const target = collectTarget(filePath, fileContent, srcDirParam)
  return await reflect([target.markdownFile, ...target.imageFiles], publishActions)
}

/**
 * @vocab PublishedState (plans/editor-publish/dictionary.md#公開済み状態)
 * リモートの現在の内容を参照する読み取り専用の抽象
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
      try {
        const ref = await getUpstreamRef()
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

function createGitPublishActions(cwd) {
  return {
    commit: async (files) => {
      await execFileAsync('git', ['add', '--', ...files], { cwd })
      const { stdout } = await execFileAsync('git', ['diff', '--cached', '--name-only'], { cwd })
      if (!stdout.trim()) return
      await execFileAsync('git', ['commit', '-m', 'publish'], { cwd })
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
        const body = JSON.parse(chunks.join())
        const { filePath, fileContent } = body
        if (!filePath) {
          res.writeHead(400, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: 'ファイル名がありません' }))
          return
        }
        const content = fileContent ?? fs.readFileSync(`${srcDir}/pages/${filePath}`, 'utf-8')
        if (fileContent) {
          const dir = `${srcDir}/pages/${filePath}`.split('/').slice(0, -1).join('/')
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
          fs.writeFileSync(`${srcDir}/pages/${filePath}`, fileContent)
        }
        const publishActions = createGitPublishActions(rootDir)
        const result = await handlePublish(
          { filePath, fileContent: content, srcDir: config.src_dir },
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
