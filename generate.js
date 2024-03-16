"use strict"
import fs from "node:fs/promises";
import path from 'path'
import { marked } from "marked";
import * as helper from './helper/index.js'
import {
  replaceIfFilter,
  replaceScriptFilter,
  replaceVariablesFilter,
  includeFilter
} from './lib/filter.js'
import { minifyCss, minifyHtml } from './lib/minify.js'
import { createHash } from 'crypto'

marked.use({
  renderer: {
    html: htmlString => htmlString.startsWith('<!--') ? '' : htmlString
  }
})

const file = {
  read: async path => await fs.readFile(path, 'utf8'),
  template: async (name = 'default.html') => await file.read(`./template/${name}`),
  markdown: async name => await file.read(`./data/${name}.md`),
  write: async (path, data) => await fs.writeFile(path, data),
}

const cssGenerator = cssGeneratorFunction()
const render = async (templateName, data) => {
  const markdown = replaceIfFilter(data.markdown, data)
  data.markdown = await parseMarkdown(markdown, data)
  const template = await file.template(templateName)

  const cssGenerate = [...template.matchAll(/\${([\w/]+.css):([\w/,.]+.css)}/g)].map(val => [val[0], val[1], val[2]])

  return (async (data) => {
    let replaced = await includeFilter(template)
    for (const cssDist of cssGenerate) {
      const cacheBuster = await cssGenerator(cssDist[2], cssDist[1])
      replaced = replaced.replace(cssDist[0], `${cssDist[1]}?t=${cacheBuster}`)
    }
    replaced = replaceIfFilter(replaced, data)
    replaced = replaceVariablesFilter(replaced, data)
    replaced = await replaceScriptFilter(replaced, data)
    return minifyHtml(replaced)
  })(data)
}

/**
 * @returns {Function}
 */
function cssGeneratorFunction() {
  const generatedCss = []
  let cacheBuster = ''
  /**
   * @param {string} src
   * @param {string} dist
   * @returns {Promise<string>}
   */
  return async (src, dist) => {
    if (generatedCss.includes(`${dist}${src}`)) {
      return cacheBuster
    }
    generatedCss.push(`${dist}${src}`)
    let css = ''
    for (const cssFile of src.split(',')) {
      css += await file.read('.' + cssFile)
    }
    css = minifyCss(css)
    cacheBuster = createHash('md5').update(css).digest('hex')
    return await fs.mkdir(`./dist${path.dirname(dist)}`, { recursive: true }).then(async () => {
      await file.write(`./dist${dist}`, css)
      console.log(`generate ${src} => ./dist${dist}`)
      return cacheBuster
    })
  }
}

const parseMetaData = (markdown) => {
  const regexp = new RegExp(/<!--([\s\S]*?)-->/)
  const matched = markdown.match(regexp)
  const metaDataDefault = {
    title: '',
    url: '',
    published: '',
    index: true,
    noindex: false,
    lang: 'ja'
  }
  const metaData = Object.fromEntries(
    matched[1].split('\n').filter(line => line.includes(':'))
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
  return Object.assign(metaDataDefault, metaData)
}

const parseMarkdown = async (markdownText, data) => {
  return marked.parse(await includeFilter(await replaceScriptFilter(markdownText, data)))
}

const targets = await fs.readdir('./data/').then(files => {
  return files.filter(fileName => fileName.endsWith('.md')).map(fileName => fileName.split('.')[0])
})
const newIndex = []
const data = {}
const site_name = process.env.SITE_NAME
const url_base = process.env.URL_BASE
const gtag_id = process.env.GTAG_ID
for (const target of targets) {
  const markdownText = await file.markdown(target)
  const metaData = parseMetaData(markdownText)
  data[target] = { ...metaData, markdown: markdownText, name: target, gtag_id, site_name, url_base }
  let { title, index, url, published, modified } = metaData
  if (typeof index === 'undefined') {
    index = true
  }
  newIndex.push({ name: target, title, index, url, published, modified })
}
await file.write('./data/index.json', JSON.stringify(newIndex))
for (const name in data) {
  const template = data[name].template ? data[name].template : 'default.html'
  const rendered = await render(template, data[name])
  let writeTo = ''
  if (name === 'index') {
    writeTo = './dist/index.html'
  } else {
    writeTo = `./dist${data[name].url}.` + (data[name]?.ext ? data[name]?.ext : 'html')
  }
  fs.mkdir(path.dirname(writeTo), { recursive: true}).then(() => {
    file.write(writeTo, rendered)
    console.log(`generate ${writeTo}`)
  })
}
fs.readdir('./data/image/').then(async images => {
  await fs.stat('./dist/image/').catch(async err => await fs.mkdir('./dist/image/'))
  images.forEach(image => {
    fs.copyFile(`./data/image/${image}`, `./dist/image/${image}`)
  })
})
