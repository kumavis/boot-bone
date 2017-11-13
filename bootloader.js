const pipe = require('pump')
const pify = require('pify')
const defer = require('pull-defer')
const ReadableStream = require('readable-stream')
const cbify = require('cb-ify')
const { dnodeGetFirstRemote, mapObject } = require('./util')
const noop = function(){}

const dnode = require('dnode')
const SwGlobalListener = require('sw-stream/lib/sw-global-listener.js')
const createDb = require('./db')

// listen for clients
const remoteConnectionQueue = new ReadableStream({ objectMode: true })
remoteConnectionQueue._read = noop
setupRemoteInterface((portStream) => {
  remoteConnectionQueue.push(portStream)
})

// listen for requests
const fetchRequestQueue = new ReadableStream({ objectMode: true })
fetchRequestQueue._read = noop
global.addEventListener('fetch', (event) => {
  fetchRequestQueue.push(event)
})

start().then(console.log, console.error)

async function start () {

  // setup dbs
  const db = createDb()
  const meta = simpleSublevel(db, 'meta')
  global.db = db
  global.meta = meta
  let version = await gentleGet(meta, 'version')
  let currentDisk

  // first time init
  if (version === null) {
    console.log('no version found - initializing v0')
    version = 'v0'
    currentDisk = await createNewVersion(version)
    await loadDefaultInitializer(currentDisk)
    await currentDisk.put('/xyz', Buffer.from('i n   y o u r   b r o w s e r'), console.log)
    await setCurrentVersion(version)
  } else {
    console.log(`version: "${version}"`)
    currentDisk = simpleSublevel(db, version)
  }

  // setup asset server
  setupAssetServer(currentDisk)

  // establish connections with clients
  remoteConnectionQueue.on('data', async (portStream) => {
    const host = createRemoteInterface()
    pipe(
      portStream,
      host,
      portStream,
      console.error
    )
    const remoteClient = await dnodeGetFirstRemote(host)
    console.log('bootloader: dnode connected')
  })


  function createRemoteInterface () {
    let interface = {
      // root db access
      root: {
        put: db.put.bind(db),
        get: db.get.bind(db),
      },
      // meta
      meta: {
        put: meta.put.bind(meta),
        get: meta.get.bind(meta),
      },
      // currentDisk
      current: {
        put: currentDisk.put.bind(currentDisk),
        get: currentDisk.get.bind(currentDisk),
      }
    }
    // add promise support
    interface = mapObject(interface, (key, value) => cbify(value))
    const host = dnode(interface, { emit: 'object' })

    return host
  }

  async function createNewVersion (name) {
    const disk = simpleSublevel(db, name)
    return disk
  }

  async function setCurrentVersion (name) {
    return await meta.put('version', name)
  }
}

// intercept requests from page
function setupAssetServer (db) {
  fetchRequestQueue.on('data', (event) => {
    const req = event.request
    const url = new URL(req.url)

    // only intercept same domain
    if (url.origin !== location.origin) return

    // respond with local content
    event.respondWith((async () => {
      const path = url.pathname
      const body = await db.get(path)
      return new Response(body)
    })())
  })
}

//
// setup remote interface
//

//
// establish connection
//

function setupRemoteInterface(handler){
  const connectionListener = new SwGlobalListener(global)
  connectionListener.on('remote', handler)
}

async function loadDefaultInitializer (db) {
  await Promise.all([
    preloadResource(db, '/'),
    preloadResource(db, '/initialize.js')
  ])
  // console.log('bootloader: default initializer loaded')
}

async function preloadResource (db, path) {
  const res = await fetch(path)
  const body = await res.text()
  await db.put(path, body)
}

function simpleSublevel (db, prefix) {
  return {
    put: (key, value, opts, cb) => db.put(prefix + '/' + key, value, opts, cb),
    get: (key, opts, cb) => db.get(prefix + '/' + key, opts, cb),
  }
}

async function gentleGet (db, key) {
  try {
    return await db.get(key)
  } catch (err) {
    return null
  }
}
