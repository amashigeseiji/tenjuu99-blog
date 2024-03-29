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
import { createHash } from 'crypto'

const templates = {}

const getTemplateHash = async (name) => {
  const { hash } = await applyTemplate(name)
  return hash
}

const applyTemplate = async (name = 'default.html') => {
  if (templates[name]) {
    return templates[name]
  }
  let templateContent = await fs.readFile(`${templateDir}/${name}`, 'utf8')
  templateContent = await includeFilter(templateContent)
  templateContent = await applyCss(templateContent)
  const hash = createHash('md5').update(templateContent).digest('hex')
  templates[name] = { template: templateContent, hash }
  return templates[name]
}

const render = async (templateName, data) => {
  let { template } = await applyTemplate(templateName)
  template = replaceIfFilter(template, data)
  template = await replaceScriptFilter(template, data)

  let markdown = data.markdown
  markdown = await includeFilter(markdown)
  markdown = await replaceIfFilter(markdown, data)
  markdown = await replaceScriptFilter(markdown, data)
  data.markdown = marked.parse(markdown)

  return replaceVariablesFilter(template, data)
}

export { render, getTemplateHash }
