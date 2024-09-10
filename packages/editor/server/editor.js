import { IncomingMessage, ServerResponse } from 'http'
import fs from 'node:fs/promises'
import { styleText } from 'node:util'
import config from '@tenjuu99/blog/lib/config.js'
import { watch } from '@tenjuu99/blog/lib/dir.js'

export const path = '/editor'

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
      const file = json.inputFileName ? json.inputFileName : json.selectDataFile
      if (!file) {
        res.writeHead(400, { 'content-type': 'application/json' })
        res.end(JSON.stringify({
          'message': 'ファイル名がありません'
        }))
        return
      }
      await fs.writeFile(`${watch.pageDir}/${file}`, json.content)
      console.log(styleText('blue', '[editor/post] finished'))

      const href = file.split('.')[0]
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({
        'href': `/${href}`
      }))
    })
  return true
}
