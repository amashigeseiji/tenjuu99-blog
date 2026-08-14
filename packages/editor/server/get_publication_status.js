import nodePath from 'node:path'
import config from '@tenjuu99/blog/lib/config.js'
import { rootDir } from '@tenjuu99/blog/lib/dir.js'
import { getPublicationStatus } from './publicationStatus.js'
import { resolveRemoteState } from '@tenjuu99/blog/lib/publishing/remoteStateResolver.js'
import { createJsonGetHandler } from './handlerFoundation.js'

export const path = '/publication-status'

export const get = createJsonGetHandler('publication-status', async (url) => {
  const md = url.searchParams.get('md')
  if (!md) {
    return { status: 400, body: { error: 'md パラメータが必要です' } }
  }
  const pagesPrefix = `${config.src_dir}/pages`
  const filePath = nodePath.normalize(`${config.src_dir}/pages/${md}`)
  if (!filePath.startsWith(pagesPrefix + '/') && !filePath.startsWith(pagesPrefix + nodePath.sep)) {
    return { status: 400, body: { error: '不正なファイルパスです' } }
  }
  const remoteState = await resolveRemoteState({ means: config.publish?.means, cwd: rootDir })
  const status = await getPublicationStatus(filePath, remoteState)
  return { body: { status } }
})
