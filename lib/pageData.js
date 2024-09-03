"use strict"
import fs from "node:fs";
import { pageDir } from './dir.js'
import config from './config.js'

const load = (path) => {
  return fs.readFileSync(path, 'utf8')
}

const makePageData = (filename) => {
  const content = load(`${pageDir}/${filename}`)
  const [name, ext] = filename.split('.')
  return parse(content, name, ext)
}

const parse = (content, name, ext) => {
  const regexp = new RegExp(/^(<!|-)--(?<variables>[\s\S]*?)--(-|>)/)
  const matched = content.match(regexp)
  const markdownReplaced = content.replace(regexp, '')
  const metaDataDefault = {
    name,
    title: name,
    url: `/${name}`,
    description: '',
    og_description: '',
    published: '1970-01-01',
    index: true,
    noindex: false,
    lang: 'ja',
    site_name: config.site_name,
    url_base: config.url_base,
    gtag_id: config.gtag_id,
    markdown: markdownReplaced,
    relative_path: config.relative_path || '',
    template: 'default.html',
    ext: 'html',
    __output: `/${name}.html`,
    __filetype: ext,
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
    metaDataMerged.description = markdownReplaced.replace(/(<([^>]+)>)/gi, '').slice(0, 200).replaceAll("\n", '') + '...'
  }
  if (!metaDataMerged.og_description) {
    metaDataMerged.og_description = metaDataMerged.og_description
  }
  metaDataMerged['__output'] = name === 'index' ? '/index.html' : `${metaDataMerged.url}.${metaDataMerged.ext}`

  return metaDataMerged
}

export default makePageData
