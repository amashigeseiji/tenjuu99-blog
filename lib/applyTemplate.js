"use strict"
import applyCss from './cssGenerator.js'
import includeFilter from './includeFilter.js'
import { staticFile, staticFiles, warmUp } from './files.js'

let templates = {}
let loaded = false

const applyTemplate = async (name = 'default.html') => {
  if (templates[name]) {
    return templates[name]
  }
  let templateContent = await staticFile(`template/${name}`)
  templateContent = includeFilter(templateContent)
  templateContent = await applyCss(templateContent)
  templates[name] = templateContent
  return templateContent
}

const warmUpTemplate = async () => {
  if (loaded) {
    console.log('template is already warmed up.')
    return
  }
  console.log('warming up template')
  await warmUp()
  const templates = staticFiles()
    .filter(file => file[0].indexOf('template/') === 0)
    .map(f => applyTemplate(f[0].split('/')[1]))
  await Promise.all(templates)
  loaded = true
}

export { applyTemplate, warmUpTemplate }
