import http from 'http'
import url from 'url'
import fs from 'node:fs'
import { distDir, serverDir } from './dir.js'
import { styleText } from 'node:util'
import handle from './tryServer.js'

const contentType = (ext) => {
    switch (ext) {
      case 'html':
      case 'css':
        return `text/${ext}`
      case 'js':
        return 'text/javascript'
      case 'jpeg':
      case 'png':
      case 'webp':
      case 'avif':
        return `image/${ext}`
      case 'jpg':
        return 'image/jpeg'
      case 'svg':
        return 'image/svg+xml'
      case 'xml':
      case 'json':
        return `application/${ext}`
      case 'rdf':
        return 'application/rdf+xml.rdf'
      default:
        return 'application/octet-stream'
    }
}

const server = () => {
  return http.createServer(async (request, response) => {
    const url = new URL(`http://${request.headers.host}${request.url}`)
    const isIndex = url.pathname.match(/(.+)?\/$/)
    let path = isIndex ? `${url.pathname}index.html` : decodeURIComponent(url.pathname)
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
      const errorContent = fs.readFileSync(`${distDir}/404.html`)
      response.writeHead(500)
      response.end(errorContent)
    }
  })
}

export default server
