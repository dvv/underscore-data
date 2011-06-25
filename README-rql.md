## Aim

To provide simple means to declaratively query recordsets represented by arrays/hashes of JS objects. Consider

    _.query([{a:1,b:2},{a:3,b:2}], '(a=1|b=2)') === [{a:1,b:2},{a:3,b:2}]
    _.query([{a:1,b:2},{a:3,b:2}], '(a=1&b=2)') === [{a:1,b:2}]
    _.query([{a:1,b:2},{a:3,b:2}], '(a=1&b!=2)') === []
    _.query([{a:1,b:2},{a:3,b:2}], 'a>=1') === [{a:1,b:2},{a:3,b:2}]

    _.query([{a:1,b:2},{a:3,b:2}], 'eq(b,2)&in(a,3,5,7)') === [{a:3,b:2}]
    _.query([{a:1,b:2},{a:3,b:2}], 'eq(b,2)&nin(a,3,5,7)') === [{a:1,b:2}]

    _.query([{a:1,b:2},{a:3,b:2}], 'a>=1&sort(-a)') === [{a:3,b:2},{a:1,b:2}]
    _.query([{a:1,b:2},{a:3,b:2}], 'a>=1&select(-a)') === [{b:2},{b:2}]
    _.query([{a:1,b:2},{a:3,b:2}], 'a>=1&select(-a)&limit(1,1)') === [{b:2}]
    _.query([{a:1,b:2},{a:3,b:2}], 'a>=1&limit(1)') === [{a:1,b:2}]

    _.query([{a:1,foo:{bar:'baz'}},{a:3,b:2}], 'foo/bar=re:ba') === [{a:1,foo:{bar:'baz'}}]

Behind the scene `_.query` is based upon [Resource Query Language](https://github.com/kriszyp/rql).

The heart of query language is `Query` class, which is instanciated with a call to `_.rql([querystring])`. `Query` can be iteratively tuned by calling its methods:

    _.rql('a=1').eq(b,2).sort('-n').limit(2,1)...

`Query` provides `.toMongo()` method which returns a hash `{search: {...}, meta: {...}}` suitable to be passed to MongoDB accessors, e.g.:

    _.rql('(a=1|b!=3).sort(-a).select(a).limit(10,5)').toMongo()

gives

    {search: {$or: [{a:1},{b:{$ne:3}}], meta: {sort:{a:-1}, fields:{a:1}, skip:5, limit:10}}}

## Install

    npm install underscore-data

## Test

    make

and point your browser to http://127.0.0.1:8080
