"use strict"
import fs from "node:fs/promises";
import applyCss from './cssGenerator.js'
import { includeFilter } from './filter.js'
import { templateDir, cssDir } from './dir.js'
import { watchers } from './watcher.js'

let templates = {}

const applyTemplate = async (name = 'default.html') => {
  if (templates[name]) {
    return templates[name]
  }
  let templateContent = await fs.readFile(`${templateDir}/${name}`, 'utf8')
  templateContent = await includeFilter(templateContent)
  templateContent = await applyCss(templateContent)
  templates[name] = templateContent
  return templateContent
}

watchers.push({
  paths: [cssDir, templateDir],
  callback: () => { templates = {} }
})

export default applyTemplate
