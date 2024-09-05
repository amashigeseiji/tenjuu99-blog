import helper from '../lib/helper.js'
import includeFilter from './includeFilter.js'
import { srcDir } from './dir.js'
import config from './config.js'

/**
 * @param {string} text
 * @params {object} variables
 * @return {text}
 */
const replaceVariablesFilter = (text, variables) => {
  const matched = [...text.matchAll(/(\\)?{{\s*(.+)\s*}}/g)]
  const replace = Object.fromEntries(matched.map(match => [match[2].toLowerCase(), {replace: match[0], backslash: !!match[1]}]))
  let replaced = text
  for (const elm in replace) {
    const [toBeReplace, replacedText] = replaceVariable(elm, replace[elm].replace, replace[elm].backslash, variables)
    replaced = replaced.replaceAll(toBeReplace, replacedText)
  }
  return replaced
}

/**
 * @param {string} target
 * @param {string} replaceTargetRawText
 * @param {boolean} backslash
 * @param {object} variables
 * @return {Array.<string>}
 */
const replaceVariable = (target, replaceTargetRawText, backslash, variables) => {
    const toBeReplace = replaceTargetRawText
    const toBeReplaceScript = toBeReplace.match(/([\w\d_]+)\((.*)\)/)
    if (backslash) { // escape variable syntax
      const removeBackslash = replaceTargetRawText.replace(/\\/, '')
      return [replaceTargetRawText, removeBackslash]
    } else if (toBeReplaceScript) { // execute helper
      const func = toBeReplaceScript[1]
      const args = toBeReplaceScript[2].split(',').map(v => {
        const val = v.trim()
        const argAsString = v.match(/^['"](.+)['"]$/)
        if (argAsString) {
          return argAsString[1]
        }
        return variables[val] ?? undefined
      })
      if (!helper[func]) {
        throw new Error('helper function is missing. function name: ' + func);
      }
      const replaceText = helper[func].call(null, ...args)
      return [replaceTargetRawText, replaceText]
    }
    return [replaceTargetRawText, variables[target]]
}

/**
 * @param {string} condition
 * @params {object} variables
 * @return {bool}
 */
const ifConditionEvaluator = (condition, variables) => {
  if (condition.includes('=')) {
    const segmented = condition.match(/(?<left>[\S]+)\s(?<operator>!=|==)\s(?<right>[\S]+)/)
    let {left, operator, right} = segmented.groups
    if (variables.hasOwnProperty(left)) {
      left = variables[left]
    } else {
      try {
        left = eval(left)
      } catch (e) {
        left = undefined
      }
    }
    if (variables.hasOwnProperty(right)) {
      right = variables[right]
    } else {
      try {
        right = eval(right)
      } catch (e) {
        right = undefined
      }
    }
    switch (operator) {
      case '==':
        return left == right
      case '!=':
        return left != right
    }
  } else {
    if (variables.hasOwnProperty(condition)) {
      return !!variables[condition]
    }
    return false
  }
}

/**
 * @param {string} text
 * @param {object} variables
 * @returns {string}
 */
const replaceIfFilter = (text, variables) => {
  const ifRegexp = new RegExp(/(\{|\<)if\s(?<condition>[\s\S]+?)(}|>)(?<content>[\s\S]*?)((\{|\<)else(\}|\>)(?<elsecontent>[\s\S]*?))?(\{|\<)\/if(\>|})/g)
  const matched = [...text.matchAll(ifRegexp)]
  for (const item of matched) {
    const target = item[0]
    const content = item.groups.content
    const elseContent = item.groups.elsecontent
    if (ifConditionEvaluator(item.groups.condition, variables)) {
      text = text.replace(target, content)
    } else if (elseContent) {
      text = text.replace(target, elseContent)
    } else {
      text = text.replace(target, '')
    }
  }
  return text
}

/**
 * 配列を再帰的に順不同リストに変換する
 * @param {Array|string} arrayOrText
 * @returns {mixed}
 */
const arrayToList = (arrayOrText) => {
  if (typeof arrayOrText === 'string') {
    return `<li>${arrayOrText}</li>`
  }
  if (Array.isArray(arrayOrText)) {
    let resultListText = '<ul>'
    for (const item of arrayOrText) {
      if (Array.isArray(item)) {
        resultListText += `<li>${arrayToList(item)}</li>`
      } else {
        resultListText += `<li>${item}</li>`
      }
    }
    resultListText += '</ul>'
    arrayOrText = resultListText
  }
  return arrayOrText
}

const replaceScriptFilter = async (text, variables) => {
  let replaced = text
  const scriptRegexp = new RegExp(/({script}|\<script\s.*type="ssg".*>)(?<script>[\s\S]*?)(\{\/script}|\<\/script>)/g)
  const scripts = [...text.matchAll(scriptRegexp)].map((matched) => {
    return {
      replace: matched[0],
      script: matched.groups.script.trim("\n"),
    }
  })
  for (const script of scripts) {
    let result = new Function('helper', 'variables', script.script)(helper, variables)
    if (result instanceof Promise) {
      result = await result
    }
    if (typeof result === 'undefined') {
      result = null
    }
    if (Array.isArray(result)) {
      result = arrayToList(result)
    } else if (typeof result === 'object') {
      const resultText = []
      for (const key in result) {
        resultText.push(`<h3>${key}</h3>`)
        if (Array.isArray(result[key])) {
          resultText.push(arrayToList(result[key]))
        } else {
          resultText.push(`<p>${result[key]}</p>`)
        }
      }
      result = resultText.join('\n')
    }
    replaced = replaced.replace(script.replace, result)
  }
  return replaced
}

export {
  replaceIfFilter,
  replaceScriptFilter,
  replaceVariablesFilter,
  includeFilter
}
