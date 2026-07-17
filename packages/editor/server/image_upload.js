import fs from 'node:fs'
import nodePath from 'node:path'
import { styleText } from 'node:util'
import config from '@tenjuu99/blog/lib/config.js'
import { createConverter } from './createConverter.js'
import { recordAddition } from './imageLedger.js'
import { parseJsonBody } from '@tenjuu99/blog/lib/server/helper/parseRequestBody.js'

const rootDir = process.cwd()
const srcDir = nodePath.join(rootDir, config.src_dir)
export const imageLedgerPath = nodePath.join(srcDir, 'image-library.json')

export const path = '/upload-image'

const converterPromise = createConverter(config.image_converter ?? null)

const MAX_BODY_SIZE = 10 * 1024 * 1024 // 10MB

/**
 * @vocab: アップロードエンドポイント
 * @test: tests/editor/editor-image-upload.test.js
 */
export const post = async (req, res) => {
  let json
  try {
    json = await parseJsonBody(req, { maxSize: MAX_BODY_SIZE })
  } catch (e) {
    const status = e.code === 'PAYLOAD_TOO_LARGE' ? 413 : 400
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ message: e.message }))
    return true
  }

  try {
    // mdFile は省略可: 省略時は記事に紐づかない追加（画像ライブラリからの追加）として扱う
    const { imageData, imageFilename, mdFile } = json
    if (!imageData || !imageFilename) {
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ message: '必須パラメーターが不足しています' }))
      return true
    }
    const { fn, ext } = await converterPromise
    const result = await handleImageUpload({ imageData, imageFilename, mdFile }, { converterFn: fn, outputExt: ext, ledgerPath: imageLedgerPath })
    console.log(styleText('blue', '[upload-image] finished'))
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(result))
  } catch (e) {
    if (e.code === 'DUPLICATE_IMAGE' || e.code === 'INVALID_IMAGE_PATH') {
      res.writeHead(e.code === 'DUPLICATE_IMAGE' ? 409 : 400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ message: e.message }))
      return true
    }
    console.error(e)
    res.writeHead(500, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ message: '画像のアップロードに失敗しました' }))
  }
  return true
}

export { createConverter }

/**
 * @vocab: パスリゾルバー
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
 * @vocab: パスリゾルバー
 * @test: tests/editor/editor-image-upload.test.js
 * 記事に紐づかない画像（ライブラリ追加）の保存先を、指定された配置パスから導出する。
 * 配置パスは image/ 配下の相対パスとして解釈し、ディレクトリ階層を保持する。
 * @param {string} destPath - image/ 配下の相対配置パス（例: `photos/2026/test.jpg`）
 * @param {string|null} [outputExt] - 出力拡張子（null のとき元の拡張子を保持）
 * @returns {{ saveSubPath: string, markdownUrl: string }}
 */
export function resolveLibraryImagePath(destPath, outputExt = null) {
  const normalized = nodePath.normalize(destPath)
  if (nodePath.isAbsolute(normalized) || normalized.startsWith('..')) {
    const err = new Error(`不正な配置パス: ${destPath}`)
    err.code = 'INVALID_IMAGE_PATH'
    throw err
  }
  const originalExt = nodePath.basename(normalized).match(/\.[^.]+$/)?.[0] ?? ''
  const finalExt = outputExt != null ? `.${outputExt}` : originalExt
  const withoutExt = normalized.slice(0, normalized.length - originalExt.length)
  const imageSubPath = `image/${withoutExt}${finalExt}`
  return {
    saveSubPath: imageSubPath,
    markdownUrl: `/${imageSubPath}`
  }
}

/**
 * @vocab: ファイルライター
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
 * @vocab: アップロードエンドポイント
 * @vocab: 画像台帳
 * @test: tests/editor/editor-image-upload.test.js
 * @test: tests/editor/image-library.test.js
 * `options.ledgerPath` が渡された場合、保存した画像パスを画像台帳に追加日時として記録する
 * （画像ライブラリの一覧で「エディタ経由で追加された画像」の追加日時に使われる）。
 * `mdFile` を省略した場合は記事に紐づかない追加（画像ライブラリからの追加）として扱い、
 * `imageFilename` を配置パス（image/ 相対・ディレクトリ階層可）として解釈する。
 * このとき既存の画像は上書きせず、同名の保存先が存在すればエラー（code: DUPLICATE_IMAGE）になる。
 * @param {{ imageData: string, imageFilename: string, mdFile?: string }} payload
 * @param {{ converterFn?: Function, outputExt?: string|null, baseDir?: string, ledgerPath?: string }} [options]
 * @returns {Promise<{ markdownUrl: string, imagePath: string }>}
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
  const { saveSubPath, markdownUrl } = mdFile
    ? resolveImagePath(mdFile, imageFilename, outputExt)
    : resolveLibraryImagePath(imageFilename, outputExt)
  if (!mdFile && fs.existsSync(nodePath.resolve(baseDir, saveSubPath))) {
    const err = new Error('同名のファイルが既に存在します')
    err.code = 'DUPLICATE_IMAGE'
    throw err
  }
  const converted = await converterFn(buffer)
  writeImageFile(saveSubPath, converted, baseDir)
  if (options.ledgerPath) {
    recordAddition(options.ledgerPath, saveSubPath)
  }
  return { markdownUrl, imagePath: saveSubPath }
}
