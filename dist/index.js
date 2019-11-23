
'use strict'

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./single-table-dynamo.cjs.production.min.js')
} else {
  module.exports = require('./single-table-dynamo.cjs.development.js')
}
