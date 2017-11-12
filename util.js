module.exports = {
  dnodeGetFirstRemote,
  mapObject,
}

function dnodeGetFirstRemote(dnodeClient) {
  return new Promise((resolve) => dnodeClient.once('remote', resolve))
}

function mapObject(obj, fn) {
  const newObj = {}
  Object.keys(obj).map((key, index) => {
    const value = obj[key]
    newObj[key] = fn(key, value, index)
  })
  return newObj
}

