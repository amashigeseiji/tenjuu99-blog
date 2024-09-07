import { IncomingMessage, ServerResponse } from 'http'
import { styleText } from 'node:util'

const render = (await import('../../lib/render.js')).default
const makePageData = (await import('../../lib/pageData.js')).default

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
