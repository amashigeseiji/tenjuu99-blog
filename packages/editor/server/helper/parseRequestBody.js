/**
 * HTTP リクエストボディを JSON としてパースする共通ヘルパー。
 * Buffer.concat による安全な連結、サイズ制限、JSON.parse エラーハンドリングを提供する。
 *
 * @param {import('http').IncomingMessage} req
 * @param {{ maxSize?: number }} [options] maxSize: バイト上限（デフォルト: 無制限）
 * @returns {Promise<unknown>} パース済み JSON
 * @throws {{ message: string, code: 'PAYLOAD_TOO_LARGE' | 'INVALID_JSON' }} パース失敗時
 */
export function parseJsonBody(req, options = {}) {
  const { maxSize = Infinity } = options
  return new Promise((resolve, reject) => {
    const chunks = []
    let totalSize = 0
    let aborted = false
    req
      .on('data', chunk => {
        if (aborted) return
        totalSize += chunk.length
        if (totalSize > maxSize) {
          aborted = true
          req.destroy()
          const err = new Error('リクエストサイズが上限を超えています')
          err.code = 'PAYLOAD_TOO_LARGE'
          reject(err)
          return
        }
        chunks.push(chunk)
      })
      .on('end', () => {
        if (aborted) return
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString()))
        } catch {
          const err = new Error('リクエストボディのJSON解析に失敗しました')
          err.code = 'INVALID_JSON'
          reject(err)
        }
      })
      .on('error', reject)
  })
}
