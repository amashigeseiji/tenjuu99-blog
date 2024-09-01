"use strict"
import fs from "node:fs/promises";
import { applyCss, watchCss } from './cssGenerator.js'
import {
  replaceIfFilter,
  replaceScriptFilter,
  replaceVariablesFilter,
  includeFilter
} from './filter.js'
import { marked } from "marked";
import { templateDir, cssDir } from './dir.js'
import chokidar from 'chokidar'

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

const render = async (templateName, data) => {
  let template = await applyTemplate(templateName)
  template = replaceIfFilter(template, data)
  template = await replaceScriptFilter(template, data)

  let markdown = data.markdown
  markdown = await includeFilter(markdown)
  markdown = await replaceIfFilter(markdown, data)
  markdown = await replaceScriptFilter(markdown, data)
  data.markdown = data.__filetype === 'md' ? marked.parse(markdown) : markdown


  return replaceVariablesFilter(template, data)
}

const watchTemplate = () => {
  chokidar.watch([cssDir, templateDir]).on('change', () => {
    templates = {}
  })
  watchCss()
}

export { render, watchTemplate }
