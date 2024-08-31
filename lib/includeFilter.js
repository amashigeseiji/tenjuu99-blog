import fs from "node:fs/promises";
import { minifyCss } from './minify.js'
import { templateDir, cssDir } from './dir.js'

const alreadyLoaded = {}

const includeFilter = async (text) => {
  let replaced = text
  const includeRegexp = new RegExp(/\{\s*include\('(template|css)\/([\w\./]+)'\)\s*\}/g)
  const include = [...text.matchAll(includeRegexp)].map(matched => [matched[0], matched[1], matched[2]])
  for (const index in include) {
    const [toBeReplace, type, filename] = [...include[index]]
    let content
    const cacheKey = `${type}/${filename}`
    if (!alreadyLoaded[cacheKey]) {
      switch (type) {
        case 'template':
          content = await fs.readFile(`${templateDir}/${filename}`, 'utf8')
          break
        case 'css':
          content = await fs.readFile(`${cssDir}/${filename}`, 'utf8')
          break
        default:
          throw new Error('type does not match neither `template` nor `css`.');
      }
      // include を再帰的に解決する
      if (content.match(includeRegexp)) {
        content = await includeFilter(content)
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
