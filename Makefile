all: underscore-data.js test

underscore-data.js: src/object.coffee src/rql.coffee src/schema.coffee
	@coffee -jcp $^ >$@

tmp/paperboy.js:
	@mkdir -p tmp
	@wget --no-check-certificate https://github.com/felixge/node-paperboy/raw/master/lib/paperboy.js -O $@

test: underscore-data.js tmp/paperboy.js
	@echo "var path=require('path');var paperboy=require('./tmp/paperboy.js');require('http').createServer(function(req, res){paperboy.deliver(path.join(__dirname,'/test'),req,res)}).listen(8080);console.log('Point your browser to http://localhost:8080');" | node

.PHONY: all test
