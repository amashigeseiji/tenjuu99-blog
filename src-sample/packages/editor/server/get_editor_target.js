import { IncomingMessage, ServerResponse } from 'http'
import fs from 'node:fs'
import config from '@tenjuu99/blog/lib/config.js'
import { pageDir } from '@tenjuu99/blog/lib/dir.js'

export const path = '/get_editor_target'

/**
 * @param {IncomingMessage} req
 * @param {ServerResponse} res
 */
export const get = async (req, res) => {
  const url = new URL(`${config.url_base}${req.url}`)
  const target = url.searchParams.get('md')
  if (!target) {
    return
  }
  const file = `${pageDir}/${target}`
  if (!fs.existsSync(`${file}`)) {
    return {
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ content: '', filename: target })
    }
  }
  const f = fs.readFileSync(`${file}`, 'utf8')
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ content: f, filename: target }),
  }
}
