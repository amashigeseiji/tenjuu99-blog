import helper from '../lib/helper.js'

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
    const match = condition.match(/([\w]+)\((.*)\)/)
    if (match) {
      const func = match[1]
      if (helper[func] instanceof Function) {
        let args = match[2].trim()
        if (args) {
          args = args.split(',').map(arg => {
            const match = arg.match(/^(['"])?\s*([\w]+)(["'])?$/)
            if (match) {
              return match[1] ? `${match[2]}` : variables[match[2]]
            }
            return arg
          })
        }
        return helper[func].call(args)
      }
    }
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
    if (ifConditionEvaluator(item.groups.condition.trim(), variables)) {
      text = text.replace(target, content)
    } else if (elseContent) {
      text = text.replace(target, elseContent)
    } else {
      text = text.replace(target, '')
    }
  }
  return text
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
    switch (typeof result) {
      case 'undefined':
      case 'null':
        result = ''
    }
    replaced = replaced.replace(script.replace, result)
  }
  return replaced
}

export {
  replaceIfFilter,
  replaceScriptFilter
}
