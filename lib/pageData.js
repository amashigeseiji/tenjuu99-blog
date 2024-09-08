"use strict"
import config from './config.js'

const makePageData = (filename, content) => {
  const [name, ext] = filename.split('.')
  return parse(content, name, ext)
}

const parse = (content, name, ext) => {
  const regexp = new RegExp(/^(<!|-)--(?<variables>[\s\S]*?)--(-|>)/)
  const matched = content.match(regexp)
  const markdownReplaced = content.replace(regexp, '')
  const metaDataDefault = Object.assign({
    name,
    title: name,
    url: `/${name}`,
    description: '',
    og_description: '',
    published: '1970-01-01',
    index: true,
    noindex: false,
    lang: 'ja',
    distribute: true,
    site_name: config.site_name,
    url_base: config.url_base,
    markdown: markdownReplaced,
    markdown_not_parsed: markdownReplaced,
    relative_path: config.relative_path || '',
    template: 'default.html',
    ext: 'html',
    __output: `/${name}.html`,
    __filetype: ext,
  }, config)
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
      } else {
        if (value.startsWith('config.')) {
          const envName = value.split('.').pop()
          eval(`value = config.${envName}`)
        }
      }
      return [key, value]
    })
  )
  const metaDataMerged = Object.assign(metaDataDefault, metaData)
  metaDataMerged['__output'] = name === 'index' ? '/index.html' : `${metaDataMerged.url}.${metaDataMerged.ext}`

  return metaDataMerged
}

export default makePageData
