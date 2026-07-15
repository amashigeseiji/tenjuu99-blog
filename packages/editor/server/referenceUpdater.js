const MARKDOWN_IMAGE_REGEXP = /!\[([^\]]*)\]\(\s*([^\s)]+)([^)]*)\)/g
const IMG_TAG_REGEXP = /<img\s([^>]*?)src=["']([^"']+)["']([^>]*)>/gi
const FRONTMATTER_REGEXP = /^(---\n)([\s\S]*?)(\n---\n?)/

function normalize(url) {
  return url.startsWith('/') ? url.slice(1) : url
}

function rewriteUrl(originalUrl, newImagePath) {
  return originalUrl.startsWith('/') ? `/${newImagePath}` : newImagePath
}

function replaceBodyReferences(body, targetImagePath, newImagePath) {
  let result = body.replace(MARKDOWN_IMAGE_REGEXP, (match, alt, url, rest) => {
    if (normalize(url) !== targetImagePath) return match
    if (newImagePath == null) return ''
    return `![${alt}](${rewriteUrl(url, newImagePath)}${rest})`
  })
  result = result.replace(IMG_TAG_REGEXP, (match, before, src, after) => {
    if (normalize(src) !== targetImagePath) return match
    if (newImagePath == null) return ''
    return `<img ${before}src="${rewriteUrl(src, newImagePath)}"${after}>`
  })
  return result
}

function unquote(value) {
  return value.replace(/^["']|["']$/g, '')
}

function quoteOf(value) {
  return value.startsWith('"') ? '"' : value.startsWith("'") ? "'" : ''
}

function replaceFrontmatterReferences(frontmatterBody, targetImagePath, newImagePath) {
  const lines = frontmatterBody.split('\n')
  const resultLines = []
  for (const line of lines) {
    const scalarMatch = line.match(/^(\s*[\w.-]+):\s*(.+)$/)
    if (scalarMatch) {
      const [, key, rawValue] = scalarMatch
      if (rawValue.trim().startsWith('[')) {
        try {
          const arr = JSON.parse(rawValue.trim())
          if (Array.isArray(arr) && arr.some(v => typeof v === 'string' && normalize(v) === targetImagePath)) {
            const newArr = arr
              .map(v => (typeof v === 'string' && normalize(v) === targetImagePath)
                ? (newImagePath == null ? null : rewriteUrl(v, newImagePath))
                : v)
              .filter(v => v !== null)
            resultLines.push(`${key}: ${JSON.stringify(newArr)}`)
            continue
          }
        } catch {
          // JSONとして解釈できない場合はスカラーとして扱う
        }
      }
      const unquoted = unquote(rawValue)
      if (normalize(unquoted) === targetImagePath) {
        if (newImagePath == null) continue
        const quote = quoteOf(rawValue)
        resultLines.push(`${key}: ${quote}${rewriteUrl(unquoted, newImagePath)}${quote}`)
        continue
      }
      resultLines.push(line)
      continue
    }
    const listItemMatch = line.match(/^(\s*-\s*)(.+)$/)
    if (listItemMatch) {
      const [, prefix, rawValue] = listItemMatch
      const unquoted = unquote(rawValue)
      if (normalize(unquoted) === targetImagePath) {
        if (newImagePath == null) continue
        const quote = quoteOf(rawValue)
        resultLines.push(`${prefix}${quote}${rewriteUrl(unquoted, newImagePath)}${quote}`)
        continue
      }
    }
    resultLines.push(line)
  }
  return resultLines.join('\n')
}

/**
 * @vocab: 参照更新器
 * @test tests/editor/image-library.test.js
 * 記事の内容から、指定した画像パスへの参照を除去する、または新しいパスに書き換える（#参照更新 を実現する）。
 * 本文（Markdown画像記法・imgタグ）とfrontmatterの両方の参照経路を対象にする。
 * @param {string} content - 記事の内容（frontmatterを含む）
 * @param {string} targetImagePath - 除去・書き換え対象の画像パス
 * @param {string|null} newImagePath - 書き換え先の画像パス。null のときは参照を除去する
 * @returns {string} 更新後の記事の内容
 */
export function updateReference(content, targetImagePath, newImagePath) {
  const target = normalize(targetImagePath)
  const match = content.match(FRONTMATTER_REGEXP)
  if (!match) {
    return replaceBodyReferences(content, target, newImagePath)
  }
  const [full, open, frontmatterBody, close] = match
  const newFrontmatterBody = replaceFrontmatterReferences(frontmatterBody, target, newImagePath)
  const body = content.slice(full.length)
  const newBody = replaceBodyReferences(body, target, newImagePath)
  return `${open}${newFrontmatterBody}${close}${newBody}`
}
