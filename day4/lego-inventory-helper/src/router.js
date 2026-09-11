const routes = []
let root = null
let notFound = () => {}

export function defineRoute(pattern, handler) {
  const paramNames = []
  const regex = new RegExp(
    '^' +
      pattern
        .split('/')
        .map((seg) => {
          if (seg.startsWith(':')) {
            paramNames.push(seg.slice(1))
            return '([^/]+)'
          }
          return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        })
        .join('/') +
      '$',
  )
  routes.push({ regex, paramNames, handler })
}

export function setNotFoundHandler(fn) {
  notFound = fn
}

export function init(rootEl) {
  root = rootEl
  window.addEventListener('hashchange', dispatch)
  dispatch()
}

export function navigate(path) {
  if (location.hash.slice(1) === path) {
    dispatch()
  } else {
    location.hash = path
  }
}

export function currentPath() {
  return location.hash.slice(1) || '/'
}

export function refresh() {
  dispatch()
}

function parseQuery(search) {
  const params = {}
  for (const [k, v] of new URLSearchParams(search)) params[k] = v
  return params
}

function dispatch() {
  const raw = location.hash.slice(1) || '/'
  const [path, search] = raw.split('?')
  const query = parseQuery(search ? `?${search}` : '')
  for (const route of routes) {
    const match = path.match(route.regex)
    if (match) {
      const params = {}
      route.paramNames.forEach((name, i) => {
        params[name] = decodeURIComponent(match[i + 1])
      })
      root.innerHTML = ''
      route.handler(root, params, query)
      return
    }
  }
  root.innerHTML = ''
  notFound(root)
}
