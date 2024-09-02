import chokidar from 'chokidar'

const container = []

const watchers = {
  push({ paths, event = 'change', callback }) {
    if (!paths || !callback || typeof callback !== 'function') {
      throw new Error('Invalid object type for watcher.')
    }
    container.push({ paths, event, callback })
  }
}

const watch = () => {
  container.forEach((watcher) => {
    const { paths, event, callback } = watcher
    chokidar.watch(paths).on(event, callback)
  })
}

export { watchers , watch }
