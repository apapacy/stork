var util = require('utile')
  ;

var definers = {}
  , validStringFormats = {
      'url': true
    , 'email': true
    , 'ip-address': true
    , 'ipv6': true
    , 'date-time': true
    , 'date': true
    , 'time': true
    , 'color': true
    , 'host-name': true
    , 'utc-millisec': true
		}
  ;

definers.bool = function(name, options) {
	if(typeof name === 'undefined') {
		throw new Error('bool definer requires a name');
	}
	this.properties[name] = {type: 'boolean'};
	if(options) {
		if(typeof options.required !== 'undefined') {
			this.properties[name].required = options.required;
		}
		if(typeof options.nullable !== 'undefined') {
			if(options.nullable) {
				this.properties[name].type = ['boolean', 'null'];
			}
		}
	}
};

definers.id = function(options) {
	var isProperObject = typeof options !== 'object'
	                  || options instanceof Array
	                  || options instanceof Date
	                  || options == null
	  ;
	if(isProperObject) {
		throw new Error('id requires a configuration spec');
	}
	options = util.clone(options);
	options.nullable = true;
	delete options.required;
	
	this.string('_id', options);
};


definers.string = function(name, options) {
	if(typeof name === 'undefined') {
		throw new Error('string definer requires a name');
	}
	this.properties[name] = {type: 'string'};
	if(options) {
		if(typeof options.required !== 'undefined') {
			if(options.required === true || options.required === false) {
				this.properties[name].required = options.required;
			}
		}
		if(typeof options.nullable !== 'undefined') {
			if(options.nullable === true) {
				this.properties[name].type = ['string', 'null'];
			}
		}
		if(typeof options.minLength === 'number') {
			this.properties[name].minLength = options.minLength;
		}
		if(typeof options.maxLength === 'number') {
			this.properties[name].maxLength = options.maxLength;
		}
		if(typeof options.format === 'string') {
			if(validStringFormats[options.format]) {
				this.properties[name].format = options.format;
			}
		} else if(options.format instanceof RegExp) {
			this.properties[name].pattern = options.format;
		}
	}
};

module.exports = definers;