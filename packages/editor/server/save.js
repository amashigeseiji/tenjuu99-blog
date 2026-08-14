import { IncomingMessage, ServerResponse } from 'http'
import fs from 'node:fs'
import { styleText } from 'node:util'
import { watch, pageDir as cachePageDir } from '@tenjuu99/blog/lib/dir.js'
import { indexing } from '@tenjuu99/blog/lib/indexer.js'
import { createJsonPostHandler } from './handlerFoundation.js'

export const path = '/save'

const MAX_BODY_SIZE = 1 * 1024 * 1024 // 1MB

/**
 * `..` や空セグメント等のパストラバーサル要素を含む場合はエラーメッセージを返す。
 * @param {string} filename
 * @returns {string|null} エラーメッセージ、問題なければ null
 */
function validateFilename(filename) {
  if (!filename || typeof filename !== 'string') return 'ファイル名がありません'
  const parts = filename.split('/')
  for (const part of parts) {
    if (part === '' || part === '.' || part === '..') return '不正なパスが含まれています'
    if (part.includes('\\')) return '不正なパスが含まれています'
  }
  return null
}

/**
 * @vocab 保存エンドポイント
 * @test tests/editor/editor-ui-cleanup.test.js
 * @param {string} filename
 * @param {string} content
 * @param {string} pageDir
 * @param {{ createOnly?: boolean }} [options]
 * @returns {Promise<{success: true}|{success: false, error: string, code?: string}>}
 */
export async function saveFile(filename, content, pageDir, options = {}) {
  const validationError = validateFilename(filename)
  if (validationError) {
    return { success: false, error: validationError, code: 'INVALID_FILENAME' }
  }
  const parts = filename.split('/')
  const basename = parts.pop()
  const dir = [pageDir, ...parts].join('/')
  const filepath = `${dir}/${basename}`
  if (options.createOnly && fs.existsSync(filepath)) {
    return { success: false, error: 'ファイルが既に存在します', code: 'FILE_EXISTS' }
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
export const post = createJsonPostHandler('save', async (json) => {
  if (!json.filename) {
    return { status: 400, body: { error: 'ファイル名がありません' } }
  }

  const result = await saveFile(json.filename, json.content ?? '', watch.pageDir, { createOnly: !!json.createOnly })
  if (!result.success) {
    return { status: result.code === 'FILE_EXISTS' ? 409 : 400, body: result }
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
  return { body: { success: true } }
}, { maxSize: MAX_BODY_SIZE, errorBody: (message) => ({ error: message }) })
