"use strict"
import fs from "node:fs/promises";
import path from 'path'
import { minifyHtml } from './minify.js'
import { render } from './applyTemplate.js'

const distribute = async (data, srcDir, distDir) => {
  if (data['__deleted']) {
    for (const i in data['__deleted']) {
      console.log(`unlink ${distDir}${data['__deleted'][i].__output}`)
      fs.unlink(`${distDir}${data['__deleted'][i].__output}`)
    }
    delete data['__deleted']
  }
  for (const name in data) {
    // FORCE_BUILD=1 にしておけばスキップフラグを無視する
    if (!process.env.FORCE_BUILD && data[name]['__canSkip'] && data[name].name !== 'index') {
      continue
    }
    const template = data[name].template
    const rendered = await render(template, data[name])
    let writeTo = `${distDir}${data[name].__output}`
    fs.mkdir(path.dirname(writeTo), { recursive: true}).then(() => {
      fs.writeFile(writeTo, minifyHtml(rendered))
      console.log(`generate ${writeTo}`)
    })
  }
  fs.readdir(`${srcDir}/image/`).then(async images => {
    await fs.stat(`${distDir}/image/`).catch(async err => await fs.mkdir(`${distDir}/image/`))
    images.forEach(image => {
      fs.copyFile(`${srcDir}/image/${image}`, `${distDir}/image/${image}`)
    })
  })
}

export default distribute
