/*jslint node: true, nomen: true, white: true */
'use strict';

var common = require('./common')
  , util = require('utile')
  , entityNew = require('./entity_new')
  ;

var unseeable = common.unseeable
  , makeNano = common.makeNano
  , isoStringPropertiesToDates = common.isoStringPropertiesToDates
  , rehydrateForTypeNameAndSchema = entityNew.rehydrateForTypeNameAndSchema
  ;

function makeViewFunction(db, typeName, builder, viewName) {
  return function(fromId, toId, cb) {
    var opts = { include_docs: true };
    if (typeof fromId === 'function') {
      cb = fromId;
    } else if (typeof toId === 'function') {
      cb = toId;
      opts.key = fromId;
    } else {
      opts.startkey = fromId;
      opts.endkey = toId;
    }

    db.view(typeName, viewName, opts, function(err, result) {
      if (err) {
        return cb(err);
      }
      if (result.rows === undefined) {
        result.rows = [];
      }
      cb(err, result.rows.map(function(o) {
        var obj = o.doc;
        isoStringPropertiesToDates(obj);
        return builder(obj);
      }));
    });
  };
}

function makeComposedViewFunction(db, typeName, builder, viewName, propertyName, kidBuilders) {
  return function(id, cb) {
    var opts = {
          include_docs: true
        , startkey: [id, 0]
        , endkey: [id, 2]
        }
      ;
    if (typeof id === 'function') {
      cb = id;
      id = undefined;
      delete opts.startkey;
      delete opts.endkey;
    }
    db.view(typeName, viewName, opts, function(err, result) {
      var entities = []
        , entity
        , state
        , composed
        , i
        , j
        , key
        , kidBuilder
        ;

      if (err) {
        return cb(err);
      }
      if (result.rows !== undefined && result.rows.length > 0) {
        for (i = 0; i < result.rows.length; i += 1) {
          kidBuilder = null;
          state = result.rows[i].doc;
          key = result.rows[i].key;
          for (j = 0; j < kidBuilders.length; j += 1) {
            if (state.kind === kidBuilders[j].$kind) {
              kidBuilder = kidBuilders[j];
              break;
            }
          }
          if (key[1] === 0) {
            composed = [];
            isoStringPropertiesToDates(state);
            state[propertyName] = composed;
            entity = builder(state);
            entities.push(entity);
          } else {
            state = result.rows[i].doc;
            isoStringPropertiesToDates(state);
            composed.push(kidBuilder.new(state._id, state, true));
          }
        }
      }

      if(id) {
        cb(err, entities[0]);
      } else {
        cb(err, entities);
      }
    });
  };
}

function entityFrom(typeName, schema, dest) {
  var from = {}
    , fromProto = {}
    , builder = rehydrateForTypeNameAndSchema(typeName, schema)
    , db = makeNano(dest, 'Entity#from must be a couchdb url or nano db')
    , viewBuilder = makeViewFunction.bind({}, db, typeName, builder)
    , composedViewBuilder = makeComposedViewFunction.bind({}, db, typeName, builder)
    , getRefs = false
    ;

  unseeable(fromProto, 'db', db);

  fromProto.all = viewBuilder('all');

  fromProto.get = function(id, cb) {
    if (id.length === 0) {
      return cb(new Error('invalid id: ""'));
    }

    db.get(id, function(err, result) {
      var refIds = []
        , refIdToProp = {}
        , o
        ;

      if (err) {
        return cb(err);
      }

      isoStringPropertiesToDates(result);
      o = builder(result);
      if (getRefs && schema.refProperties.length > 0) {
        schema.refProperties.forEach(function(propName) {
          var refId = o['$' + propName + 'Id'];
          if (refId) {
            refIdToProp[refId] = propName;
            refIds.push(refId);
          }
        });

        db.fetch({ keys: refIds }, function(e, result) {
          if (e) {
            return cb(e);
          }
          result.rows.forEach(function(row) {
            var doc = row.doc
              , propName = refIdToProp[doc._id]
              , entity = schema.properties[propName].entity
              ;

            o[propName] = entity.new(doc);
          });
          cb(e, o);
        });
      } else {
        cb(err, o);
      }
    });
  };

  Object.keys(schema.views).forEach(function(viewName) {
    fromProto[viewName] = viewBuilder(viewName);
  });

  Object.keys(schema.composedViews).forEach(function(viewName) {
    var calculatedViewName = 'with' + util.capitalize(viewName)
      , kidBuilders = schema.composedViews[viewName]
      ;
    fromProto[calculatedViewName] = composedViewBuilder(calculatedViewName, viewName, kidBuilders);
  });

  from = Object.create(fromProto);

  from.withRefs = function() {
    getRefs = true;
    return fromProto;
  };

  return from;
}

module.exports.fromForTypeNameAndSchema = function(typeName, schema) {
  return function(dest) {
    return entityFrom(typeName, schema, dest);
  };
};
