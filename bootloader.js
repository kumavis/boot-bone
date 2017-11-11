const pify = require('pify')
const SwGlobalListener = require('sw-stream/lib/sw-global-listener.js')
const createDb = require('./db')


//
// establish connection
//

const connectionListener = new SwGlobalListener(global)
global.addEventListener('message', console.log)

console.log('bootloader online')

connectionListener.on('remote', (portStream, messageEvent) => {
  console.log('page connection established')
})


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
