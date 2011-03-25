$(document).ready(function(){

	module('Object');

	test('drill-down', function(){
		var obj = {a:{b:{c:{d:[1,2,3]}}}};
		deepEqual(_.get(obj, ['a','b','c','d',0]), 1, 'get deep property');
		deepEqual(_.get(obj), obj, 'get deep property');
		deepEqual(_.get(obj, [undefined, undefined, undefined]), undefined, 'get deep property');
		deepEqual(_.get(obj, ['a', 'non', 'existing']), undefined, 'get deep property');
		deepEqual(_.get(_.clone(obj), ['a','b','c','d',1], true), {a:{b:{c:{d:[1,undefined,3]}}}}, 'remove deep property');
		deepEqual(_.get(_.clone(obj), ['a','non','existing','d',1], true), obj, 'remove deep property');
	});

	test('toHash', function(){
		var obj = [{a:1,b:2,c:{d:'foo'}},{a:2,b:3,c:{d:'bar'}},{a:3,b:4,c:{d:'baz'}}];
		deepEqual(_.toHash(obj, 'a'), {1:{a:1,b:2,c:{d:'foo'}},2:{a:2,b:3,c:{d:'bar'}},3:{a:3,b:4,c:{d:'baz'}}}, 'shallow toHash');
		deepEqual(_.toHash(obj, ['c','d']), {foo:{a:1,b:2,c:{d:'foo'}},bar:{a:2,b:3,c:{d:'bar'}},baz:{a:3,b:4,c:{d:'baz'}}}, 'deep toHash');
	});

	if (Object.freeze) {
	test('proxy', function(){
		var obj = {action: function(x){return 'acted';}, deep: {action: function(x){return 'acted from deep';}}, private: function(){return 'hidden';}};
		deepEqual(_.proxy(obj, ['action']), {action: obj.action}, 'simple');
		deepEqual(_.proxy(obj, [['deep', 'action']]), {action: obj.deep}, 'named');
		deepEqual(_.proxy(obj, [[['deep', 'action'], 'action']]), {action: obj.deep.action}, 'deep and named');
		equals(_.proxy(obj, [[['deep', 'action'], 'action']]).action(), 'acted from deep', 'deep and named');
		deepEqual(_.proxy(obj, [[console.log, 'log']]), {log: console.log}, 'renamed foreign method');
	});

	test('shallow frozen with Object.freeze', function(){
		var obj = {a:{b:{c:{d:[1,2,3]}}}};
		Object.freeze(obj);
		obj.a = 1;
		deepEqual(obj, {a:{b:{c:{d:[1,2,3]}}}}, 'shallow');
		obj.a.b.c.d.push(4);
		deepEqual(obj, {a:{b:{c:{d:[1,2,3,4]}}}}, 'shallow');
		obj.a.b = 1;
		deepEqual(obj, {a:{b:1}}, 'shallow');
	});

	test('deeply (really) frozen with _.freeze', function(){
		var obj = {a:{b:{c:{d:[1,2,3]}}}};
		_.freeze(obj);
		try { obj.a = 1; } catch (x){}
		deepEqual(obj, {a:{b:{c:{d:[1,2,3]}}}}, 'deep');
		try { obj.a.b.c.d.push(4); } catch (x){}
		deepEqual(obj, {a:{b:{c:{d:[1,2,3]}}}}, 'deep');
		try { obj.a.b = 1; } catch (x){}
		deepEqual(obj, {a:{b:{c:{d:[1,2,3]}}}}, 'deep');
	});
	}

});
