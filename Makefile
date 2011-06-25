all: underscore-data.js

underscore-data.js: src/index.coffee src/object.coffee src/rql.coffee src/schema.coffee
	@coffee -jcp $^ >$@

test: underscore-data.js
	@cd test ; ./webify

.PHONY: all test
