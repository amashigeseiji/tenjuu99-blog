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
export async function handlePublish({ filePath, fileContent, srcDir: srcDirParam = 'src' }, publishedState) {
  const target = collectTarget(filePath, fileContent, srcDirParam)
  return await reflect([target.markdownFile, ...target.imageFiles], publishedState)
}

function createGitPublishedState(cwd) {
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
        const { filePath } = JSON.parse(chunks.join())
        if (!filePath) {
          res.writeHead(400, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: 'ファイル名がありません' }))
          return
        }
        const fileContent = fs.readFileSync(`${srcDir}/pages/${filePath}`, 'utf-8')
        const publishedState = createGitPublishedState(rootDir)
        const result = await handlePublish(
          { filePath, fileContent, srcDir: config.src_dir },
          publishedState
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
