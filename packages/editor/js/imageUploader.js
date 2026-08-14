/**
 * @vocab 画像アップローダー
 * @test tests/editor/editor-image-upload.test.js
 * 画像ファイルを base64 で #アップロードエンドポイント に送る。記事に紐づくアップロード
 * （ドロップ挿入用）と、記事に紐づかない追加（画像ライブラリからの追加）の2つの入口が
 * 同じ送信の定型を共有する。
 */

/** @param {File} file @returns {Promise<string>} */
const toBase64 = async (file) => {
  const buffer = await file.arrayBuffer()
  return btoa(new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), ''))
}

/**
 * @param {{ imageData: string, imageFilename: string, mdFile?: string }} payload
 * @param {typeof fetch} fetchFn
 * @returns {Promise<{ ok: boolean, json: object }>}
 */
const postImage = async (payload, fetchFn) => {
  const res = await fetchFn('/upload-image', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, json }
}

/**
 * 記事に紐づくアップロード。成功時は本文に挿入する Markdown 参照URLを返す。
 * @param {File} file
 * @param {string} mdFile
 * @param {typeof fetch} [fetchFn]
 * @returns {Promise<string|null>}
 */
export const uploadImage = async (file, mdFile, fetchFn = (...a) => fetch(...a)) => {
  const imageData = await toBase64(file)
  const { ok, json } = await postImage({ imageData, imageFilename: file.name, mdFile }, fetchFn)
  return ok ? json.markdownUrl : null
}

/**
 * 記事に紐づかない追加（画像ライブラリからの追加）。mdFile を送らず、
 * 配置パス（image/ 相対・ディレクトリ階層可）を imageFilename として送る。
 * @param {File} file
 * @param {string} destPath
 * @param {typeof fetch} [fetchFn]
 * @returns {Promise<{ ok: boolean, imagePath?: string, message?: string }>}
 */
export const addLibraryImage = async (file, destPath, fetchFn = (...a) => fetch(...a)) => {
  const imageData = await toBase64(file)
  const { ok, json } = await postImage({ imageData, imageFilename: destPath }, fetchFn)
  return ok ? { ok: true, imagePath: json.imagePath } : { ok: false, message: json.message }
}
