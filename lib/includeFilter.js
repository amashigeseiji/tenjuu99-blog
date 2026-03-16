import { minifyCss } from './minify.js'
import { templateDir, cssDir } from './dir.js'
import { staticFile } from './files.js'

const alreadyLoaded = {}

// 正規表現をモジュールレベルでキャッシュ
const INCLUDE_REGEXP = /\{\s*include\('(template|css)\/([\w\./-]+)'\)\s*\}/g

const includeFilter = (text) => {
  let replaced = text
  const include = [...text.matchAll(INCLUDE_REGEXP)].map(matched => {
    return { toBeReplace: matched[0], type: matched[1], filename: matched[2] }
  })
  if (include.length === 0) {
    return replaced
  }
  for (const index in include) {
    const {toBeReplace, type, filename} = include[index]
    let content
    const cacheKey = `${type}/${filename}`
    if (!alreadyLoaded[cacheKey]) {
      content = staticFile(cacheKey)
      if (typeof content === 'undefined') {
        throw new Error(cacheKey + ' is not found')
      }
      if (content instanceof Promise) {
        throw new Error(cacheKey + ' is invalid')
      }
      // include を再帰的に解決する
      if (content.match(INCLUDE_REGEXP)) {
        content = includeFilter(content)
      }
      alreadyLoaded[cacheKey] = content
    } else {
      content = alreadyLoaded[cacheKey]
    }
    replaced = replaced.replace(toBeReplace, content)
  }
  return replaced
}
export default includeFilter
