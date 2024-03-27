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

const replaceRelative = (html, relative) => {
  const regexp = new RegExp(/\<(a|link)\s.*href=("|\')(?<href>\/.*)("|\')/g)
  const matched = [...html.matchAll(regexp)]
  for (const i in matched) {
    const exactMatchWord = matched[i][0]
    const replaced = exactMatchWord.replace(matched[i].groups.href, `/${relative}${matched[i].groups.href}`)
    html = html.replace(exactMatchWord, replaced)
  }
  return html
}

const render = async (templateName, data) => {
  let template = await applyTemplate(templateName)
  template = replaceIfFilter(template, data)
  template = await replaceScriptFilter(template, data)

  let markdown = data.markdown
  markdown = await includeFilter(markdown)
  markdown = await replaceIfFilter(markdown, data)
  markdown = await replaceScriptFilter(markdown, data)
  data.markdown = marked.parse(markdown)

  let text = replaceVariablesFilter(template, data)
  if (process.env.RELATIVE_PATH) {
    return replaceRelative(text, process.env.RELATIVE_PATH)
  }
  return text
}

export default render
