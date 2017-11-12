const pipe = require('pump')
const pify = require('pify')

// const dnode = require('dnode-p')
const dnode = require('dnode')
const SwGlobalListener = require('sw-stream/lib/sw-global-listener.js')
const createDb = require('./db')


//
// connect to db
//

const db = createDb()

// fixture data
db.put('/', Buffer.from('welcome home'), console.log)
db.put('/xyz', Buffer.from('i n   y o u r   b r o w s e r'), console.log)


global.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  // only intercept same domain
  if (url.origin !== location.origin) return

  // respond with local content
  event.respondWith((async () => {
    const path = url.pathname
    const body = await db.get(path)
    console.log(body)
    return new Response(body)
  })())
})

//
// setup remote interface
//


//
// establish connection
//

const connectionListener = new SwGlobalListener(global)

console.log('bootloader: online')

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

function createDnode() {
  const host = dnode({
    // direct db access
    put: db.put.bind(db),
    get: db.get.bind(db),
  })

  host.on('remote', (guest) => {
    console.log('bootloader: dnode connected')
    self.remoteGuest = guest
  })

  return host
}
