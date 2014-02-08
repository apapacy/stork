var nano = require('nano')
  , os = require('os')
  , async = require('async')
  , util = require('utile')
  , odm = require('../lib/stork')
  ;

// Put your own CouchDb endpoint in the dbOverrides to customize where your
// integration test runs.
var dbOverrides = {
      druthers: 'http://couchdb:5984/stork_test'
    }
  , dburl = dbOverrides[os.hostname()] || 'http://localhost:5984/stork_test'
  , db = nano(dburl)
  , dbms = nano(db.config.url)
  , db = dbms.use(db.config.db)
  , integration = function(o) {
      var run = !process.env['SKIP_STORK_DB_TESTS']
        ;

      if(run) {
        return o;
      }
      return {};
    }
  ;

module.exports = integration({
  setUp: function(cb) {
    dbms.db.destroy(db.config.db, function(err) {
      dbms.db.create(db.config.db, function(err) {
        cb(err);
      });
    });
  }

, 'create default entity design document': function(t) {
    var entityName = 'defaulty'
      , entity = odm.deliver(entityName)
      ;

    entity.to(dburl).sync(function(e) {
      if(e) {
        return t.done(e);
      }
      db.get('_design/' + entityName, function(e, doc) {
        if(e) {
          return t.done(e);
        }
        doc.should.be.ok;
        doc.should.have.property('views');
        doc.views.should.have.property('all');
        doc.views.all.should.have.property('map');
        doc.views.all.map.indexOf('emit(doc._id').should.be.greaterThan(-1);
        t.done();
      });
    });
  }

, 'create entity design document with sort': function(t) {
    var entityName = 'sorty'
      , entity = odm.deliver(entityName, function() {
          this.sort('o/n\\e', 'two');
        })
      ;

    entity.to(dburl).sync(function(e) {
      if(e) {
        return t.done(e);
      }
      db.get('_design/' + entityName, function(e, doc) {
        if(e) {
          return t.done(e);
        }
        doc.should.be.ok;
        doc.should.have.property('views');
        doc.views.should.have.property('all');
        doc.views.all.should.have.property('map');
        doc.views.all.map.indexOf("emit([doc['o/n\\\\e'],doc['two']]").should.be.greaterThan(-1);
        t.done();
      });
    });
  }

, 'save new object': function(t) {
    var entityName = 'sorty'
      , entity = odm.deliver(entityName, function() {
          this.string('s', {required: true});
          this.datetime('dt', {required: true});
        })
      , instance = entity.new({
          s: 'text'
        , dt: new Date(2012, 6, 14)
        , extra: 1
        })
      ;

    instance.to(dburl).save(function(e, result) {
      if(e) {
        return t.done(e);
      }
      result.should.have.property('_id');
      result.should.have.property('_rev');
      db.get(result._id, function(e, doc) {
        if(e) {
          return t.done(e);
        }
        doc.dt = new Date(doc.dt);
        doc.should.be.ok;
        doc.should.have.property('_id', result._id);
        doc.should.have.property('s', result.s);
        doc.should.have.property('dt', result.dt);
        doc.should.have.property('extra', result.extra);
        doc.should.have.property('_rev', result._rev);
        t.done();
      });
    });
  }

, 'save new object with explicit id': function(t) {
    var entityName = 'sorty'
      , entity = odm.deliver(entityName, function() {
          this.string('s', {required: true});
          this.datetime('dt', {required: true});
        })
      , instance = entity.new({
          s: 'text'
        , dt: new Date(2012, 6, 14)
        , extra: 1
        , _id: 'hello mary!'
        })
      ;

    instance.to(dburl).save(function(e, result) {
      if(e) {
        return t.done(e);
      }
      result.should.have.property('_id', instance._id);
      result.should.have.property('_rev');
      db.get(result._id, function(e, doc) {
        if(e) {
          return t.done(e);
        }
        doc.dt = new Date(doc.dt);
        doc.should.be.ok;
        doc.should.have.property('_id', result._id);
        doc.should.have.property('s', result.s);
        doc.should.have.property('dt', result.dt);
        doc.should.have.property('extra', result.extra);
        doc.should.have.property('_rev', result._rev);
        t.done();
      });
    });
  }

, 'save previously saved object': function(t) {
    var entityName = 'sorty'
      , entity = odm.deliver(entityName, function() {
          this.string('s', {required: true});
          this.datetime('dt', {required: true});
        })
      , instance = entity.new({
          s: 'text'
        , dt: new Date(2012, 6, 14)
        , extra: 1
        })
      ;

    instance.to(dburl).save(function(e, result) {
      if(e) {
        return t.done(e);
      }
      instance.to(dburl).save(function(e, result) {
        if(e) {
          return t.done(e);
        }
        db.get(result._id, function(e, doc) {
          if(e) {
            return t.done(e);
          }
          doc.dt = new Date(doc.dt);
          doc.should.be.ok;
          doc.should.have.property('_id', result._id);
          doc.should.have.property('s', result.s);
          doc.should.have.property('dt', result.dt);
          doc.should.have.property('extra', result.extra);
          doc.should.have.property('_rev', result._rev);
          t.done();
        });
      });
    });
  }

, 'query entity#all': function(t) {
    var entityName = 'sorty'
      , Entity = odm.deliver(entityName, function() {
          this.string('s', {required: true});
          this.datetime('dt', {required: true});
        })
      , instances = [
          Entity.new({s: 'text', dt: new Date(2012, 6, 14), extra: 1})
        , Entity.new({s: 'txet', dt: new Date(2013, 9, 21), extra: -1})
        ]
      ;

    async.series([
      function(cb) { Entity.to(dburl).sync(cb); }
    , function(cb) { instances[0].to(dburl).save(cb); }
    , function(cb) { instances[1].to(dburl).save(cb); }
    , function(cb) { Entity.from(dburl).all(cb); }
    ], function(err, results) {
      var objs = results[results.length - 1]
        ;
      objs.should.be.an.Array;
      objs.should.have.length(2);
      objs.forEach(function(obj, i) {
        Object.keys(obj).forEach(function(key) {
          if(typeof obj[key] === 'function') {
            return;
          }
          obj[key].should.be.eql(instances[i][key]);
        });
      });
      t.done();
    });
  }

, 'get a previously saved object': function(t) {
    var entityName = 'sorty'
      , Entity = odm.deliver(entityName, function() {
          this.string('s', {required: true});
          this.datetime('dt', {required: true});
        })
      , nakeds = [
          {s: 'text', dt: new Date(2012, 6, 14), extra: 1}
        , {s: 'txet', dt: new Date(2013, 9, 21), extra: -1}
        ]
      , instances = [
          Entity.new(nakeds[0])
        , Entity.new(nakeds[1])
        ]
      , from = Entity.from(dburl)
      ;

    async.series([
      function(cb) { Entity.to(dburl).sync(cb); }
    , function(cb) { instances[0].to(dburl).save(cb); }
    , function(cb) { instances[1].to(dburl).save(cb); }
    ], function(err, results) {
      async.series([
        from.get.bind(from, results[1]._id)
      , from.get.bind(from, results[2]._id)
      ], function(err, results) {
        results[0].should.have.properties(nakeds[0]);
        results[0].should.have.property('$schema', instances[0].$schema);
        results[1].should.have.properties(nakeds[1]);
        results[1].should.have.property('$schema', instances[1].$schema);
        t.done();
      });
    });
  }

, 'create entity design document with complex-key query': function(t) {
    var entityName = util.randomString(10)
      , field1 = util.randomString(10)
      , field2 = util.randomString(10)
      , viewName = util.randomString(10)
      , entity = odm.deliver(entityName, function() {
          this.string(field1);
          this.string(field2);
          this.view(viewName, [field1, field2]);
        })
      ;

    entity.to(dburl).sync(function(e) {
      if(e) {
        return t.done(e);
      }
      db.get('_design/' + entityName, function(e, doc) {
        var customView
          ;
        if(e) {
          return t.done(e);
        }
        doc.should.be.ok;
        doc.should.have.property('views');
        doc.views.should.have.property('all');
        doc.views.all.should.have.property('map');
        doc.views.all.map.indexOf('emit(doc._id').should.be.greaterThan(-1);

        doc.views.should.have.property(viewName);
        doc.views[viewName].should.have.property('map');
        customView = doc.views[viewName].map;
        customView.indexOf('\'' + field1 + '\'').should.be.greaterThan(-1);
        customView.indexOf('\'' + field2 + '\'').should.be.greaterThan(-1);
        customView.indexOf('doc.kind === \'' + entityName + '\'').should.be.greaterThan(-1);
        t.done();
      });
    });
  }

, 'create entity design document with complex-key key mutator query': function(t) {
    var entityName = util.randomString(10)
      , field1 = util.randomString(10)
      , field2 = util.randomString(10)
      , value1 = util.randomString(20).toLowerCase()
      , value2 = util.randomString(20).toLowerCase()
      , viewName = util.randomString(10)
      , field1Function = new Function("return doc['" + field1 + "'].toUpperCase();")
      , field2Function = new Function("return doc['" + field2 + "'].toUpperCase();")
      , firstKey = {}
      , _ = firstKey[field2] = field1Function
      , secondKey = {}
      , _ = secondKey[field2] = field2Function
      , Entity = odm.deliver(entityName, function() {
          this.string(field1);
          this.string(field2);
          this.view(viewName, [firstKey, secondKey]);
        })
      , instances = [
          Entity.new()
        , Entity.new()
        ]
      , firstIndex = value1 < value2? 0 : 1
      , secondIndex = 1 - firstIndex
      ;

    instances[0][field1] = value1;
    instances[0][field2] = value2;

    instances[1][field1] = value2;
    instances[1][field2] = value1;

    async.series([
      function(cb) { Entity.to(dburl).sync(cb); }
    , function(cb) { instances[0].to(dburl).save(cb); }
    , function(cb) { instances[1].to(dburl).save(cb); }
    ], function(err, results) {
      if(err) {
        return t.done(err);
      }
      db.view(entityName, viewName, function(err, result) {
        if(err) {
          return t.done(err);
        }
        result.total_rows.should.equal(2);
        result.rows.should.have.length(2);
        result.rows[firstIndex].key.should.eql([value1.toUpperCase(), value2.toUpperCase()]);
        result.rows[secondIndex].key.should.eql([value2.toUpperCase(), value1.toUpperCase()]);
        t.done();
      });
    });
  }
});
