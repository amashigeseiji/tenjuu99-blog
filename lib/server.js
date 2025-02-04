import http from 'http'
import url from 'url'
import fs from 'node:fs'
import { distDir, serverDir } from './dir.js'
import { styleText } from 'node:util'
import handle from './tryServer.js'
import contentType from './contentType.js'

const server = () => {
  return http.createServer(async (request, response) => {
    request.setEncoding('utf8')
    const url = new URL(`http://${request.headers.host}${request.url}`)
    const urlPathNameDecoded = decodeURIComponent(url.pathname)
    const isIndex = urlPathNameDecoded.match(/(.+)?\/$/)
    let path = isIndex ? `${urlPathNameDecoded}index.html` : urlPathNameDecoded
    if (!path.includes('.')) {
      const result = await handle(path, request, response)
      if (result) {
        return
      }
      path += '.html'
    }
    if (!fs.existsSync(`${distDir}${path}`)) {
      console.log(styleText('red', `[${request.method}] 404`), request.url)
      const errorContent = fs.readFileSync(`${distDir}/404.html`)
      response.writeHead(404)
      response.end(errorContent)
      return
    }
    try {
      const content = fs.readFileSync(`${distDir}${path}`, 'binary')

      const ext = path.split('.')[1]
      console.log(styleText('green', `[${request.method}] 200`), request.url)
      response.writeHead(200, { 'Content-Type': `${contentType(ext)}; charset=utf-8` })
      response.end(content, 'binary')
    } catch (e) {
      console.log(e)
      console.log(styleText('red', `[${request.method}] 500`), request.url)
      const errorContent = fs.readFileSync(`${distDir}/500.html`)
      response.writeHead(500)
      response.end(errorContent)
    }
  })
}

export default server
