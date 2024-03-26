"use strict"
import fs from "node:fs/promises";
import applyCss from './cssGenerator.js'
import {
  replaceIfFilter,
  replaceScriptFilter,
  replaceVariablesFilter,
  includeFilter
} from './filter.js'
import { marked } from "marked";
import { templateDir } from './dir.js'

const templates = {}

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

const render = async (templateName, data) => {
  let template = await applyTemplate(templateName)
  template = replaceIfFilter(template, data)
  template = await replaceScriptFilter(template, data)

  let markdown = data.markdown
  markdown = await includeFilter(markdown)
  markdown = await replaceScriptFilter(markdown, data)
  markdown = await replaceIfFilter(markdown, data)
  data.markdown = marked.parse(markdown)

  return replaceVariablesFilter(template, data)
}

export default render
