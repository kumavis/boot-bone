const pipe = require('pump')
const pify = require('pify')

// const dnode = require('dnode-p')
const dnode = require('dnode')
const SwGlobalListener = require('sw-stream/lib/sw-global-listener.js')
const createDb = require('./db')

start().then(console.log, console.error)

async function start () {

  // listen for clients
  setupRemoteInterface()

  // setup dbs
  const db = createDb()
  const meta = simpleSublevel(db, 'meta')
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
  global.addEventListener('fetch', (event) => {
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

function setupRemoteInterface(){
  const connectionListener = new SwGlobalListener(global)
  connectionListener.on('remote', (portStream, messageEvent) => {
    console.log('bootloader: page connection established')
    const host = createDnode()
    pipe(
      portStream,
      host,
      portStream,
      console.error
    )
  })

}

function createDnode (db) {
  const host = dnode({
    // direct db access
    // put: db.put.bind(db),
    // get: db.get.bind(db)
  })

  host.on('remote', (guest) => {
    console.log('bootloader: dnode connected')
    self.remoteGuest = guest
  })

  return host
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
    put: (key, value) => db.put(prefix + '/' + key, value),
    get: (key) => db.get(prefix + '/' + key)
  }
}

async function gentleGet (db, key) {
  try {
    return await db.get(key)
  } catch (err) {
    return null
  }
}
