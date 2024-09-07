import http from 'http'
import { distDir, serverDir } from './dir.js'
import fs from 'node:fs'
import { styleText } from 'node:util'

let handlersAlreadyRegistered = false
const registeredHandlers = {}
const handlers = async (path) => {
  if (handlersAlreadyRegistered) {
    return registeredHandlers[path]
  }
  const serverFiles = fs.readdirSync(serverDir)
  const loaded = await Promise.all(serverFiles.map(file => import(`${serverDir}/${file}`)))
  loaded.forEach(s => registeredHandlers[s.path] = s)
  handlersAlreadyRegistered = true
  return registeredHandlers[path]
}

/**
 * @param {string} path
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
const tryServer = async (path, req, res) => {
  const handler = await handlers(path)
  const method = req.method.toLowerCase()
  if (handler && handler[method]) {
    console.log(styleText('blue', `[server ${method.toUpperCase()} ${path}]`))
    try {
      const response = await handler[method](req, res)
      if (response) {
        return response
      }
    } catch (e) {
      console.log(e)
    }
  }
}

/**
 * @param {string} path
 * @param {http.IncomingMessage} request
 * @param {http.ServerResponse} response
 */
const getResponse = async (path , request, response) => {
  const url = new URL(`http://${request.headers.host}${request.url}`)
  const res = await tryServer(url.pathname, request, response)
  if (res) {
    const { status, contentType, body } = res
    response.writeHead(status, {'content-type': contentType })
    return response.end(body)
  }
}

export default getResponse
