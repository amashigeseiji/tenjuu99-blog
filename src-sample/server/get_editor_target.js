import { IncomingMessage, ServerResponse } from 'http'
import fs from 'node:fs'

const rootDir = process.cwd()
const config = (await import(rootDir + '/lib/config.js')).default
const pageDir = (await import(rootDir + '/lib/dir.js')).pageDir

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
    return false
  }
  const f = fs.readFileSync(`${file}`, 'utf8')
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ content: f, filename: target }),
  }
}
