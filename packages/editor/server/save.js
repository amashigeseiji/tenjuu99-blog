import { IncomingMessage, ServerResponse } from 'http'
import fs from 'node:fs'
import { styleText } from 'node:util'
import { watch } from '@tenjuu99/blog/lib/dir.js'

export const path = '/save'

/**
 * @vocab SaveEndpoint (plans/editor-ui-cleanup/dictionary.md#保存エンドポイント)
 * @test tests/editor/editor-ui-cleanup.test.js
 * @param {string} filename
 * @param {string} content
 * @param {string} pageDir
 * @returns {Promise<{success: true}>}
 */
export async function saveFile(filename, content, pageDir) {
  const parts = filename.split('/')
  const basename = parts.pop()
  const dir = [pageDir, ...parts].join('/')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(`${dir}/${basename}`, content)
  console.log(styleText('blue', `[save] ${filename}`))
  return { success: true }
}

/**
 * @param {IncomingMessage} req
 * @param {ServerResponse} res
 */
export const post = async (req, res) => {
  const chunks = []
  req
    .on('data', (chunk) => chunks.push(chunk))
    .on('end', async () => {
      const json = JSON.parse(chunks.join())
      if (!json.filename) {
        res.writeHead(400, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'ファイル名がありません' }))
        return
      }
      await saveFile(json.filename, json.content ?? '', watch.pageDir)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ success: true }))
    })
  return true
}
