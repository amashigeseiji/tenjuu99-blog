import fs from 'node:fs'
import nodePath from 'node:path'
import { styleText } from 'node:util'
import config from '@tenjuu99/blog/lib/config.js'

const rootDir = process.cwd()
const srcDir = nodePath.join(rootDir, config.src_dir)

export const path = '/upload-image'

const converterPromise = createConverter(config.image_converter ?? null)

const MAX_BODY_SIZE = 10 * 1024 * 1024 // 10MB

/**
 * @vocab: アップロードエンドポイント (docs/dictionary.md#アップロードエンドポイント)
 * @test: tests/editor/editor-image-upload.test.js
 */
export const post = async (req, res) => {
  const chunks = []
  let totalSize = 0
  let aborted = false
  req
    .on('data', chunk => {
      if (aborted) return
      totalSize += chunk.length
      if (totalSize > MAX_BODY_SIZE) {
        aborted = true
        res.writeHead(413, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ message: 'ファイルサイズが上限を超えています' }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    .on('end', async () => {
      if (aborted) return
      try {
        const { imageData, imageFilename, mdFile } = JSON.parse(chunks.join(''))
        if (!imageData || !imageFilename || !mdFile) {
          res.writeHead(400, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ message: '必須パラメーターが不足しています' }))
          return
        }
        const { fn, ext } = await converterPromise
        const result = await handleImageUpload({ imageData, imageFilename, mdFile }, { converterFn: fn, outputExt: ext })
        console.log(styleText('blue', '[upload-image] finished'))
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(result))
      } catch (e) {
        console.error(e)
        res.writeHead(500, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ message: '画像のアップロードに失敗しました' }))
      }
    })
  return true
}

/**
 * @vocab: コンバーターファクトリー (docs/dictionary.md#コンバーターファクトリー)
 * @vocab: 画像コンバーター (docs/dictionary.md#画像コンバーター)
 * @test: tests/editor/editor-image-upload.test.js
 * @param {Function|string|null} converterOrName - 関数、ユーザーパス（./で始まる）、またはビルトイン名
 * @returns {Promise<{ fn: Function, ext: string|null }>}
 */
export async function createConverter(converterOrName = null) {
  if (!converterOrName) return { fn: (buffer) => buffer, ext: null }
  if (typeof converterOrName === 'function') return { fn: converterOrName, ext: null }
  try {
    let module
    if (converterOrName.startsWith('.') || nodePath.isAbsolute(converterOrName)) {
      module = await import(nodePath.resolve(rootDir, converterOrName))
    } else {
      module = await import(`./converters/${converterOrName}.js`)
    }
    return { fn: module.default, ext: module.ext ?? null }
  } catch {
    return { fn: (buffer) => buffer, ext: null }
  }
}

/**
 * @vocab: パスリゾルバー (docs/dictionary.md#パスリゾルバー)
 * @test: tests/editor/editor-image-upload.test.js
 * @param {string} mdFilePath
 * @param {string} imageFilename
 * @param {string|null} [outputExt] - 出力拡張子（null のとき元の拡張子を保持）
 * @returns {{ saveSubPath: string, markdownUrl: string }}
 */
export function resolveImagePath(mdFilePath, imageFilename, outputExt = null) {
  const normalizedMd = nodePath.normalize(mdFilePath)
  if (nodePath.isAbsolute(normalizedMd) || normalizedMd.startsWith('..')) {
    throw new Error(`不正な mdFilePath: ${mdFilePath}`)
  }
  const safeFilename = nodePath.basename(imageFilename)
  const mdSlug = normalizedMd.replace(/\.[^.]+$/, '')
  const imgBasename = safeFilename.replace(/\.[^.]+$/, '')
  const originalExt = safeFilename.match(/\.[^.]+$/)?.[0] ?? ''
  const finalExt = outputExt != null ? `.${outputExt}` : originalExt
  const imageSubPath = `image/${mdSlug}/${imgBasename}${finalExt}`
  return {
    saveSubPath: imageSubPath,
    markdownUrl: `/${imageSubPath}`
  }
}

/**
 * @vocab: ファイルライター (docs/dictionary.md#ファイルライター)
 * @test: tests/editor/editor-image-upload.test.js
 * @param {string} saveSubPath - src/ 以下の相対パス
 * @param {Buffer} data
 * @param {string} [baseDir]
 */
export function writeImageFile(saveSubPath, data, baseDir = srcDir) {
  const resolvedBase = nodePath.resolve(baseDir)
  const fullPath = nodePath.resolve(baseDir, saveSubPath)
  if (!fullPath.startsWith(resolvedBase + nodePath.sep)) {
    throw new Error(`保存先パスが許可ディレクトリ外です: ${saveSubPath}`)
  }
  fs.mkdirSync(nodePath.dirname(fullPath), { recursive: true })
  fs.writeFileSync(fullPath, data)
}

/**
 * @vocab: アップロードエンドポイント (docs/dictionary.md#アップロードエンドポイント)
 * @test: tests/editor/editor-image-upload.test.js
 * @param {{ imageData: string, imageFilename: string, mdFile: string }} payload
 * @param {{ converterFn?: Function, outputExt?: string|null, baseDir?: string }} [options]
 * @returns {Promise<{ markdownUrl: string }>}
 */
export async function handleImageUpload(payload, options = {}) {
  const { imageData, imageFilename, mdFile } = payload
  const baseDir = options.baseDir ?? srcDir

  let converterFn, outputExt
  if ('converterFn' in options) {
    converterFn = options.converterFn
    outputExt = options.outputExt ?? null
  } else {
    const created = await createConverter(config.image_converter ?? null)
    converterFn = created.fn
    outputExt = created.ext
  }

  const buffer = Buffer.from(imageData, 'base64')
  const { saveSubPath, markdownUrl } = resolveImagePath(mdFile, imageFilename, outputExt)
  const converted = await converterFn(buffer)
  writeImageFile(saveSubPath, converted, baseDir)
  return { markdownUrl }
}
