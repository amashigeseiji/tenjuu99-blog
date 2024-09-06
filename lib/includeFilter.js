import { minifyCss } from './minify.js'
import { templateDir, cssDir } from './dir.js'
import { staticFile } from './files.js'

const alreadyLoaded = {}

const includeRegexp = new RegExp(/\{\s*include\('(template|css)\/([\w\./]+)'\)\s*\}/g)

const includeFilter = (text) => {
  let replaced = text
  const include = [...text.matchAll(includeRegexp)].map(matched => {
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
      // include を再帰的に解決する
      if (content.match(includeRegexp)) {
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
