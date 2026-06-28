import { readdirSync, existsSync } from 'node:fs'
import { watch, rootDir } from '@tenjuu99/blog/lib/dir.js'
import config from '@tenjuu99/blog/lib/config.js'
import { renderSidebarTree } from '../helper/sidebarTree.js'
import { collectStatuses } from './sidebarStatusCollector.js'
import { createGitPublishedState } from './publish.js'

export const path = '/get_sidebar'

function scanFiles(dir, prefix = '') {
  if (!existsSync(dir)) return []
  const entries = readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const sub = prefix ? `${prefix}/${entry.name}` : entry.name
      files.push(...scanFiles(`${dir}/${entry.name}`, sub))
    } else {
      const regexp = new RegExp(`\\.(${config.allowedSrcExt})$`)
      if (entry.name.match(regexp)) {
        const ext = entry.name.split('.').pop()
        const nameWithoutExt = entry.name.slice(0, -(ext.length + 1))
        files.push({
          name: prefix ? `${prefix}/${nameWithoutExt}` : nameWithoutExt,
          __filetype: ext,
          __is_auto_category: false,
        })
      }
    }
  }
  return files
}

/**
 * @vocab サイドバー取得エンドポイント
 */
export const get = async (req, res) => {
  const files = scanFiles(watch.pageDir)
  const publishedState = await createGitPublishedState(rootDir)
  const fileMappings = files.map(f => ({
    treePath: `${f.name}.${f.__filetype}`,
    gitPath: `${config.src_dir}/pages/${f.name}.${f.__filetype}`,
  }))
  const statusMap = await collectStatuses(fileMappings, publishedState)
  const html = renderSidebarTree(files, statusMap)
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ html })
  }
}
