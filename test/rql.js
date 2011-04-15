function testSchema(data){
	data = data.postalcodes;
	//console.log('TEST', data);
	test("real data -- geonames of postal code 17000", function(){
		equals(_.query(data, 'countryCode=CZ').length, 4);
		equals(_.query(data, _.rql().eq('placeName','Holešovice (část)')).length, 1);
		deepEqual(_.query(data, _.rql('placeName=Hole%C5%A1ovice%20%28%C4%8D%C3%A1st%29,values(adminCode1)')), [["3100"]]);
		//console.log(_.rql('placeName=string%3AHole%C5%A1ovice%2520%28%C4%8D%C3%A1st%29'));
		equals(_.query(_.clone(data), 'countryCode=TR&sort(-placeName)').length, 13);
		deepEqual(_.query(_.clone(data), 'countryCode=TR&sort(-placeName)&limit(2,2)&pick(placeName)'),
			[{placeName: 'Kizilcaören Köyü'},{placeName: 'Kemalköy Köyü'}]);
	});
}

// equality of queries `a` and `b`
function deq(a, b, msg){
	//if (a && a.error && b && b.error)
	deepEqual(a.error, b.error, msg);
	//if (a && a.name && b && b.name)
	deepEqual(a.name, b.name, msg);
	if (_.isArray(a.args)) {
		for (var i = 0, l = a.args.length; i < l; ++i) {
			if (_.isObject(a.args[i])) {
				deq(a.args[i], b.args[i], msg);
			} else {
				deepEqual(a.args[i], b.args[i], msg);
				//deq(a.args[i], b.args[i], msg);
			}
		}
	} else {
		deepEqual(a.args, b.args, msg);
		//deq(a.args, b.args, msg);
	}
}

$(document).ready(function(){

///////////////////////////////////////
//
// this data taken from kriszyp/rql tests
//

var queryPairs = {
    "arrays": [
        {"a": {name:"and", args:["a"]}},
        {"(a)": {name:"and", args:[["a"]]}},
        {"a,b,c": {name:"and", args:["a", "b", "c"]}},
        {"(a,b,c)": {name:"and", args:[["a", "b", "c"]]}},
        {"a(b)": {name:"and","args":[{"name":"a","args":["b"]}]}},
        {"a(b,c)": {name:"and", args:[{name:"a", args:["b", "c"]}]}},
        {"a((b),c)": {"name": "and", args:[{name:"a", args:[["b"], "c"]}]}},
        {"a((b,c),d)": {name:"and", args:[{name:"a", args:[["b", "c"], "d"]}]}},
        {"a(b/c,d)": {name:"and", args:[{name:"a", args:[["b", "c"], "d"]}]}},
        {"a(b)&c(d(e))": {name:"and", args:[
            {name:"a", args:["b"]},
            {name:"c", args:[{name:"d", args:["e"]}]}
        ]}}
    ],
    "dot-comparison": [
    	{"foo.bar=3": {name:"and", args:[{name:"eq", args:["foo.bar",3]}]}},
    	{"select(sub.name)": {name:"and", args:[{name:"select", args:["sub.name"]}]}}
    ],
    "equality": [
        {"eq(a,b)": {name:"and", args:[{name:"eq", args:["a","b"]}]}},
        {"a=eq=b": "eq(a,b)"},
        {"a=b": "eq(a,b)"}
    ],
    "inequality": [
        {"ne(a,b)": {name:"and", args:[{name:"ne", args:["a", "b"]}]}},
        {"a=ne=b": "ne(a,b)"},
        {"a!=b": "ne(a,b)"}
    ],
    "less-than": [
        {"lt(a,b)": {name:"and", args:[{name:"lt", args:["a", "b"]}]}},
        {"a=lt=b": "lt(a,b)"},
        {"a<b": "lt(a,b)"}
    ],
    "less-than-equals": [
        {"le(a,b)": {name:"and", args:[{name:"le", args:["a","b"]}]}},
        {"a=le=b": "le(a,b)"},
        {"a<=b": "le(a,b)"}
    ],
    "greater-than": [
        {"gt(a,b)": {name:"and", args:[{name:"gt", args:["a", "b"]}]}},
        {"a=gt=b": "gt(a,b)"},
        {"a>b": "gt(a,b)"}
    ],
    "greater-than-equals": [
        {"ge(a,b)": {name:"and", args:[{name:"ge", args:["a", "b"]}]}},
        {"a=ge=b": "ge(a,b)"},
        {"a>=b": "ge(a,b)"}
    ],
    "nested comparisons": [
        {"a(b(le(c,d)))": {name:"and", args:[{name:"a", args:[{name:"b", args:[{name:"le", args:["c", "d"]}]}]}]}},
        {"a(b(c=le=d))": "a(b(le(c,d)))"},
        {"a(b(c<=d))": "a(b(le(c,d)))"}
    ],
    "arbitrary FIQL desugaring": [
        {"a=b=c": {name:"and", args:[{name:"b", args:["a", "c"]}]}},
        {"a(b=cd=e)": {name:"and", args:[{name:"a", args:[{name:"cd", args:["b", "e"]}]}]}}
    ],
    "and grouping": [
        {"a&b&c": {name:"and", args:["a", "b", "c"]}},
        {"a(b)&c": {name:"and", args:[{name:"a", args:["b"]}, "c"]}},
        {"a&(b&c)": {"name":"and","args":["a",{"name":"and","args":["b","c"]}]}}
    ],
    "or grouping": [
        {"(a|b|c)": {name:"and", args:[{name:"or", args:["a", "b", "c"]}]}},
        {"(a(b)|c)": {name:"and", args:[{name:"or", args:[{name:"a", args:["b"]}, "c"]}]}}
    ],
    "complex grouping": [
        {"a&(b|c)": {name:"and", args:["a", {name:"or", args:["b", "c"]}]}},
        {"a|(b&c)": {name:"and", args:[{name:"or", args:["a", {name:"and", args:["b", "c"]}]}]}},
        {"a(b(c<d,e(f=g)))": {}}
    ],
    "complex comparisons": [

    ],
    "string coercion": [
        {"a(string)": {name:"and", args:[{name:"a", args:["string"]}]}},
        {"a(string:b)": {name:"and", args:[{name:"a", args:["b"]}]}},
        {"a(string:1)": {name:"and", args:[{name:"a", args:["1"]}]}}
    ],
    "number coercion": [
        {"a(number)": {name:"and", args:[{name:"a", args:["number"]}]}},
        {"a(number:1)": {name:"and", args:[{name:"a", args:[1]}]}}
//        {"a(number:b)": {name:"and", args:[{name:"a", args:[NaN]}]}} // supposed to throw an error
    ],
    "date coercion": [
        {"a(date)": {name:"and", args:[{name:"a", args:["date"]}]}},
        {"a(date:2009)": {name:"and", args:[{name:"a", args:[(new Date("2009"))]}]}}
        //{"a(date:b)": {name:"and", args:[{name:"a", args:[(new Date(NaN))]}]}} // XXX?// supposed to throw an error
    ],
    "boolean coercion": [
        {"a(true)": {name:"and", args:[{name:"a", args:[true]}]}},
        {"a(false)": {name:"and", args:[{name:"a", args:[false]}]}},
        {"a(boolean:true)": {name:"and", args:[{name:"a", args:[true]}]}}
    ],
    "null coercion": [
        {"a(null)": {name:"and", args:[{name:"a", args:[null]}]}},
        {"a(auto:null)": {name:"and", args:[{name:"a", args:[null]}]}},
        {"a(string:null)": {name:"and", args:[{name:"a", args:["null"]}]}}
    ],
    "complex coercion": [
        {"(a=b|c=d)&(e=f|g=1)": {"name":"and","args":[{"name":"or","args":[{"name":"eq","args":["a","b"]},{"name":"eq","args":["c","d"]}]},
        {"name":"or","args":[{"name":"eq","args":["e","f"]},{"name":"eq","args":["g",1]}]}]}}
    ],
    "complex grouping": [

    ]
};

var data = window.data = [{
		"with/slash": "slashed",
		"nested": {
			"property": "value"
		},
		"price": 10,
		"name": "ten",
		"tags": ["fun", "even"]
	},{
		"price": 5,
		"name": "five",
		"tags": ["fun"]
	}];

///////////////////////////////////////

	module("RQL");

	test("parsing", function(){
    for (var group in queryPairs) {
        _.each(queryPairs[group], function(pair){
            var key = _.keys(pair)[0];
            try{
	            var parsed = _.rql(key);
	            var result = pair[key];
	            if(_.isString(result)){
	            	result = _.rql(result);
	            }
            }catch(e){
            	e.message += " parsing " + group + ": " + key;
            	throw e;
            }
            try{
            	var serialized = JSON.stringify(parsed);
            }catch(e){
            	serialized = e.message;
            }
            deq(parsed, result, group + ": " + key + " " + serialized);
        });
    }
	});

	test("FAILING", function(){
		deepEqual(_.rql('limit(,1,2,)').args[0].args, ['', 1, 2, '']);
	});

	test("toMongo()", function(){
		//console.log(_.rql('a!=b').toMongo());
		//deq(_.rql('a!=b'), {name: 'and', args: [{name: 'ne', args: ['a', 'b']}]});
		deepEqual(_.rql('a!=b').toMongo(), {meta: {}, search: {a: {$ne: 'b'}}});
		deepEqual(_.rql('a!=b,in(c,(d,e,f)),b!=re:re,limit(1,2),sort(-a/b/c,+c.d.e)&select(u,f.h.c,-f/g/h)').toMongo(),
			{meta: {skip: 2, limit: 1, needCount: true, sort: {'a.b.c': -1, 'c.d.e': 2}, fields: {u: 1, 'f.h.c': 2, 'f.g.h': 0}}, search: {a: {$ne: 'b'}, c: {$in: ['d','e','f']}, b: {$not: /re/i}}});
		//console.log(_.rql('(a!=b|in(c,(d,e,f)),b!=re:re),limit(1,2),sort(-a/b/c,+c.d.e)&select(u,f.h.c,-f/g/h)').toMongo());
		deq(_.rql('(a!=b|in(c,(d,e,f)),b!=re:re),limit(1,2),sort(-a/b/c,+c.d.e)&select(u,f.h.c,-f/g/h)'),
			{name: 'and', args: [{name: 'or', args: [
				{name: 'ne', args: ['a', 'b']},
				{name: 'in', args: ['c', ['d', 'e', 'f']]},
				{name: 'ne', args: ['b', /re/i]}
			]},
			{name: 'limit', args: [1, 2]},
			{name: 'sort', args: [['-a', 'b', 'c'], '+c.d.e']},
			{name: 'select', args: ['u', 'f.h.c', ['-f', 'g', 'h']]}
			]});
		deepEqual(_.rql('(a!=b|in(c,(d,e,f)),b!=re:re),limit(1,2),sort(-a/b/c,+c.d.e)&select(u,f.h.c,-f/g/h)').toMongo(),
			{meta: {skip: 2, limit: 1, needCount: true, sort: {'a.b.c': -1, 'c.d.e': 2}, fields: {u: 1, 'f.h.c': 2, 'f.g.h': 0}}, search: {$or: [{a: {$ne: 'b'}}, {c: {$in: ['d','e','f']}}, {b: {$not: /re/i}}]}});
		deepEqual(_.rql('sort(-val),(val>1000|val<1)').toMongo(), {meta: {sort: {val: -1}}, search: {$or: [{val: {$gt: 1000}}, {val: {$lt: 1}}]}});
	});

	test("binding parameters", function(){
    var parsed;
    parsed = _.rql('in(id,$1)', [['a','b','c']]);
    deq(parsed, {name: 'and', args: [{name: 'in', args: ['id', ['a', 'b', 'c']]}]});
    parsed = _.rql('eq(id,$1)', ['a']);
    deq(parsed, {name: 'and', args: [{name: 'eq', args: ['id', 'a']}]});
	});

	test("array of IDs", function(){
    var parsed = _.rql(['a', ['b','c'], 'd']);
    //console.log('PIDS', parsed);
    deq(parsed, {name: 'and', args: [{name: 'in', args: ['id', ['a', ['b','c'], 'd']]}]});
	});

	test("stringification", function(){
    var parsed;
    parsed = _.rql('eq(id1,RE:%5Eabc%5C%2F)');
    // Hmmm. deepEqual gives null for regexps?
    ok(parsed.args[0].args[1].toString() === /^abc\//.toString());
    //assert.deepEqual(parsed, {name: 'and', args: [{name: 'eq', args: ['id1', /^abc\//]}]});
    ok(_.rql().eq('_1',/GGG(EE|FF)/i)+'' === 'eq(_1,re:GGG%28EE%7CFF%29)');
    parsed = _.rql('eq(_1,re:GGG%28EE%7CFF%29)');
    equals(parsed.args[0].args[1].toString(), /GGG(EE|FF)/i.toString());
    //assert.ok(_.rql().eq('_1',/GGG(EE|FF)/)+'' === 'eq(_1,RE:GGG%28EE%7CFF%29)');
    // string to array and back
    var str = 'somefunc(and(1),(a,b),(10,(10,1)),(a,b.c))';
    equals(_.rql(str)+'', str);
    // quirky arguments
    var name = ['a/b','c.d'];
    equals(_.rql(_.rql().eq(name,1)+'')+'', 'eq((a%2Fb,c.d),1)');
    deepEqual(_.rql(_.rql().eq(name,1)+'').args[0].args[0], name);
    // utf-8
		deepEqual(_.rql('placeName=a=Hole%C5%A1ovice%20%28%C4%8D%C3%A1st%29').args[0].args[1], 'Holešovice (část)', 'utf-8 conversion');
	});

	module("Array");

	test("filtering #1", function(){
		equals(_.query(data, "price<10").length, 1);
		equals(_.query(data, "price<11").length, 2);
		equals(_.query(data, "nested/property=value").length, 1);
		equals(_.query(data, "with%2Fslash=slashed").length, 1);
		equals(_.query(data, "out(price,(5,10))").length, 0);
		equals(_.query(data, "out(price,(5))").length, 1);
		equals(_.query(data, "contains(tags,even)").length, 1);
		equals(_.query(data, "contains(tags,fun)").length, 2);
		equals(_.query(data, "excludes(tags,fun)").length, 0);

		//console.log(_.query(data, "excludes(tags,ne(fun))"), _.query(null, "excludes(tags,ne(fun))"));
		// FIXME: failing!
		//equals(_.query(data, "excludes(tags,ne(fun))").length, 1);
		//equals(_.query(data, "excludes(tags,ne(even))").length, 0);

		deepEqual(_.query(data, "match(price,10)"), [data[0]]);
		deepEqual(_.query(data, "price=re:10"), [data[0]]);
		deepEqual(_.query(data, "price!=re:10"), [data[1]]);
		deepEqual(_.query(data, "match(name,f.*)"), [data[1]]);
		deepEqual(_.query(data, "match(name,glob:f*)"), [data[1]]);
	});

	test("filtering #2", function(){
		var data = [{
			"path.1":[1,2,3]
		},{
			"path.1":[9,3,7]
		}];
		deepEqual(_.query(data, "contains(path,3)&sort()"), []); // path is undefined
		deepEqual(_.query(data, "contains(path.1,3)&sort(-path.1)"), [data[1], data[0]]); // 3 found in both
		deepEqual(_.query(data, "excludes(path.1,3)&sort()"), []); // 3 found in both
		deepEqual(_.query(data, "excludes(path.1,7)&sort()"), [data[0]]); // 7 found in second
	});

	test("filtering #3", function(){
		var data = [{
			a:2,b:2,c:1,foo:{bar:'baz1',baz:'raz'}
		},{
			a:1,b:4,c:1,foo:{bar:'baz2'}
		},{
			a:3,b:0,c:1,foo:{bar:'baz3'}
		}];
		deepEqual(_.query(data, ''), data, 'empty query');
		deepEqual(_.query(data, 'a=2,b<4'), [data[0]], 'vanilla');
		deepEqual(_.query(data, 'a=2,and(b<4)'), [data[0]], 'vanilla, extra and');
		deepEqual(_.query(data, "a=2,b<4,pick(-b,a)"), [{a:2}], 'pick -/+');
		deepEqual(_.query(data, 'or((pick(-b,a)&values(a/b/c)))'), [[],[],[]], 'pick -/+, values', 'fake or');
		deepEqual(_.query(data, 'a>1,b<4,pick(b,foo/bar,-foo/baz,+fo.ba),limit(1,1)'), [{b:0,foo:{bar: 'baz3'}}], 'pick deep properties, limit');
		deepEqual(_.query(data, 'or(eq(a,2),eq(b,4)),pick(b)'), [{b: 2}, {b: 4}], 'truly or');
		deepEqual(_.query(data, 'and(and(and(hasOwnProperty!=%22123)))'), data, 'attempt to access prototype -- noop');
		deepEqual(_.query(_.clone(data), 'sort(c,-foo/bar,foo/baz)'), [data[2], data[1], data[0]], 'sort');
		deepEqual(_.query(data, 'match(foo/bar,z3)'), [data[2]], 'match');
		deepEqual(_.query(data, 'foo/bar!=re:z3'), [data[0], data[1]], 'non-match');
		deepEqual(_.query(data, 'foo/baz=re:z'), [data[0]], 'implicit match');
		deepEqual(_.query(data, 'in(foo/bar,(baz1))'), [data[0]], 'occurance');
		deepEqual(_.query(data, 'in(foo/bar,baz2)'), [data[1]], 'occurance in non-array');
		deepEqual(_.query(data, 'nin(foo/bar,baz2)'), [data[0], data[2]], 'non-occurance in non-array');
		deepEqual(_.query(data, 'between(foo/bar,baz1,baz3)'), [data[0], data[1]], 'between strings');
		deepEqual(_.query(data, 'between(b,2,4)'), [data[0]], 'between numbers');
	});

});
