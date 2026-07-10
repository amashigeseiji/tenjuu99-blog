import nodePath from 'node:path'
import config from '@tenjuu99/blog/lib/config.js'
import { rootDir } from '@tenjuu99/blog/lib/dir.js'
import { getPublicationStatus } from './publicationStatus.js'
import { resolveRemoteState } from '@tenjuu99/blog/lib/publishing/remoteStateResolver.js'

export const path = '/publication-status'

export const get = async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const md = url.searchParams.get('md')
  if (!md) {
    res.writeHead(400, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'md パラメータが必要です' }))
    return true
  }
  const pagesPrefix = `${config.src_dir}/pages`
  const filePath = nodePath.normalize(`${config.src_dir}/pages/${md}`)
  if (!filePath.startsWith(pagesPrefix + '/') && !filePath.startsWith(pagesPrefix + nodePath.sep)) {
    res.writeHead(400, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: '不正なファイルパスです' }))
    return true
  }
  const remoteState = await resolveRemoteState({ means: config.publish?.means, cwd: rootDir })
  const status = await getPublicationStatus(filePath, remoteState)
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ status }))
  return true
}
