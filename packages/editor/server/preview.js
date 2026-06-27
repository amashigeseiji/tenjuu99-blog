import { IncomingMessage, ServerResponse } from 'http'
import { styleText } from 'node:util'
import render from '@tenjuu99/blog/lib/render.js'
import makePageData from '@tenjuu99/blog/lib/pageData.js'
import { distDir, srcDir } from '@tenjuu99/blog/lib/dir.js'
import fs from 'node:fs'

export const path = '/preview'

/**
 * <link rel="stylesheet"> タグを読み込んでインライン <style> に置換する。
 * プレビューiframeがサーバー再起動中のCSSリクエスト失敗を起こさないようにするため。
 * @param {string} html
 * @returns {string}
 */
function inlineStyles(html) {
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
      for (const dir of [distDir, srcDir]) {
        const fullPath = `${dir}${filePath}`
        if (fs.existsSync(fullPath)) {
          return `<style>${fs.readFileSync(fullPath, 'utf8')}</style>`
        }
      }
      return match
    }
  )
}

/**
 * @param {IncomingMessage} req
 * @param {ServerResponse} res
 */
export const post = async (req, res) => {
  const chunks = []
  req
    .on('data', (chunk) => chunks.push(chunk))
    .on('end', async () => {
      const json = JSON.parse(chunks.join())
      const filename = json.inputFileName ? json.inputFileName : json.selectDataFile
      if (!filename) {
        res.writeHead(400, { 'content-type': 'application/json' })
        return res.end(JSON.stringify({
          message: 'filename is requried.'
        }))
      }
      const pageData = makePageData(filename, json.content)
      const rendered = await render(pageData.template, pageData)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({
        'preview': inlineStyles(rendered)
      }))
    })
  return true
}
