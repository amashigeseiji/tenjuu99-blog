import config from './config.js'
import { existsSync } from 'node:fs'
import { helperDir } from './dir.js'

const helper = {}

// top-level await を使うと循環依存がある場合に ESM のデッドロックが発生するため IIFE を使用する。
// helperReady をエクスポートすることで、ヘルパーのロード完了を外部から await できる。
// （Promise は一度 resolve すれば以降の await は即座に返るため、複数箇所で await しても問題ない）
export const helperReady = (async () => {
  if (config.helper) {
    const files = config.helper.split(',')
    for (const file of files) {
      if (existsSync(`${helperDir}/${file}`)) {
        const helperAdditional = await import(`${helperDir}/${file}`)
        Object.assign(helper, helperAdditional)
      }
    }
  }
})()

export default helper
