'use strict'

###

	JSONSchema Validator - Validates JavaScript objects using JSON Schemas
	(http://www.json.com/json-schema-proposal/)

	Copyright (c) 2007 Kris Zyp SitePen (www.sitepen.com)
	Copyright (c) 2011 Vladimir Dronnikov dronnikov@gmail.com

	Licensed under the MIT (MIT-LICENSE.txt) license

###

###
 *
 * Copyright(c) 2011 Vladimir Dronnikov <dronnikov@gmail.com>
 * MIT Licensed
 *
###

###
	Rewrite of kriszyp's json-schema validator https://github.com/kriszyp/json-schema
	Relies on documentcloud/underscore to normalize JS
###

#
# we allow property definition to contain `veto` attribute to control whether to retain the property after validation 
# if it's === true -- the property will be deleted
# if it is a hash, it specifies the flavors of validation ('add', 'update', 'get', 'query') when the property is deleted
#
# E.g. veto: {get: true} means when validation is called with truthy options.veto and options.flavor === 'get', the property will be deleted 
#

#
# given `value`, try to coerce it to `type`
#
# FIXME: we should skip conversion if type is matched?
#
coerce = (value, type) ->
	if type is 'string'
		value = if value then ''+value else ''
	else if type in ['number', 'integer']
		unless _.isNaN value
			value = +value;
			value = Math.floor value if type is 'integer'
	else if type is 'boolean'
		value = if value is 'false' then false else not not value
	else if type is 'null'
		value = null
	else if type is 'object'
		# can't really think of any sensible coercion to an object
		if JSON?.parse
			try
				value = JSON.parse value
			catch err
	else if type is 'array'
		value = _.ensureArray value
	else if type is 'date'
		date = _.parseDate value
		value = date if _.isDate date
	value

#
# N.B. since we allow "enum" attribute to be async, the whole validator is treated as async if callback is specified
#
# we allow type coercion if options.coerce
#

#
# N.B. properties are by default required, use `optional: true` to override
#

#
# N.B. we introduce `value` attribute which fixes the value of the property
#

#
# TODO: introduce rename attribute -- id ---!get---> _id ---get---> id
#

validate = (instance, schema, options = {}, callback) ->

	# save the context
	self = @

	# FIXME: what it is?
	_changing = options.changing

	# pending validators
	asyncs = []

	# collected errors
	errors = []

	# validate a value against a property definition
	checkProp = (value, schema, path, i) ->

		if path
			if _.isNumber i
				path += '[' + i + ']'
			else if i is undefined
				path += ''
			else
				path += '.' + i
		else
			path += i

		addError = (message) ->
			errors.push property: path, message: message

		if (typeof schema isnt 'object' or _.isArray schema) and (path or typeof schema isnt 'function') and not schema?.type
			if _.isFunction schema
				addError 'type' unless value instanceof schema
			else if schema
				addError 'invalid'
			return null

		if _changing and schema.readonly
			addError 'readonly'

		if schema.extends # if it extends another schema, it must pass that schema as well
			checkProp value, schema.extends, path, i

		# validate a value against a type definition
		checkType = (type, value) ->
			if type
				# TODO: coffee-ize, underscore-ize
				if typeof type is 'string' and type isnt 'any' and
						`(type == 'null' ? value !== null : typeof value !== type) &&
						!(type === 'array' && _.isArray(value)) &&
						!(type === 'date' && _.isDate(value)) &&
						!(type === 'integer' && value%1===0)`
					return [property: path, message: 'type']
				if _.isArray type
					# a union type
					unionErrors = []
					for t in type
						unionErrors = checkType t, value
						break unless unionErrors.length
					return unionErrors if unionErrors.length
				else if typeof type is 'object'
					priorErrors = errors
					errors = []
					checkProp value, type, path
					theseErrors = errors
					errors = priorErrors
					return theseErrors
			[]

		if value is undefined
			if (not schema.optional or typeof schema.optional is 'object' and not schema.optional[options.flavor]) and not schema.get and not schema.default?
				addError 'required'
		else
			errors = errors.concat checkType schema.type, value
			if schema.disallow and not checkType(schema.disallow, value).length
				addError 'disallowed'
			if value isnt null
				if _.isArray value
					if schema.items
						itemsIsArray = _.isArray schema.items
						propDef = schema.items
						for v, i in value
							if itemsIsArray
								propDef = schema.items[i]
							if options.coerce and propDef.type
								value[i] = coerce v, propDef.type
							errors.concat checkProp v, propDef, path, i
					if schema.minItems and value.length < schema.minItems
						addError 'minItems'
					if schema.maxItems and value.length > schema.maxItems
						addError 'maxItems'
				else if schema.properties or schema.additionalProperties
					errors.concat checkObj value, schema.properties, path, schema.additionalProperties
				if _.isString value
					if schema.pattern and not value.match schema.pattern
						addError 'pattern'
					if schema.maxLength and value.length > schema.maxLength
						addError 'maxLength'
					if schema.minLength and value.length < schema.minLength
						addError 'minLength'
				if schema.minimum isnt undefined and typeof value is typeof schema.minimum and schema.minimum > value
					addError 'minimum'
				if schema.maximum isnt undefined and typeof value is typeof schema.maximum and schema.maximum < value
					addError 'maximum'
				if schema.enum
					enumeration = schema.enum
					# if function specified, distinguish between async and sync flavors
					if _.isFunction enumeration
						# async validator
						if enumeration.length is 2
							asyncs.push value: value, path: path, fetch: enumeration
						# sync validator
						else if enumeration.length is 1
							addError 'enum' unless enumeration.call(self, value)
						# sync getter
						else
							enumeration = enumeration.call self
							addError 'enum' unless _.include enumeration, value
					else
						# simple array
						addError 'enum' unless _.include enumeration, value
				if _.isNumber(schema.maxDecimal) and (new RegExp("\\.[0-9]{#{(schema.maxDecimal+1)},}")).test value
					addError 'digits'
		null

	# validate an object against a schema
	checkObj = (instance, objTypeDef = {}, path, additionalProp) ->

		if _.isObject objTypeDef
			if typeof instance isnt 'object' or _.isArray instance
				errors.push property: path, message: 'type'
			for own i, propDef of objTypeDef
				value = instance[i]
				# set the value unconditionally if 'value' attribute specified
				if 'value' of propDef
					value = instance[i] = propDef.value
				# skip _not_ specified properties
				continue if value is undefined and options.existingOnly
				# veto props
				if options.veto and (propDef.veto is true or typeof propDef.veto is 'object' and propDef.veto[options.flavor])
					delete instance[i]
					continue
				# done with validation if it is called for 'get' or 'query' and no coercion needed
				continue if options.flavor in ['query', 'get'] and not options.coerce
				# set default if validation called for 'add'
				if value is undefined and propDef.default? and options.flavor is 'add'
					value = instance[i] = propDef.default
				# throw undefined properties
				if value is undefined
					delete instance[i]
					continue
				# coerce if coercion is enabled
				if options.coerce and propDef.type and instance.hasOwnProperty i
					value = coerce value, propDef.type
					instance[i] = value
				#
				checkProp value, propDef, path, i

		for i, value of instance
			if instance.hasOwnProperty(i) and not objTypeDef[i] and (additionalProp is false or options.removeAdditionalProps)
				if options.removeAdditionalProps
					delete instance[i]
					continue
				else
					errors.push property: path, message: 'unspecifed'
			requires = objTypeDef[i]?.requires
			if requires and not instance.hasOwnProperty requires
				errors.push property: path, message: 'requires'
			# N.B. additional properties are validated only if schema is specified in additionalProperties
			# otherwise they just go intact
			if additionalProp?.type and not objTypeDef[i]
				# coerce if coercion is enabled
				if options.coerce and additionalProp.type
					value = coerce value, additionalProp.type
					instance[i] = value
					checkProp value, additionalProp, path, i
			if not _changing and value?.$schema
				errors = errors.concat checkProp value, value.$schema, path, i
		errors

	if schema
		checkProp instance, schema, '', _changing or ''

	if not _changing and instance?.$schema
		checkProp instance, instance.$schema, '', ''

	# TODO: extend async validators to query the property values?

	# run async validators, if any
	len = asyncs.length
	if callback and len
		for async, i in asyncs
			do (async) ->
				async.fetch.call self, async.value, (err) ->
					if err
						errors.push property: async.path, message: 'enum'
					len -= 1
					# proceed when async validators are done
					unless len
						callback errors.length and errors or null, instance
	else if callback
		callback errors.length and errors or null, instance
	else
		return errors.length and errors or null

	return

#
# expose
#
_.mixin
	coerce: coerce
	validate: validate
