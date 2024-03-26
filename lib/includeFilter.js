import fs from "node:fs/promises";
import { minifyCss } from './minify.js'

const alreadyLoaded = {}

const includeFilter = async (text) => {
  let replaced = text
  const includeRegexp = new RegExp(/\{\s*include\('([\w\./]+)'\)\s*\}/g)
  const include = [...text.matchAll(includeRegexp)].map(matched => [matched[0], matched[1]])
  for (const index in include) {
    const [toBeReplace, filename] = [...include[index]]
    let content
    if (!alreadyLoaded[filename]) {
      content = await fs.readFile(filename, 'utf8')
      if (filename.endsWith('.css')) {
        content = minifyCss(content)
      }
      // include を再帰的に解決する
      if (content.match(includeRegexp)) {
        content = await includeFilter(content)
      }
      alreadyLoaded[filename] = content
    } else {
      content = alreadyLoaded[filename]
    }
    replaced = replaced.replace(toBeReplace, content)
  }
  return replaced
}
export default includeFilter
