"use strict"
import applyCss from './cssGenerator.js'
import includeFilter from './includeFilter.js'
import { watch } from './dir.js'
import { staticFile, staticFiles, warmUp, reload } from './files.js'
import { watchers } from './watcher.js'

let templates = {}

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
  await warmUp()
  const templates = staticFiles()
    .filter(file => file[0].indexOf('template/') === 0)
    .map(f => applyTemplate(f[0].split('/')[1]))
  await Promise.all(templates)
}

watchers.push({
  paths: [watch.cssDir, watch.templateDir],
  callback: async () => {
    templates = {}
    await reload()
    await warmUpTemplate()
  }
})

export { applyTemplate, warmUpTemplate }
