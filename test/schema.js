$(document).ready(function(){

	//
	////////////////////////////////////////////////////////////////////
	//

	(function(){
	var obj;

	module('Validate: coerce');

	test('falsy', function(){
		equal(_.coerce(undefined, 'string'), '');
		equal(_.coerce(null, 'string'), '');
		equal(_.coerce(0, 'string'), '0');
		equal(_.coerce(false, 'string'), 'false');
		equal(_.coerce(NaN, 'string'), 'NaN');
	});

	test('truthy', function(){
		equal(_.coerce(1, 'string'), '1');
		equal(_.coerce(1.0, 'string'), '1');
		equal(_.coerce(1.1, 'string'), '1.1');
		equal(_.coerce(true, 'string'), 'true');
		equal(_.coerce([], 'string'), '');
		equal(_.coerce({}, 'string'), '[object Object]');
	});

	})();

	//
	////////////////////////////////////////////////////////////////////
	//

	(function(){
	var obj;

	module('Validate: schema');

	test('value attribute', function(){
		obj = {id: 'bac', foo: '4'};
		equal(_.validate(obj, {
			type: 'object',
			properties: {
				foo: {
					value: 'Зафиксировано'
				}
			},
			additionalProperties: true
		}, {veto: true, removeAdditionalProps: false, flavor: 'add', coerce: true}),
			null, 'coerced and added ok');
		deepEqual(obj, {id: 'bac', foo: 'Зафиксировано'}, 'schema ok');
	});

	test('empty properties', function(){
		obj = {id: 'bac', foo: '4', bar: 'vareniki', spam: true};
		equal(_.validate(obj, {
			type: 'object',
			properties: {
			},
			additionalProperties: true
		}, {veto: true, removeAdditionalProps: false, flavor: 'add', coerce: true}),
			null, 'coerced and added ok');
		deepEqual(obj, {id: 'bac', foo: '4', bar: 'vareniki', spam: true}, 'schema ok');
	});

	test('undefined properties', function(){
		obj = {id: 'bac', foo: '4', bar: 'vareniki', spam: true};
		equal(_.validate(obj, {
			type: 'object',
			additionalProperties: true
		}, {veto: true, removeAdditionalProps: false, flavor: 'add', coerce: true}),
			null, 'coerced and added ok');
		deepEqual(obj, {id: 'bac', foo: '4', bar: 'vareniki', spam: true}, 'schema ok');
	});

	test('undefined properties and additionalProperties=false', function(){
		obj = {id: 'bac', foo: '4', bar: 'vareniki', spam: true};
		equal(_.validate(obj, {
			type: 'object',
			additionalProperties: false
		}, {veto: true, removeAdditionalProps: true, flavor: 'add', coerce: true}),
			null, 'coerced and added ok');
		deepEqual(obj, {id: 'bac', foo: '4', bar: 'vareniki', spam: true}, 'schema ok');
	});

	test('greedy coercion for optionals', function(){
		obj = {foo: undefined, bar: null};
		equal(_.validate(obj, {
			type: 'object',
			properties: {
				foo: {
					type: 'string',
					pattern: /^aaa$/,
					optional: true
				},
				bar: {
				}
			},
			additionalProperties: true
		}, {veto: true, removeAdditionalProps: false, flavor: 'add', coerce: true}),
			null, 'optionals not coerced ok');
		deepEqual(obj, {bar: null}, 'schema ok');
	});

	test('fixed values', function(){
		obj = {foo: 'baz'};
		equal(_.validate(obj, {
			type: 'object',
			properties: {
				foo: {
					type: 'string',
					value: 'bar',
					veto: {
						update: true
					}
				}
			},
			additionalProperties: false
		}, {veto: true, removeAdditionalProps: true, flavor: 'add', coerce: true}),
			null, 'fixed values fixed ok');
		deepEqual(obj, {foo: 'bar'}, 'schema ok');
		//
		obj = {};
		equal(_.validate(obj, {
			type: 'object',
			properties: {
				foo: {
					type: 'string',
					value: 'bar',
					veto: {
						update: true
					}
				}
			},
			additionalProperties: false
		}, {veto: true, removeAdditionalProps: true, flavor: 'add', coerce: true}),
			null, 'fixed values fixed ok');
		deepEqual(obj, {foo: 'bar'}, 'schema ok');
	});

	})();

	//
	////////////////////////////////////////////////////////////////////
	//

	(function(){
	var schema, obj;

	module('Validate: additionalProperties=false');

	schema = {
		type: 'object',
		properties: {
			id: {
				type: 'string',
				pattern: /^[abc]+$/,
				veto: {
					update: true
				}
			},
			foo: {
				type: 'integer',
				veto: {
					get: true
				}
			},
			bar: {
				type: 'array',
				items: {
					type: 'string',
					'enum': ['eniki', 'beniki', 'eli', 'vareniki']
				},
				veto: {
					query: true
				}
			},
			defaulty: {
				type: 'date',
				'default': '2011-02-14'
			}
		},
		additionalProperties: false
	};

	test('add', function(){
		obj = {id: 'bac', foo: '4', bar: 'vareniki', spam: true};
		equal(_.validate(obj, schema, {veto: true, removeAdditionalProps: !schema.additionalProperties, flavor: 'add', coerce: true}),
			null, 'coerced and added ok');
		//console.log(obj.defaulty, _.parseDate('2011-02-14'));
		deepEqual(obj, {id: 'bac', foo: 4, bar: ['vareniki'], defaulty: _.parseDate('2011-02-14')}, 'coerced for "add" ok');
		//
		obj = {id: 'bac1', foo: 'a', bar: 'pelmeshki'};
		deepEqual(_.validate(obj, schema, {veto: true, removeAdditionalProps: !schema.additionalProperties, flavor: 'add', coerce: true}),
			[{property: 'id', message: 'pattern'}, {'property': 'foo', 'message': 'type'}, {'property': 'bar[0]', 'message': 'enum'}], 'validate for "add"');
		//
		obj = {id: 'bac'};
		deepEqual(_.validate(obj, schema, {veto: true, removeAdditionalProps: !schema.additionalProperties, flavor: 'add', coerce: true}),
			[{'property': 'foo', 'message': 'required'}, {'property': 'bar', 'message': 'required'}], 'validate for "add"');
	});

	test('update', function(){
		obj = {id: 'bac', foo1: '5', bar: ['eli', 'eniki']};
		deepEqual(_.validate(obj, schema, {veto: true, removeAdditionalProps: !schema.additionalProperties, existingOnly: true, flavor: 'update', coerce: true}),
			null, 'validate for "update" nak: required');
		deepEqual(obj, {bar: ['eli', 'eniki']}, 'validate for "update" ok');
		obj = {id: 'bac', foo: '5', bar: ['eli', 'eniki']};
		deepEqual(_.validate(obj, schema, {veto: true, removeAdditionalProps: !schema.additionalProperties, existingOnly: true, flavor: 'update', coerce: true}),
			null, 'validate for "update" ok');
		deepEqual(obj, {foo: 5, bar: ['eli', 'eniki']}, 'validate for "update" ok');
	});

	test('get', function(){
		obj = {id: 'bac', foo: '5', bar: ['eli', 'eniki'], secret: true};
		deepEqual(_.validate(obj, schema, {veto: true, removeAdditionalProps: !schema.additionalProperties, flavor: 'get'}),
			null, 'validate for "get" ok');
		deepEqual(obj, {id: 'bac', bar: ['eli', 'eniki']}, 'validate for "get" ok');
	});

	test('query', function(){
		obj = {id: 'bac', foo: '5', bar: ['eli', 'eniki'], secret: true};
		deepEqual(_.validate(obj, schema, {veto: true, removeAdditionalProps: !schema.additionalProperties, flavor: 'query'}),
			null, 'validate for "query" ok');
		deepEqual(obj, {id: 'bac', foo: '5'}, 'validate for "query" ok');
	});

	})();

	//
	////////////////////////////////////////////////////////////////////
	//

	(function(){
	var schema, obj;

	module('Validate: additionalProperties=true');

	schema = {
		type: 'object',
		properties: {
			id: {
				type: 'string',
				pattern: /^[abc]+$/,
				veto: {
					update: true
				}
			},
			foo: {
				type: 'integer',
				veto: {
					get: true
				}
			},
			bar: {
				type: 'array',
				items: {
					type: 'string',
					'enum': ['eniki', 'beniki', 'eli', 'vareniki']
				},
				veto: {
					query: true
				}
			},
			defaulty: {
				type: 'date',
				'default': '2011-02-14'
			}
		},
		additionalProperties: true
	};

	test('add', function(){
		obj = {id: 'bac', foo: '4', bar: 'vareniki', spam: true};
		equal(_.validate(obj, schema, {veto: true, removeAdditionalProps: !schema.additionalProperties, flavor: 'add', coerce: true}),
			null, 'coerced and added ok');
		deepEqual(obj, {id: 'bac', foo: 4, bar: ['vareniki'], defaulty: _.parseDate('2011-02-14'), spam: true}, 'coerced for "add" ok');
		obj = {id: 'bac1', foo: 'a', bar: 'pelmeshki'};
		deepEqual(_.validate(obj, schema, {veto: true, removeAdditionalProps: !schema.additionalProperties, flavor: 'add', coerce: true}),
			[{property: 'id', message: 'pattern'}, {'property': 'foo', 'message': 'type'}, {'property': 'bar[0]', 'message': 'enum'}], 'validate for "add"');
	});

	test('update', function(){
		obj = {id: 'bac', foo1: '5', bar: ['eli', 'eniki']};
		deepEqual(_.validate(obj, schema, {veto: true, removeAdditionalProps: !schema.additionalProperties, existingOnly: true, flavor: 'update', coerce: true}),
			null, 'validate for "update" nak: required');
		deepEqual(obj, {bar: ['eli', 'eniki'], foo1: '5'}, 'validate for "update" ok');
		obj = {id: 'bac', foo: '5', bar: ['eli', 'eniki']};
		deepEqual(_.validate(obj, schema, {veto: true, removeAdditionalProps: !schema.additionalProperties, existingOnly: true, flavor: 'update', coerce: true}),
			null, 'validate for "update" ok');
		deepEqual(obj, {foo: 5, bar: ['eli', 'eniki']}, 'validate for "update" ok');
	});

	test('get', function(){
		obj = {id: 'bac', foo: '5', bar: ['eli', 'eniki'], secret: true};
		deepEqual(_.validate(obj, schema, {veto: true, removeAdditionalProps: !schema.additionalProperties, flavor: 'get'}),
			null, 'validate for "get" ok');
		deepEqual(obj, {id: 'bac', bar: ['eli', 'eniki'], secret: true}, 'validate for "get" ok');
	});

	test('query', function(){
		obj = {id: 'bac', foo: '5', bar: ['eli', 'eniki'], secret: true};
		deepEqual(_.validate(obj, schema, {veto: true, removeAdditionalProps: !schema.additionalProperties, flavor: 'query'}),
			null, 'validate for "query" ok');
		deepEqual(obj, {id: 'bac', foo: '5', secret: true}, 'validate for "query" ok');
	});

	})();

	//
	////////////////////////////////////////////////////////////////////
	//

	(function(){
	var schema, obj;

	module('Validate: additionalProperties=schema');

	schema = {
		type: 'object',
		properties: {
			id: {
				type: 'string',
				pattern: /^[abc]+$/,
				veto: {
					update: true
				}
			},
			foo: {
				type: 'integer',
				veto: {
					get: true
				}
			},
			bar: {
				type: 'array',
				items: {
					type: 'string',
					'enum': ['eniki', 'beniki', 'eli', 'vareniki']
				}
				,
				veto: {
					query: true
				}
			},
			defaulty: {
				type: 'date',
				'default': '2011-12-31'
			}
		},
		additionalProperties: {
			type: 'number',
			maxDecimal: 2
		}
	};

	test('add', function(){
		obj = {id: 'bac', foo: '4', bar: 'vareniki', spam: true};
		equal(_.validate(obj, schema, {veto: true, removeAdditionalProps: !schema.additionalProperties, flavor: 'add', coerce: true}),
			null, 'coerced and added ok');
		deepEqual(obj, {id: 'bac', foo: 4, bar: ['vareniki'], defaulty: _.parseDate('2011-12-31'), spam: 1}, 'coerced for "add" ok');
		obj = {id: 'bac1', foo: 'a', bar: 'pelmeshki'};
		deepEqual(_.validate(obj, schema, {veto: true, removeAdditionalProps: !schema.additionalProperties, flavor: 'add', coerce: true}),
			[{property: 'id', message: 'pattern'}, {'property': 'foo', 'message': 'type'}, {'property': 'bar[0]', 'message': 'enum'}], 'validate for "add"');
	});

	test('update', function(){
		obj = {id: 'bac', foo1: '5.111', bar: ['eli', 'eniki']};
		deepEqual(_.validate(obj, schema, {veto: true, removeAdditionalProps: !schema.additionalProperties, existingOnly: true, flavor: 'update', coerce: true}),
			[{property: 'foo1', message: 'digits'}], 'validate for "update" nak: digits');
		obj = {id: 'bac', foo1: '5.11', bar: ['eli', 'eniki']};
		deepEqual(_.validate(obj, schema, {veto: true, removeAdditionalProps: !schema.additionalProperties, existingOnly: true, flavor: 'update', coerce: true}),
			null, 'validate for "update" ok');
		deepEqual(obj, {bar: ['eli', 'eniki'], foo1: 5.11}, 'validate for "update" ok');
		obj = {id: 'bac', foo: '5', bar: ['eli', 'eniki']};
		deepEqual(_.validate(obj, schema, {veto: true, removeAdditionalProps: !schema.additionalProperties, existingOnly: true, flavor: 'update', coerce: true}),
			null, 'validate for "update" ok');
		deepEqual(obj, {foo: 5, bar: ['eli', 'eniki']}, 'validate for "update" ok');
	});

	test('get', function(){
		obj = {id: 'bac', foo: '5', bar: ['eli', 'eniki'], secret: true};
		deepEqual(_.validate(obj, schema, {veto: true, removeAdditionalProps: !schema.additionalProperties, flavor: 'get'}),
			null, 'validate for "get" ok');
		deepEqual(obj, {id: 'bac', bar: ['eli', 'eniki'], secret: true}, 'validate for "get" ok');
	});

	test('query', function(){
		obj = {id: 'bac', foo: '5', bar: ['eli', 'eniki'], secret: true};
		deepEqual(_.validate(obj, schema, {veto: true, removeAdditionalProps: !schema.additionalProperties, flavor: 'query'}),
			null, 'validate for "query" ok');
		deepEqual(obj, {id: 'bac', foo: '5', secret: true}, 'validate for "query" ok');
	});

	})();

	//
	////////////////////////////////////////////////////////////////////
	//

});
