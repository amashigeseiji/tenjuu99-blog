"use strict"
import fs from "node:fs/promises";
import { cacheDir } from './dir.js'

const parseMetaData = (markdown, filename) => {
  const regexp = new RegExp(/^(<!|-)--(?<variables>[\s\S]*?)--(-|>)/)
  const matched = markdown.match(regexp)
  const markdownReplaced = markdown.replace(regexp, '')
  const metaDataDefault = {
    name: filename,
    title: filename,
    url: `/${filename}`,
    description: '',
    og_description: '',
    published: '1970-01-01',
    index: true,
    noindex: false,
    lang: 'ja',
    site_name: process.env.SITE_NAME,
    url_base: process.env.URL_BASE,
    gtag_id: process.env.GTAG_ID,
    markdown: markdownReplaced,
    relative_path: process.env.RELATIVE_PATH || '',
    template: 'default.html',
    ext: 'html',
    __output: `${filename}.html`
  }
  if (!matched) {
    return metaDataDefault
  }
  const metaData = Object.fromEntries(
    matched.groups.variables.split('\n').filter(line => line.includes(':'))
    .map(line => {
      const index = line.indexOf(':')
      const key = line.slice(0, index)
      let value = line.slice(index + 1).trim()
      if (value === 'true' || value === 'false') {
        value = JSON.parse(value)
      }
      return [key, value]
    })
  )
  const metaDataMerged = Object.assign(metaDataDefault, metaData)
  if (!metaDataMerged.description) {
    metaDataMerged.description = markdownReplaced.slice(0, 200).replaceAll("\n", '') + '...'
  }
  if (!metaDataMerged.og_description) {
    metaDataMerged.og_description = metaDataMerged.og_description
  }
  metaDataMerged['__output'] = filename === 'index' ? '/index.html' : `${metaDataMerged.url}.${metaDataMerged.ext}`

  return metaDataMerged
}

const indexFile = `${cacheDir}/index.json`

const newIndex = []

const indexing = async (targetDir) => {
  const targets = await fs.readdir(targetDir).then(files => {
    return files.filter(fileName => fileName.endsWith('.md')).map(fileName => fileName.split('.')[0])
  })
  const data = {}
  for (const target of targets) {
    const markdownText = await fs.readFile(`${targetDir}/${target}.md`, 'utf8')
    const metaData = parseMetaData(markdownText, target)
    data[target] = metaData
    let { name, title, index, url, published, modified, __output } = metaData
    newIndex.push({ name, title, index, url, published, modified, __output })
  }
  await fs.writeFile(indexFile, JSON.stringify(newIndex))

  // 旧インデックスから差分を計算して削除対象をピックアップする
  const oldIndex = await fs.readFile(indexFile, 'utf8').then(text => JSON.parse(text)).catch(error => [])
  const deleted = oldIndex.filter(oi => !newIndex.map(ni => ni.__output).includes(oi.__output))
  data['__deleted'] = deleted
  return data
}

const readIndex = async () => {
  return newIndex
}

export { indexing, readIndex }
