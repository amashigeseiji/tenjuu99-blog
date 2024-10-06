import { allData, config } from '@tenjuu99/blog'

export function breadcrumbList(pageName) {
  const pageData = allData[pageName]
  const entries = Object.entries(allData)
  const breadCrumbs = ['/']
  pageData.url.split('/').reduce((prev, curr) => {
    if (curr === 'index') {
      return
    }
    let str = curr
    if (allData[prev + curr]) {
      str = allData[prev + curr].title
    } else {
      const entry = entries.find(v => `/${prev}${curr}` === v[1].url)
      if (entry) {
        str = entry[1].title
      }
    }
    breadCrumbs.push([`/${prev}${curr}/`, str])
    return `${prev}${curr}/`
  })
  if (breadCrumbs.length === 1) {
    return ''
  }
  const last = breadCrumbs.pop()
  last[0] = last[0].substring(0, last[0].length - 1)

  const output = breadCrumbs.map(v => {
    const href = config.relative_path ? config.relative_path + v[0] : v[0]
    return `<div class="breadcrumbs-item"><a href="${href}">${v[0] === '/' ? 'top' : v[1]}</a></div>`
  }).join('') + `<div class="breadcrumbs-item">${last[1]}</div>`
  return '<div class="breadcrumbs">'
    + output
    + '</div>'
}
