"use strict"
import fs from "node:fs/promises";
import { srcDir } from './dir.js'

const parseMetaData = (markdown) => {
  const regexp = new RegExp(/^(<!|-)--(?<variables>[\s\S]*?)--(-|>)/)
  const matched = markdown.match(regexp)
  const metaDataDefault = {
    title: '',
    url: '',
    description: '',
    og_description: '',
    published: '',
    index: true,
    noindex: false,
    lang: 'ja'
  }
  if (!matched) {
    return { metaData: metaDataDefault, markdown }
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
  const markdownReplaced = markdown.replace(regexp, '')
  const metaDataMerged = Object.assign(metaDataDefault, metaData)
  if (!metaDataMerged.description) {
    metaDataMerged.description = markdownReplaced.slice(0, 200).replaceAll("\n", '') + '...'
  }
  if (!metaDataMerged.og_description) {
    metaDataMerged.og_description = metaDataMerged.og_description
  }
  return {
    metaData: metaDataMerged,
    markdown: markdownReplaced
  }
}

const indexFile = `${srcDir}/index.json`

const indexing = async (targetDir) => {
  const targets = await fs.readdir(targetDir).then(files => {
    return files.filter(fileName => fileName.endsWith('.md')).map(fileName => fileName.split('.')[0])
  })
  const newIndex = []
  const data = {}
  const site_name = process.env.SITE_NAME
  const url_base = process.env.URL_BASE
  const gtag_id = process.env.GTAG_ID
  for (const target of targets) {
    const markdownText = await fs.readFile(`${targetDir}/${target}.md`, 'utf8')
    const { metaData, markdown } = parseMetaData(markdownText)
    data[target] = { ...metaData, markdown, name: target, gtag_id, site_name, url_base }
    let { title, index, url, published, modified } = metaData
    if (typeof index === 'undefined') {
      index = true
    }
    newIndex.push({ name: target, title, index, url, published, modified })
  }
  await fs.writeFile(indexFile, JSON.stringify(newIndex))
  return data
}

const readIndex = async () => {
  return await fs.readFile(indexFile, 'utf8').then(text => JSON.parse(text)).catch(error => [])
}

export { indexing, readIndex }
