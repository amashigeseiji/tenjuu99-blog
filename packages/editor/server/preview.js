import render from '@tenjuu99/blog/lib/render.js'
import makePageData from '@tenjuu99/blog/lib/pageData.js'
import { distDir, srcDir } from '@tenjuu99/blog/lib/dir.js'
import fs from 'node:fs'
import { createJsonPostHandler } from './handlerFoundation.js'

export const path = '/preview'

/**
 * @vocab プレビュー自己完結化
 * @test tests/editor/previewSelfContainment.test.js
 * <link rel="stylesheet"> タグを読み込んでインライン <style> に置換する。
 * プレビューiframeがサーバー再起動中のCSSリクエスト失敗を起こさないようにするため。
 * @param {string} html
 * @param {string[]} [dirs] スタイルシートを探すディレクトリ（既定は dist → src の順）
 * @returns {string}
 */
export function inlineStyles(html, dirs = [distDir, srcDir]) {
  return html.replace(
    /<link\b[^>]*\brel=["']stylesheet["'][^>]*\/?>/gi,
    (match) => {
      const hrefMatch = match.match(/\bhref=["']([^"']+)["']/)
      if (!hrefMatch) return match
      const href = hrefMatch[1]
      if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) {
        return match
      }
      const filePath = href.split('?')[0]
      for (const dir of dirs) {
        const fullPath = `${dir}${filePath}`
        if (fs.existsSync(fullPath)) {
          return `<style>${fs.readFileSync(fullPath, 'utf8')}</style>`
        }
      }
      return match
    }
  )
}

export const post = createJsonPostHandler('preview', async (json) => {
  const filename = json.inputFileName ? json.inputFileName : json.selectDataFile
  if (!filename) {
    return { status: 400, body: { message: 'filename is requried.' } }
  }
  const pageData = makePageData(filename, json.content)
  const rendered = await render(pageData.template, pageData)
  return { body: { preview: inlineStyles(rendered) } }
}, { errorBody: (message) => ({ message }) })
