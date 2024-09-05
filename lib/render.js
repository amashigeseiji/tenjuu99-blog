import {
  replaceIfFilter,
  replaceScriptFilter,
  replaceVariablesFilter,
  includeFilter
} from './filter.js'
import { marked } from "marked";
import applyTemplate from './applyTemplate.js'

const render = async (templateName, data) => {
  let template = await applyTemplate(templateName)
  template = replaceIfFilter(template, data)
  template = await replaceScriptFilter(template, data)

  let markdown = data.markdown
  markdown = await includeFilter(markdown)
  markdown = await replaceIfFilter(markdown, data)
  markdown = await replaceScriptFilter(markdown, data)
  markdown = replaceVariablesFilter(markdown, data)
  data.markdown = data.__filetype === 'md' ? marked.parse(markdown) : markdown
  if (!data.description) {
    data.description = data.markdown.replaceAll("\n", '').replace(/(<([^>]+)>)/gi, '').slice(0, 150) + '...'
    data.og_description = data.description
  }

  return replaceVariablesFilter(template, data)
}

export default render
