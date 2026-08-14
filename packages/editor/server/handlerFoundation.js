import { styleText } from 'node:util'
import { parseJsonBody } from '@tenjuu99/blog/lib/server/helper/parseRequestBody.js'

const defaultErrorBody = (message) => ({ success: false, error: message })

/**
 * @vocab ハンドラー基盤
 * @test tests/editor/handlerFoundation.test.js
 * JSON 応答の定型（ステータス・content-type・シリアライズ）を一か所に引き受ける。
 * @param {import('http').ServerResponse} res
 * @param {number} status
 * @param {object} payload
 */
export const respondJson = (res, status, payload) => {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(payload))
}

/**
 * @vocab ハンドラー基盤
 * @test tests/editor/handlerFoundation.test.js
 * JSON POST エンドポイントの定型（ボディ解釈→400/413、業務処理の例外→500、return true）を
 * 引き受け、各エンドポイントには業務処理（body を受け取り { status?, body } を返す）だけを書かせる。
 * @param {string} name ログ用のエンドポイント名
 * @param {(body: object) => Promise<{ status?: number, body: object }>} handle 業務処理
 * @param {{ maxSize?: number,
 *           errorBody?: (message: string) => object,
 *           catchBody?: (message: string) => object }} [options]
 *   errorBody: ボディ解釈エラー時の応答形（既定は { success: false, error }）。
 *   catchBody: 業務処理の例外時の応答形（既定は errorBody と同じ）。
 * @returns {(req: import('http').IncomingMessage, res: import('http').ServerResponse) => Promise<boolean>}
 */
export function createJsonPostHandler(name, handle, { maxSize, errorBody = defaultErrorBody, catchBody } = {}) {
  return async (req, res) => {
    let body
    try {
      body = await parseJsonBody(req, maxSize ? { maxSize } : {})
    } catch (e) {
      respondJson(res, e.code === 'PAYLOAD_TOO_LARGE' ? 413 : 400, errorBody(e.message))
      return true
    }
    try {
      const result = await handle(body)
      respondJson(res, result.status ?? 200, result.body)
    } catch (error) {
      console.log(styleText('red', `[${name}] エラー:`), error.message)
      respondJson(res, 500, (catchBody ?? errorBody)(error.message))
    }
    return true
  }
}

/**
 * @vocab ハンドラー基盤
 * @test tests/editor/handlerFoundation.test.js
 * JSON GET エンドポイントの定型（URL の解釈、業務処理の例外→500、return true）を引き受ける。
 * @param {string} name ログ用のエンドポイント名
 * @param {(url: URL) => Promise<{ status?: number, body: object }>} handle 業務処理
 * @param {{ errorBody?: (message: string) => object }} [options]
 * @returns {(req: import('http').IncomingMessage, res: import('http').ServerResponse) => Promise<boolean>}
 */
export function createJsonGetHandler(name, handle, { errorBody = defaultErrorBody } = {}) {
  return async (req, res) => {
    try {
      const result = await handle(new URL(req.url, 'http://localhost'))
      respondJson(res, result.status ?? 200, result.body)
    } catch (error) {
      console.log(styleText('red', `[${name}] エラー:`), error.message)
      respondJson(res, 500, errorBody(error.message))
    }
    return true
  }
}
