# support node.js
if typeof module != 'undefined' && typeof module.exports != 'undefined' && typeof require != 'undefined'
    _ = require('underscore')
    module.exports = _
# support ender.js
else if this._ is undefined and this.$ isnt undefined and $.ender
	this._ = $
	this._.mixin = this.$.ender
else
	_ = this._
