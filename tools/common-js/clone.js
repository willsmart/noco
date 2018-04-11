// API
module.exports = clone;

// stupidly simple cloning device
function clone(val) {
  if (Array.isArray(val)) return cloneArray(val);
  if (typeof val == "object") return cloneObject(val);
  return val;
}

function cloneArray(array) {
  const ret = [];
  for (let index = 0; index < array.length; index++) {
    const child = array[index];
    ret.push(Array.isArray(child) ? cloneArray(child) : typeof child == "object" ? cloneObject(child) : child);
  }
  return ret;
}

function cloneObject(obj) {
  const ret = {},
    keys = Object.keys(obj);
  // I'm under the belief that this is ever so slightly quicker than had I used forEach
  // I might well be wrong but it's my hill and I'm holding it
  for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
    const key = keys[keyIndex],
      value = obj[key];
    ret[key] = Array.isArray(value) ? cloneArray(value) : typeof value == "object" ? cloneObject(value) : value;
  }
  return ret;
}