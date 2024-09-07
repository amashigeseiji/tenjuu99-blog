import { IncomingMessage, ServerResponse } from 'http'
import { styleText } from 'node:util'
import render from '@tenjuu99/blog/lib/render.js'
import makePageData from '@tenjuu99/blog/lib/pageData.js'

export const path = '/preview'

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
      const pageData = makePageData(filename, json.content)
      const rendered = await render(pageData.template, pageData)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({
        'preview': rendered
      }))
    })
  return true
}
