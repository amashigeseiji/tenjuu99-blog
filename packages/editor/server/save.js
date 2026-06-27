import { IncomingMessage, ServerResponse } from 'http'
import fs from 'node:fs'
import { styleText } from 'node:util'
import { watch, pageDir as cachePageDir } from '@tenjuu99/blog/lib/dir.js'
import { indexing } from '@tenjuu99/blog/lib/indexer.js'

export const path = '/save'

/**
 * @vocab SaveEndpoint (plans/editor-ui-cleanup/dictionary.md#保存エンドポイント)
 * @test tests/editor/editor-ui-cleanup.test.js
 * @param {string} filename
 * @param {string} content
 * @param {string} pageDir
 * @param {{ createOnly?: boolean }} [options]
 * @returns {Promise<{success: true}|{success: false, error: string}>}
 */
export async function saveFile(filename, content, pageDir, options = {}) {
  const parts = filename.split('/')
  const basename = parts.pop()
  const dir = [pageDir, ...parts].join('/')
  const filepath = `${dir}/${basename}`
  if (options.createOnly && fs.existsSync(filepath)) {
    return { success: false, error: 'ファイルが既に存在します' }
  }
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(filepath, content)
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
      const result = await saveFile(json.filename, json.content ?? '', watch.pageDir, { createOnly: !!json.createOnly })
      if (!result.success) {
        res.writeHead(409, { 'content-type': 'application/json' })
        res.end(JSON.stringify(result))
        return
      }
      if (json.createOnly) {
        // .cache/pages/ にも書き込んで indexing() が新規ファイルを認識できるようにする
        const cacheParts = json.filename.split('/')
        const cacheBasename = cacheParts.pop()
        const cacheDirPath = [cachePageDir, ...cacheParts].join('/')
        if (!fs.existsSync(cacheDirPath)) fs.mkdirSync(cacheDirPath, { recursive: true })
        fs.writeFileSync(`${cacheDirPath}/${cacheBasename}`, json.content ?? '')
        await indexing()
      }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ success: true }))
    })
  return true
}
