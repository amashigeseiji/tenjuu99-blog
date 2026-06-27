import config from '@tenjuu99/blog/lib/config.js'
import { rootDir } from '@tenjuu99/blog/lib/dir.js'
import { getPublicationStatus } from './publicationStatus.js'
import { createGitPublishedState } from './publish.js'

export const path = '/publication-status'

export const get = async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const md = url.searchParams.get('md')
  if (!md) {
    res.writeHead(400, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'md パラメータが必要です' }))
    return true
  }
  const filePath = `${config.src_dir}/pages/${md}`
  const publishedState = createGitPublishedState(rootDir)
  const status = await getPublicationStatus(filePath, publishedState)
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ status }))
  return true
}
