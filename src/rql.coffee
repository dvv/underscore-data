'use strict'

###
 *
 * Copyright(c) 2011 Vladimir Dronnikov <dronnikov@gmail.com>
 * MIT Licensed
 *
###

###
	Rewrite of kriszyp's RQL https://github.com/kriszyp/rql
	Relies on documentcloud/underscore to normalize JS
###

operatorMap =
	'=': 'eq'
	'==': 'eq'
	'>': 'gt'
	'>=': 'ge'
	'<': 'lt'
	'<=': 'le'
	'!=': 'ne'

class Query

	constructor: (query, parameters) ->

		query = '' unless query?

		term = @
		term.name = 'and'
		term.args = []

		topTerm = term

		if _.isObject query
			if _.isArray query
				topTerm.in 'id', query
				return
			else if query instanceof Query
				#_.extend term, query
				#console.log 'term', term
				query = query.toString()
			else
				for own k, v of query
					term = new Query()
					topTerm.args.push term
					term.name = 'eq'
					term.args = [k, v]
				return
		else
			throw new URIError 'Illegal query' unless typeof query is 'string'

		query = query.substring(1) if query.charAt(0) is '?'
		if query.indexOf('/') >= 0 # performance guard
			# convert slash delimited text to arrays
			query = query.replace /[\+\*\$\-:\w%\._]*\/[\+\*\$\-:\w%\._\/]*/g, (slashed) ->
				'(' + slashed.replace(/\//g, ',') + ')'

		# convert FIQL to normalized call syntax form
		query = query.replace /(\([\+\*\$\-:\w%\._,]+\)|[\+\*\$\-:\w%\._]*|)([<>!]?=(?:[\w]*=)?|>|<)(\([\+\*\$\-:\w%\._,]+\)|[\+\*\$\-:\w%\._]*|)/g, (t, property, operator, value) ->
			if operator.length < 3
				throw new URIError 'Illegal operator ' + operator unless operator of operatorMap
				operator = operatorMap[operator]
			else
				operator = operator.substring 1, operator.length - 1
			operator + '(' + property + ',' + value + ')'

		query = query.substring(1) if query.charAt(0) is '?'
		leftoverCharacters = query.replace /(\))|([&\|,])?([\+\*\$\-:\w%\._]*)(\(?)/g, (t, closedParen, delim, propertyOrValue, openParen) ->
			if delim
				if delim is '&'
					op = 'and'
				else if delim is '|'
					op = 'or'
				if op
					if not term.name
						term.name = op
					else if term.name isnt op
						throw new Error 'Cannot mix conjunctions within a group, use parenthesis around each set of same conjuctions (& and |)'
			if openParen
				newTerm = new Query()
				newTerm.name = propertyOrValue
				newTerm.parent = term
				term.args.push newTerm
				term = newTerm
			else if closedParen
				isArray = not term.name
				term = term.parent
				throw new URIError 'Closing parenthesis without an opening parenthesis' unless term
				if isArray
					term.args.push term.args.pop().args
			else if delim is ','
				if term.args.length is 0
					term.args.push ''
				term.args.push stringToValue propertyOrValue, parameters
			else if propertyOrValue
				term.args.push stringToValue propertyOrValue, parameters
			''
		throw new URIError 'Opening parenthesis without a closing parenthesis' if term.parent
		# any extra characters left over from the replace indicates invalid syntax
		throw new URIError 'Illegal character in query string encountered ' + leftoverCharacters if leftoverCharacters

		removeParentProperty = (obj) ->
			if obj?.args
				delete obj.parent
				_.each obj.args, removeParentProperty
			obj

		removeParentProperty topTerm

	toString: () ->
		if @name is 'and' then _.map(@args, queryToString).join('&') else queryToString @

	where: (query) ->
		@args = @args.concat(new Query(query).args)
		@

	#
	# TODO: build SQL
	#
	toSQL: (options = {}) -> throw Error 'Not implemented'

	#
	# build MongoDB structured query
	#
	toMongo: (options = {}) ->

		walk = (name, terms) ->
			search = {} # compiled search conditions
			# iterate over terms
			_.each terms or [], (term = {}) ->
				func = term.name
				args = term.args
				# ignore bad terms
				# N.B. this filters quirky terms such as for ?or(1,2) -- term here is a plain value
				return unless func and args
				# http://www.mongodb.org/display/DOCS/Querying
				# nested terms? -> recurse
				if _.isString(args[0]?.name) and _.isArray(args[0].args)
					if _.include valid_operators, func
						nested = walk func, args
						search['$'+func] = nested
					# N.B. here we encountered a custom function
					#console.log 'CUSTOM', func, args
					# ...
				# http://www.mongodb.org/display/DOCS/Advanced+Queries
				# structured query syntax
				else
					# handle special functions
					if func is 'sort' or func is 'select' or func is 'values'
						# sort/select/values affect query options
						if func is 'values'
							func = 'select'
							options.values = true # flag to invoke _.values
						#console.log 'ARGS', args
						pm = plusMinus[func]
						options[func] = {}
						# substitute _id for id
						args = _.map args, (x) -> if x is 'id' or x is '+id' then '_id' else x
						args = _.map args, (x) -> if x is '-id' then '-_id' else x
						_.each args, (x, index) ->
							x = x.join('.') if _.isArray x
							a = /([-+]*)(.+)/.exec x
							options[func][a[2]] = pm[(a[1].charAt(0) is '-')*1] * (index+1)
						return
					else if func is 'limit'
						# validate limit() args to be numbers, with sane defaults
						limit = args
						options.skip = +limit[1] or 0
						options.limit = +limit[0] or Infinity
						options.needCount = true
						return
					if func is 'le'
						func = 'lte'
					else if func is 'ge'
						func = 'gte'
					# args[0] is the name of the property
					key = args[0]
					args = args.slice 1
					key = key.join('.') if _.isArray key
					# prohibit keys started with $
					return if String(key).charAt(0) is '$'
					# substitute _id for id
					key = '_id' if key is 'id'
					# the rest args are parameters to func()
					if _.include requires_array, func
						args = args[0]
					# match on regexp means equality
					else if func is 'match'
						func = 'eq'
						regex = new RegExp
						regex.compile.apply regex, args
						args = regex
					else
						# FIXME: do we really need to .join()?!
						args = if args.length is 1 then args[0] else args.join()
					# regexp inequality means negation of equality
					func = 'not' if func is 'ne' and _.isRegExp args
					# valid functions are prepended with $
					if _.include valid_funcs, func
						func = '$'+func
					else
						#console.log 'CUSTOM', func, valid_funcs, args
						# N.B. here we encountered a custom function
						return
					# ids must be converted to ObjectIDs
					if Query.convertId and key is '_id'
						if _.isArray args
							args = args.map (x) -> Query.convertId x
						else
							args = Query.convertId args
					# $or requires an array of conditions
					#console.log 'COND', search, name, key, func, args
					if name is 'or'
						search = [] unless _.isArray search
						x = {}
						if func is '$eq'
							x[key] = args
						else
							y = {}
							y[func] = args
							x[key] = y
						search.push x
					# other functions pack conditions into object
					else
						# several conditions on the same property are merged into the single object condition
						search[key] = {} if search[key] is undefined
						search[key][func] = args if _.isObject(search[key]) and not _.isArray(search[key])
						# equality flushes all other conditions
						search[key] = args if func is '$eq'
				return
			# TODO: add support for query expressions as Javascript
			# TODO: add support for server-side functions
			#console.log 'OUT', search
			search

		search = walk @name, @args
		#console.log meta: options, search: search, terms: query
		if options.select
			options.fields = options.select
			delete options.select
		result =
			meta: options, search: search
		result.error = @error if @error
		result

stringToValue = (string, parameters) ->
	converter = converters.default
	if string.charAt(0) is '$'
		param_index = parseInt(string.substring(1), 10) - 1
		return if param_index >= 0 and parameters then parameters[param_index] else undefined
	if string.indexOf(':') >= 0
		parts = string.split ':', 2
		converter = converters[parts[0]]
		throw new URIError 'Unknown converter ' + parts[0] unless converter
		string = parts[1]
	converter string

queryToString = (part) ->
	if _.isArray part
		mapped = _.map part, (arg) -> queryToString arg
		'(' + mapped.join(',') + ')'
	else if part and part.name and part.args
		mapped = _.map part.args, (arg) -> queryToString arg
		part.name + '(' + mapped.join(',') + ')'
	else
		encodeValue part

encodeString = (s) ->
	if _.isString s
		s = encodeURIComponent s
		s = s.replace('(','%28').replace(')','%29') if s.match /[\(\)]/
	s

encodeValue = (val) ->
	if val is null
		return 'null'
	else if typeof val is 'undefined'
		return val
	if val isnt converters.default('' + (val.toISOString and val.toISOString() or val.toString()))
		if _.isRegExp val
			# TODO: control whether to we want simpler glob() style
			val = val.toString()
			i = val.lastIndexOf '/'
			type = if val.substring(i).indexOf('i') >= 0 then 're' else 'RE'
			val = encodeString val.substring(1, i)
			encoded = true
		else if _.isDate val
			type = 'epoch'
			val = val.getTime()
			encoded = true
		else if _.isString type
			type = 'string'
			val = encodeString val
			encoded = true
		else
			# FIXME: not very robust
			type = typeof val
		val = [type, val].join ':'
	val = encodeString val if not encoded and _.isString val
	val

autoConverted =
	'true': true
	'false': false
	'null': null
	'undefined': undefined
	'Infinity': Infinity
	'-Infinity': -Infinity

#
# FIXME: should reuse coerce() from validate.coffee?
#
converters =
	auto: (string) ->
		if string of autoConverted
			return autoConverted[string]
		number = +string
		if _.isNaN(number) or number.toString() isnt string
			string = decodeURIComponent string
			return string
		number
	number: (x) ->
		number = +x
		throw new URIError 'Invalid number ' + x if _.isNaN number
		number
	epoch: (x) ->
		date = new Date +x
		throw new URIError 'Invalid date ' + x unless _.isDate date
		date
	isodate: (x) ->
		# four-digit year
		date = '0000'.substr(0, 4-x.length) + x
		# pattern for partial dates
		date += '0000-01-01T00:00:00Z'.substring date.length
		converters.date date
	date: (x) ->
		isoDate = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/.exec x
		if isoDate
			date = new Date(Date.UTC(+isoDate[1], +isoDate[2] - 1, +isoDate[3], +isoDate[4], +isoDate[5], +isoDate[6]))
		else
			date = _.parseDate x
		throw new URIError 'Invalid date ' + x unless _.isDate date
		date
	boolean: (x) ->
		#x is 'true'
		if x is 'false' then false else not not x
	string: (string) ->
		decodeURIComponent string
	re: (x) ->
		new RegExp decodeURIComponent(x), 'i'
	RE: (x) ->
		new RegExp decodeURIComponent(x)
	glob: (x) ->
		s = decodeURIComponent(x).replace /([\\|\||\(|\)|\[|\{|\^|\$|\*|\+|\?|\.|\<|\>])/g, (x) -> '\\'+x
		s = s.replace(/\\\*/g,'.*').replace(/\\\?/g,'.?')
		s = if s.substring(0,2) isnt '.*' then '^'+s else s.substring(2)
		s = if s.substring(s.length-2) isnt '.*' then s+'$' else s.substring(0, s.length-2)
		new RegExp s, 'i'

converters.default = converters.auto

#
#
#
_.each ['eq', 'ne', 'le', 'ge', 'lt', 'gt', 'between', 'in', 'nin', 'contains', 'ncontains', 'or', 'and'], (op) ->
	Query.prototype[op] = (args...) ->
		@args.push
			name: op
			args: args
		@

parse = (query, parameters) ->
	#q = new Query query, parameters
	#return q
	try
		q = new Query query, parameters
	catch x
		q = new Query
		q.error = x.message
	q

#
# MongoDB
#
# valid funcs
valid_funcs = ['eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'in', 'nin', 'not', 'mod', 'all', 'size', 'exists', 'type', 'elemMatch']
# funcs which definitely require array arguments
requires_array = ['in', 'nin', 'all', 'mod']
# funcs acting as operators
valid_operators = ['or', 'and', 'not'] #, 'xor']
#
plusMinus =
	# [plus, minus]
	sort: [1, -1]
	select: [1, 0]

#################################################
#
# js-array
#
######

jsOperatorMap =
	'eq' : '==='
	'ne' : '!=='
	'le' : '<='
	'ge' : '>='
	'lt' : '<'
	'gt' : '>'

operators =

	and: (obj, conditions...) ->
		for cond in conditions
			obj = cond(obj) if _.isFunction cond
		obj

	or: (obj, conditions...) ->
		list = []
		for cond in conditions
			list = list.concat(cond(obj)) if _.isFunction cond
		_.uniq list

	limit: (list, limit, start = 0) ->
		list.slice start, start + limit

	slice: (list, start = 0, end = Infinity) ->
		list.slice start, end

	pick: (list, props...) ->
		# compose select hash
		include = []
		exclude = []
		_.each props, (x, index) ->
			leading = if _.isArray x then x[0] else x
			a = /([-+]*)(.+)/.exec leading
			if _.isArray x then x[0] = a[2] else x = a[2]
			if a[1].charAt(0) is '-'
				exclude.push x
			else
				include.push x
		# run filter
		#console.log 'SELECT', include, exclude
		_.map list, (item) ->
			# handle inclusion
			if _.isEmpty include
				selected = _.clone item
			else
				selected = {}
				for x in include
					value = _.drill item, x
					#console.log 'DRILLING', x, value
					continue if value is undefined
					if _.isArray x
						t = s = selected
						n = x.slice(-1)
						for i in x
							t[i] ?= {}
							s = t
							t = t[i]
						s[n] = value
					else
						selected[x] = value
			#console.log 'INCLUDED', selected
			# handle exclusion
			for x in exclude
				#console.log '-DRILLING', x
				_.drill selected, x, true
			selected

	values: () ->
		_.map operators.pick.apply(@, arguments), _.values

	sort: (list, props...) ->
		order = []
		_.each props, (x, index) ->
			leading = if _.isArray x then x[0] else x
			a = /([-+]*)(.+)/.exec leading
			if _.isArray x then x[0] = a[2] else x = a[2]
			if a[1].charAt(0) is '-'
				order.push
					attr: x
					order: -1
			else
				order.push
					attr: x
					order: 1
		# run sort
		#console.log 'ORDER', order
		list.sort (a, b) ->
			for prop in order
				#console.log 'COMPARE?', a, b, prop
				va = _.drill a, prop.attr
				vb = _.drill b, prop.attr
				#console.log 'COMPARE!', va, vb, prop
				return if va > vb then prop.order else -prop.order if va isnt vb
			0

	match: (list, prop, regex) ->
		regex = new RegExp regex, 'i' unless _.isRegExp regex
		_.select list, (x) -> regex.test _.drill x, prop

	nmatch: (list, prop, regex) ->
		regex = new RegExp regex, 'i' unless _.isRegExp regex
		_.select list, (x) -> not regex.test _.drill x, prop

	in: (list, prop, values) ->
		values = _.ensureArray values
		_.select list, (x) -> _.include values, _.drill x, prop

	nin: (list, prop, values) ->
		values = _.ensureArray values
		_.select list, (x) -> not _.include values, _.drill x, prop

	contains: (list, prop, value) ->
		_.select list, (x) -> _.include _.drill(x, prop), value

	ncontains: (list, prop, value) ->
		_.select list, (x) -> not _.include _.drill(x, prop), value

	between: (list, prop, minInclusive, maxExclusive) ->
		_.select list, (x) -> minInclusive <= _.drill(x, prop) < maxExclusive

	nbetween: (list, prop, minInclusive, maxExclusive) ->
		_.select list, (x) -> not (minInclusive <= _.drill(x, prop) < maxExclusive)

operators.select = operators.pick
operators.out = operators.nin
operators.excludes = operators.ncontains
operators.distinct = _.uniq

#
# stringification helper
#
stringify = (str) -> '"' + String(str).replace(/"/g, '\\"') + '"'

# N.B. you should clone the array if you sort, since sorting affects the original
query = (list, query, options = {}) ->

	#console.log 'QUERY?', query
	query = parse query, options.parameters
	# parse error -- don't hesitate, return empty array
	return [] if query.error
	#console.log 'QUERY!', query

	queryToJS = (value) ->
		if _.isObject(value) and not _.isRegExp(value) # N.B. V8 treats regexp as function...
			# FIXME: object and array simultaneously?!
			if _.isArray value
				'[' + _.map(value, queryToJS) + ']'
			else
				if value.name of jsOperatorMap
					# item['foo.bar'] ==> item?.foo?.bar
					path = value.args[0]
					prm = value.args[1]
					item = 'item'
					if prm is undefined
						prm = path
					else if _.isArray path
						escaped = []
						for p in path
							escaped.push stringify p
							item += '&&item[' + escaped.join('][') + ']'
					else
						item += '&&item[' + stringify(path) + ']'
					testValue = queryToJS prm
					# N.B. regexp equality means match, inequality -- no match
					if _.isRegExp testValue
						condition = testValue + ".test(#{item})"
						if value.name isnt 'eq'
							condition = "!(#{condition})"
					else
						condition = item + jsOperatorMap[value.name] + testValue
					#"_.select(list,function(item){return #{condition}})"
					"function(list){return _.select(list,function(item){return #{condition};});}"
				else if value.name of operators
					#"operators.#{value.name}(" + ['list'].concat(_.map(value.args, queryToJS)).join(',') + ')'
					"function(list){return operators['#{value.name}'](" + ['list'].concat(_.map(value.args, queryToJS)).join(',') + ');}'
				else
					# unknown function -- don't hesitate, return empty
					#"function(){return []}"
					"function(list){return _.select(list,function(item){return false;});}"
		else
			# escape strings
			if _.isString value then stringify(value) else value

	#expr = ';(function(list){return ' + queryToJS(query) + '})(list);'
	expr = queryToJS(query).slice(15, -1) # strip the outmost function(list) ...
	#console.log expr #, list
	if list then (new Function 'list, operators, _', expr) list, operators, _ else expr

#
# expose
#
_.mixin
	rql: parse
	query: query
