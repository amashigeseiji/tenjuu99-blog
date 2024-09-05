import helper from './helper.js'

/**
 * テキストに含まれる変数を一括変換する
 * ヘルパー処理もここで行われる
 *
 * @param {string} text
 * @params {object} variables
 * @return {text}
 */
const replaceVariablesFilter = (text, variables) => {
  const matched = [...text.matchAll(/(\\)?{{[\s]*([^{}]+)[\s]*}}/g)]
  const replace = Object.fromEntries(matched.map(match => [match[0], {variableName: match[2].trim().toLowerCase(), backslash: !!match[1]}]))
  let replaced = text
  for (const elm in replace) {
    const [toBeReplace, replacedText] = replaceVariable(replace[elm].variableName, elm, replace[elm].backslash, variables)
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
        const argAsString = val.match(/^['"](.+)['"]$/)
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

export default replaceVariablesFilter
