## Aim

Traditional get/set pattern of using key-value stores doesn't fit secured environment needs since almost always a particular record is not supposed to be exposed in its entirety. Consider a collection of User objects presenting users of a secured website. Ordinary users should have RW access to their profiles, but should have no access to fields defining their capabilities, the latter being objects managed by power administrator users. Also, validating a JS object presenting user input prior to letting it be persisted in the store.

Thus, simple _practical_ means to validate and filter objects passed to and from various datastores are needed.

One of the most powerful yet natural ways to represent validation rules is [JSON-Schema](http://json-schema.org/), the tersest yet close to full implementation [here](https://github.com/kriszyp/json-schema), the full list of implementations [here](http://json-schema.org/implementations.html).

Assumptions are:

* if one specifies schema in JS source file, he can explicitly specify relations as JS references, so no need in JSON gameplay to express inheritance;
* there are 3 types of operations on data store which require validation: 1) add a new record; 2) modify parts of records -- modifying record as whole is simply an extreme case; 3) fetch records back
* having one slightly more elaborate schema is better than having three schemas

To illustrate, consider a simple schema representing a User record:

    User =
      type: 'object'
      properties:
        id:
          type: 'string'
          pattern: /^[A-Za-z0-9_]$/
        # --- authority ---
        rights:
          type: 'any'
        # --- authentication ---
        salt:
          type: 'string'
        password:
          type: 'string'
        # --- profile ---
        email:
          type: 'string'
        creditcardinfo:
          type: 'string'
        anotherprivateinfo:
          type: 'any'


Let us see how one can improve this schema using `veto` attribute to achieve the separation of access:

    UserAsSeenByAdmin =
      type: 'object'
      additionalProperties: false
      properties:
        # N.B. no way to change id when updating the record
        id: _.extend {}, User.properties.id, veto: {update: true}
        # N.B. authority is of full RW access
        rights: User.properties.rights
        # N.B. admin can specify initial secrets
        salt: _.extend {}, User.properties.salt, veto: {update: true, get: true}
        password: _.extend {}, User.properties.password, veto: {update: true, get: true}
        # N.B. admin can view user email, and cannot neither set initial value, nor update it
        email: _.extend {}, User.properties.email, veto: {add: true, update: true}
        # N.B. admin has no access to the rest of the record
        # ...

    UserAsSeenByUser =
      type: 'object'
      additionalProperties: false
      properties:
        # N.B. RO id
        id: _.extend {}, User.properties.id, veto: {add: true, update: true}
        # N.B. RO authority
        rights: _.extend {}, User.properties.rights, veto: {add: true, update: true}
        # N.B. update-only secrets -- no need to leak this even for user himself
        salt: _.extend {}, User.properties.salt, veto: {add: true, get: true}
        password: _.extend {}, User.properties.password, veto: {add: true, get: true}
        # N.B. RW email
        email: User.properties.email
        # N.B. RW access to the rest of the record
        creditcardinfo: User.properties.creditcardinfo
        # ...

The `veto` attribute is a hash of three boolean keys: `add`, `update`, 'get` representing the type of operation for which validation is performed. The usage pattern is as follows:

* to validate INPUT when adding new User record:

    `_.validate INPUT, UserAsSeenByAdmin, flavor: 'add'`

This will validate INPUT using UserAsSeenByAdmin schema, removing any properties attributed as `veto: {add: true}`, setting default values on missed properties before validation

* to validate INPUT when updating one/many User records:

    `_.validate INPUT, UserAsSeenByAdmin, flavor: 'update'`

This will validate INPUT using UserAsSeenByAdmin schema, taking in account only those properties which do exist in INPUT, removing any properties attributed as `veto: {update: true}`, ignoring `default` attribute

* to validate User records returned from the store:

    `_.map records, (record) -> _.validate record, UserAsSeenByAdmin, flavor: 'get'`

This will kick off from each of records any properties in UserAsSeenByAdmin schema attributed as `veto: {get: true}`

The concept of accessing a particular record under different POVs is close to that introduced by `Facet`s in [Perstore](https://github.com/kriszyp/perstore) which are means to separate access at record level based on object capability.

## Coercion

Validation procedure will try to coerce the type of a property to that defined in the schema if `_.validate` is given `coerce: true` option. Coercion is not done for `flavor: 'get'`

## Install

Run:

    make

## Example and test

    make

and point your browser to http://127.0.0.1:8080
