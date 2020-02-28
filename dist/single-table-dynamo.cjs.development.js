'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var AWS = _interopDefault(require('aws-sdk'));

function _extends() {
  _extends = Object.assign || function (target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];

      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }

    return target;
  };

  return _extends.apply(this, arguments);
}

// A type of promise-like that resolves synchronously and supports only one observer
const _Pact = /*#__PURE__*/(function() {
	function _Pact() {}
	_Pact.prototype.then = function(onFulfilled, onRejected) {
		const result = new _Pact();
		const state = this.s;
		if (state) {
			const callback = state & 1 ? onFulfilled : onRejected;
			if (callback) {
				try {
					_settle(result, 1, callback(this.v));
				} catch (e) {
					_settle(result, 2, e);
				}
				return result;
			} else {
				return this;
			}
		}
		this.o = function(_this) {
			try {
				const value = _this.v;
				if (_this.s & 1) {
					_settle(result, 1, onFulfilled ? onFulfilled(value) : value);
				} else if (onRejected) {
					_settle(result, 1, onRejected(value));
				} else {
					_settle(result, 2, value);
				}
			} catch (e) {
				_settle(result, 2, e);
			}
		};
		return result;
	};
	return _Pact;
})();

// Settles a pact synchronously
function _settle(pact, state, value) {
	if (!pact.s) {
		if (value instanceof _Pact) {
			if (value.s) {
				if (state & 1) {
					state = value.s;
				}
				value = value.v;
			} else {
				value.o = _settle.bind(null, pact, state);
				return;
			}
		}
		if (value && value.then) {
			value.then(_settle.bind(null, pact, state), _settle.bind(null, pact, 2));
			return;
		}
		pact.s = state;
		pact.v = value;
		const observer = pact.o;
		if (observer) {
			observer(pact);
		}
	}
}

function _isSettledPact(thenable) {
	return thenable instanceof _Pact && thenable.s & 1;
}

// Asynchronously iterate through an object that has a length property, passing the index as the first argument to the callback (even as the length property changes)
function _forTo(array, body, check) {
	var i = -1, pact, reject;
	function _cycle(result) {
		try {
			while (++i < array.length && (!check || !check())) {
				result = body(i);
				if (result && result.then) {
					if (_isSettledPact(result)) {
						result = result.v;
					} else {
						result.then(_cycle, reject || (reject = _settle.bind(null, pact = new _Pact(), 2)));
						return;
					}
				}
			}
			if (pact) {
				_settle(pact, 1, result);
			} else {
				pact = result;
			}
		} catch (e) {
			_settle(pact || (pact = new _Pact()), 2, e);
		}
	}
	_cycle();
	return pact;
}

const _iteratorSymbol = /*#__PURE__*/ typeof Symbol !== "undefined" ? (Symbol.iterator || (Symbol.iterator = Symbol("Symbol.iterator"))) : "@@iterator";

const _asyncIteratorSymbol = /*#__PURE__*/ typeof Symbol !== "undefined" ? (Symbol.asyncIterator || (Symbol.asyncIterator = Symbol("Symbol.asyncIterator"))) : "@@asyncIterator";

// Asynchronously implement a generic for loop
function _for(test, update, body) {
	var stage;
	for (;;) {
		var shouldContinue = test();
		if (_isSettledPact(shouldContinue)) {
			shouldContinue = shouldContinue.v;
		}
		if (!shouldContinue) {
			return result;
		}
		if (shouldContinue.then) {
			stage = 0;
			break;
		}
		var result = body();
		if (result && result.then) {
			if (_isSettledPact(result)) {
				result = result.s;
			} else {
				stage = 1;
				break;
			}
		}
		if (update) {
			var updateValue = update();
			if (updateValue && updateValue.then && !_isSettledPact(updateValue)) {
				stage = 2;
				break;
			}
		}
	}
	var pact = new _Pact();
	var reject = _settle.bind(null, pact, 2);
	(stage === 0 ? shouldContinue.then(_resumeAfterTest) : stage === 1 ? result.then(_resumeAfterBody) : updateValue.then(_resumeAfterUpdate)).then(void 0, reject);
	return pact;
	function _resumeAfterBody(value) {
		result = value;
		do {
			if (update) {
				updateValue = update();
				if (updateValue && updateValue.then && !_isSettledPact(updateValue)) {
					updateValue.then(_resumeAfterUpdate).then(void 0, reject);
					return;
				}
			}
			shouldContinue = test();
			if (!shouldContinue || (_isSettledPact(shouldContinue) && !shouldContinue.v)) {
				_settle(pact, 1, result);
				return;
			}
			if (shouldContinue.then) {
				shouldContinue.then(_resumeAfterTest).then(void 0, reject);
				return;
			}
			result = body();
			if (_isSettledPact(result)) {
				result = result.v;
			}
		} while (!result || !result.then);
		result.then(_resumeAfterBody).then(void 0, reject);
	}
	function _resumeAfterTest(shouldContinue) {
		if (shouldContinue) {
			result = body();
			if (result && result.then) {
				result.then(_resumeAfterBody).then(void 0, reject);
			} else {
				_resumeAfterBody(result);
			}
		} else {
			_settle(pact, 1, result);
		}
	}
	function _resumeAfterUpdate() {
		if (shouldContinue = test()) {
			if (shouldContinue.then) {
				shouldContinue.then(_resumeAfterTest).then(void 0, reject);
			} else {
				_resumeAfterTest(shouldContinue);
			}
		} else {
			_settle(pact, 1, result);
		}
	}
}

// Asynchronously call a function and send errors to recovery continuation
function _catch(body, recover) {
	try {
		var result = body();
	} catch(e) {
		return recover(e);
	}
	if (result && result.then) {
		return result.then(void 0, recover);
	}
	return result;
}

var _docClient =
/*#__PURE__*/
new AWS.DynamoDB.DocumentClient();

function getDocClient() {
  return _docClient;
}
function WORKAROUND_updateAWSConfig(ops, docClientOptions) {
  AWS.config.update(ops);
  _docClient = new AWS.DynamoDB.DocumentClient(_extends({}, ops, {}, docClientOptions));
}

function getDataFromDocument(doc) {
  if (!doc) {
    return null;
  }

  var res = {};
  Object.keys(doc).forEach(function (key) {
    if (!key.startsWith('__')) {
      res[key] = doc[key];
    }
  });
  return res;
}

/**
 *
 * Each Local Secondary Index is named lsi1, lsi2, ... or lsi3
 * This function should be used when executing a query with a LSI
 *
 * @param i
 */
function getLSIName(which) {
  return "__lsi" + which;
}
function getLSISortKeyAttribute(which) {
  return "__lsi" + which;
}
function getGSIName(which) {
  return "__gsi" + which;
}
function getGSIAttributeName(which, type) {
  return "__gsi" + type + which;
}

var defaultTableName = 'SingleTable';
function getDefaultTableName() {
  return defaultTableName;
}
function setDefaultTableName(newName) {
  defaultTableName = newName;
}

function range(start, end) {
  var nums = [];

  for (var i = start; i <= end; i++) {
    nums.push(i);
  }

  return nums;
}

function getGSIDef(index) {
  if (index.type === 'globalSecondaryIndex') {
    return {
      IndexName: index.indexName,
      KeySchema: [{
        AttributeName: index.hashKeyAttribute,
        KeyType: 'HASH'
      }, {
        AttributeName: index.sortKeyAttribute,
        KeyType: 'RANGE'
      }],
      Projection: {
        ProjectionType: 'ALL'
      }
    };
  }

  throw {
    message: "given index of type " + index.type + ", expecting globalSecondaryIndex"
  };
}
function getCreateTableInput(args) {
  var localSecondaryIndexes = range(0, 4).map(function (i) {
    return {
      indexName: getLSIName(i),
      sortKeyAttributeName: getLSISortKeyAttribute(i)
    };
  });
  var globalSecondaryIndexes = (args.indexes || []).map(function (i) {
    return getGSIDef(i);
  });
  var createTableInput = {
    TableName: args.tableName || getDefaultTableName(),
    KeySchema: [{
      AttributeName: '__hashKey',
      KeyType: 'HASH'
    }, {
      AttributeName: '__sortKey',
      KeyType: 'RANGE'
    }],
    AttributeDefinitions: [{
      AttributeName: '__hashKey',
      AttributeType: 'S'
    }, {
      AttributeName: '__sortKey',
      AttributeType: 'S'
    }].concat(localSecondaryIndexes.map(function (i) {
      return {
        AttributeName: i.sortKeyAttributeName,
        AttributeType: 'S'
      };
    }), args.indexes.map(function (i) {
      return {
        AttributeName: i.sortKeyAttribute,
        AttributeType: 'S'
      };
    }), args.indexes.map(function (i) {
      return {
        AttributeName: i.hashKeyAttribute,
        AttributeType: 'S'
      };
    })),
    LocalSecondaryIndexes: [].concat(localSecondaryIndexes.map(function (i) {
      return {
        IndexName: i.indexName,
        KeySchema: [{
          AttributeName: '__hashKey',
          KeyType: 'HASH'
        }, {
          AttributeName: i.sortKeyAttributeName,
          KeyType: 'RANGE'
        }],
        Projection: {
          ProjectionType: 'ALL'
        }
      };
    })),
    GlobalSecondaryIndexes: globalSecondaryIndexes,
    BillingMode: 'PAY_PER_REQUEST'
  };

  if (createTableInput.LocalSecondaryIndexes.length === 0) {
    delete createTableInput.LocalSecondaryIndexes;
  }

  if (createTableInput.GlobalSecondaryIndexes.length === 0) {
    delete createTableInput.GlobalSecondaryIndexes;
  }

  return createTableInput;
} // type GSI = {
//     indexName: string
//     sortKeyAttributeName: string
//     hashKeyAttributeName: string
// }

/**
 *
 * Creates a table with 5 local secondary indexes
 *
 */

function createTable(args) {
  var createTableInput = getCreateTableInput(args);
  var client = new AWS.DynamoDB();
  return client.createTable(createTableInput).promise().then(function () {
    return client.waitFor('tableExists', {
      TableName: createTableInput.TableName
    });
  }).then(function () {
    return console.log(createTableInput.TableName + " has been created");
  });
}

function getPrimaryIndex(config, tag) {
  if (tag === void 0) {
    tag = '';
  }

  return {
    isCustomIndex: false,
    hashKeyFields: config.hashKeyFields,
    hashKeyDescriptor: config.objectName,
    hashKeyAttribute: '__hashKey',
    sortKeyFields: config.sortKeyFields || [],
    sortKeyDescriptor: config.objectName,
    sortKeyAttribute: '__sortKey',
    type: 'primaryIndex',
    tag: tag
  };
}

function isPrimaryQueryArg(thing) {
  return thing && thing.isPrimary;
}

function isLSIQueryArg(thing) {
  return thing && thing.sortKeyFields && !thing.hashKeyFields;
}

function isGSIQueryArg(thing) {
  return thing && thing.sortKeyFields && thing.hashKeyFields;
}

function isCustomGSIQueryArg(thing) {
  return thing && thing.hashKeyAttributeName && thing.sortKeyAttributeName;
}

function convertQueryArgToIndex(queryName, config) {
  var index = (config.indexes || {})[queryName];

  if (isPrimaryQueryArg(index)) {
    return getPrimaryIndex(config, queryName);
  } else if (isLSIQueryArg(index)) {
    return getLSIIndex(queryName, index, config);
  } else if (isGSIQueryArg(index)) {
    return getGSIIndex(queryName, index, config);
  } else if (isCustomGSIQueryArg(index)) {
    return getCustomGSIIndex(queryName, index, config);
  } else {
    throw {
      message: queryName + " is not valid"
    };
  }
}
function getLSIIndex(queryName, i, config) {
  return {
    isCustomIndex: false,
    hashKeyFields: config.hashKeyFields,
    hashKeyDescriptor: config.objectName,
    hashKeyAttribute: '__hashKey',
    sortKeyFields: i.sortKeyFields,
    sortKeyDescriptor: queryName,
    sortKeyAttribute: getLSISortKeyAttribute(i.which),
    indexName: getLSIName(i.which),
    type: 'localSecondaryIndex',
    tag: queryName
  };
}
function getCustomGSIIndex(queryName, i, config) {
  return {
    isCustomIndex: true,
    hashKeyFields: [],
    hashKeyDescriptor: config.objectName + '-' + queryName,
    hashKeyAttribute: i.hashKeyAttributeName,
    sortKeyFields: [],
    sortKeyDescriptor: queryName,
    sortKeyAttribute: i.sortKeyAttributeName,
    indexName: i.indexName || queryName,
    type: 'globalSecondaryIndex',
    tag: queryName
  };
}
function getGSIIndex(queryName, i, config) {
  return {
    isCustomIndex: false,
    hashKeyFields: i.hashKeyFields,
    hashKeyDescriptor: config.objectName + '-' + queryName,
    hashKeyAttribute: getGSIAttributeName(i.which, 'Hash'),
    sortKeyFields: i.sortKeyFields,
    sortKeyDescriptor: queryName,
    sortKeyAttribute: getGSIAttributeName(i.which, 'Sort'),
    indexName: getGSIName(i.which),
    type: 'globalSecondaryIndex',
    tag: queryName
  };
}
function getConfig(argsIn) {
  var args = Object.assign({
    shouldPadNumbersInIndexes: true,
    paddedNumberLength: 20,
    queries: {}
  }, argsIn);
  var indexes = [getPrimaryIndex(args)].concat(args.indexes ? Object.keys(args.indexes).map(function (queryName) {
    return convertQueryArgToIndex(queryName, args);
  }) : []);
  var indexesByTag = indexes.reduce(function (prev, index) {
    var _extends2;

    return _extends({}, prev, (_extends2 = {}, _extends2[index.tag] = index, _extends2));
  }, {});
  return Object.assign({
    tableName: args.tableName || getDefaultTableName(),
    compositeKeySeparator: args.compositeKeySeparator || '#',
    shouldPadNumbersInIndexes: args.shouldPadNumbersInIndexes,
    paddedNumberLength: args.paddedNumberLength || 20
  }, {
    objectName: args.objectName,
    primaryIndex: indexes[0],
    indexes: indexes,
    indexesByTag: indexesByTag
  });
}

var QueryBuilder =
/*#__PURE__*/
function () {
  function QueryBuilder(repo) {
    this.clause = {
      args: {}
    };
    this.repo = repo;
  }

  var _proto = QueryBuilder.prototype;

  _proto.where = function where(parts) {
    this.clause.args = parts;
    return this;
  };

  _proto.sortBy = function sortBy(key) {
    this.clause.sortBy = key;
    return this;
  };

  _proto.sortDirection = function sortDirection(direction) {
    this.clause.sort = direction;
    return this;
  };

  _proto.index = function index(_index) {
    this.clause.index = _index;
    return this;
  };

  _proto.cursor = function cursor(_cursor) {
    this.clause.cursor = _cursor;
    return this;
  };

  _proto.limit = function limit(_limit) {
    this.clause.limit = _limit;
    return this;
  };

  _proto.setClause = function setClause(clause) {
    this.clause = clause;
    return this;
  };

  _proto.get = function get() {
    var index = this.repo.findIndexForQuery(this.clause);

    if (!index) {
      throw {
        message: 'there isnt an index configured for this query'
      };
    }

    return this.repo.executeQuery(this.clause, index);
  };

  _proto.getOne = function getOne() {
    try {
      var _this2 = this;

      return Promise.resolve(_this2.limit(1).get()).then(function (res) {
        if (res.results.length > 0) {
          return res.results[0];
        } else {
          return null;
        }
      });
    } catch (e) {
      return Promise.reject(e);
    }
  }
  /**
   * Repeatedly pages over the given query until all items have been queried
   * If a query has more pages than fit in memory, errors will happen
   */
  ;

  _proto.getAll = function getAll() {
    try {
      var _this4 = this;

      return Promise.resolve(_this4.get()).then(function (res) {
        var _temp = _for(function () {
          return !!res.nextPageArgs;
        }, void 0, function () {
          return Promise.resolve(_this4.setClause(res.nextPageArgs).get()).then(function (next) {
            res = {
              results: res.results.concat(next.results),
              nextPageArgs: next.nextPageArgs
            };
          });
        });

        return _temp && _temp.then ? _temp.then(function () {
          return res;
        }) : res;
      });
    } catch (e) {
      return Promise.reject(e);
    }
  };

  _proto.deleteAll = function deleteAll() {
    try {
      var _this6 = this;

      var hasMore = true; //the max items for batch delete is 25
      //todo: limit paging to 25 in batchDelete

      return Promise.resolve(_this6.limit(25).get()).then(function (res) {
        var _temp3 = _for(function () {
          return !!hasMore;
        }, void 0, function () {
          return Promise.resolve(_this6.repo.batchDelete(res.results)).then(function () {
            var _temp2 = function () {
              if (res.nextPageArgs) {
                return Promise.resolve(_this6.setClause(res.nextPageArgs).get()).then(function (_this5$setClause$get) {
                  res = _this5$setClause$get;
                });
              } else {
                hasMore = false;
              }
            }();

            if (_temp2 && _temp2.then) return _temp2.then(function () {});
          });
        });

        return _temp3 && _temp3.then ? _temp3.then(function () {
          return true;
        }) : true;
      });
    } catch (e) {
      return Promise.reject(e);
    }
  };

  return QueryBuilder;
}();
/**
 *
 * @param thing
 * @param properties
 * @param descriptor
 * @param separator
 *
 * return "{descriptor}#{properties[0]}-{thing[properties[0]]}#..."
 */


function getCompositeKeyValue(thing, properties, descriptor, separator, shouldPadNumbersInIndexes) {
  return [descriptor].concat(properties.map(function (k) {
    return dynamoProperty(k, thing[k], shouldPadNumbersInIndexes);
  })).join(separator);
}

function padDecimalNumber(value) {
  var _String$split = String(value).split('.'),
      before = _String$split[0],
      after = _String$split[1];

  return [(before || '').padStart(18, '0'), (after || '').padEnd(2, '0')].join('.');
}
/**
 *
 * To make generic dynamo fields more readable, they are saved in the following format
 * <fieldName>-<fieldValue>, eg userId-2039848932
 *
 * This function should be used whenever saving attributes to a composite index
 *
 * @param key
 * @param value
 */


function dynamoProperty(key, value, shouldPadNumbersInIndexes) {
  var stringified = String(value);

  if (typeof value === 'number' && value >= 0 && shouldPadNumbersInIndexes) {
    stringified = padDecimalNumber(value);
  }

  return key + "-" + stringified;
}
function getSortkeyForBeginsWithQuery(thing, indexFields, descriptor, compositeKeySeparator, shouldPadNumbersInIndexes) {
  var fields = [descriptor];

  for (var i = 0; i < indexFields.length; i++) {
    var k = indexFields[i];

    if (k in thing) {
      fields.push(dynamoProperty(k, String(thing[k]), shouldPadNumbersInIndexes));
    } else {
      break;
    }
  }

  return fields.join(compositeKeySeparator);
}

function _findIndexForQuery(where, config) {
  if (where.index) {
    if (config.indexesByTag[where.index]) {
      return config.indexesByTag[where.index];
    } else {
      throw {
        message: "The index \"" + where.index + "\" does not exist, the following are valid indexes: " + Object.keys(config.indexesByTag).join(',')
      };
    }
  }

  var indexes = config.indexes;

  var _loop = function _loop(i) {
    var index = indexes[i];
    var neededFields = new Set(Object.keys(where.args)); //for this index to be eligible, we need every hashKey field to be provided in the query

    var queryContainsAllHashKeyFields = index.hashKeyFields.every(function (k) {
      return neededFields.has(k);
    }); //query contains all hash key fields

    if (queryContainsAllHashKeyFields) {
      index.hashKeyFields.forEach(function (k) {
        return neededFields["delete"](k);
      });
      var sortKeyFieldIndex = neededFields.size; //ensure that the first n fields of this index are included in the where clause

      index.sortKeyFields.slice(0, neededFields.size).forEach(function (k) {
        return neededFields["delete"](k);
      }); //all the specified fields are in the correct place for this index

      if (neededFields.size === 0) {
        //check if this config has a sort and if it's in the right place
        if (where.sortBy) {
          if (index.sortKeyFields.indexOf(where.sortBy) === sortKeyFieldIndex) {
            return {
              v: index
            };
          }
        } else {
          return {
            v: index
          };
        }
      }
    }
  };

  for (var i = 0; i < indexes.length; i++) {
    var _ret = _loop(i);

    if (typeof _ret === "object") return _ret.v;
  }

  return null;
} //type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

function _getKey(id, i, separator, shouldPadNumbersInIndexes) {
  var _ref;

  return _ref = {}, _ref[i.hashKeyAttribute] = getCompositeKeyValue(id, i.hashKeyFields, i.hashKeyDescriptor, separator, shouldPadNumbersInIndexes), _ref[i.sortKeyAttribute] = getCompositeKeyValue(id, i.sortKeyFields, i.sortKeyDescriptor, separator, shouldPadNumbersInIndexes), _ref;
} //const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


function getRepository(args) {
  var config = getConfig(args);
  var repo = {
    getDocClient: getDocClient,

    get config() {
      return config;
    },

    getCursor: function getCursor(thing, index) {
      var _extends2, _ref2, _ref3;

      var formatted = repo.formatForDDB(thing);

      var cursor = _extends((_extends2 = {}, _extends2[config.primaryIndex.hashKeyAttribute] = formatted[config.primaryIndex.hashKeyAttribute], _extends2[config.primaryIndex.sortKeyAttribute] = formatted[config.primaryIndex.sortKeyAttribute], _extends2), index && (_ref2 = {}, _ref2[index.hashKeyAttribute] = formatted[index.hashKeyAttribute], _ref2), {}, index && (_ref3 = {}, _ref3[index.sortKeyAttribute] = formatted[index.sortKeyAttribute], _ref3));

      return cursor;
    },
    getKey: function getKey(id) {
      var key = _getKey(id, config.primaryIndex, config.compositeKeySeparator, config.shouldPadNumbersInIndexes);

      return key;
    },
    get: function (id) {
      try {
        return Promise.resolve(repo.batchGet([id])).then(function (res) {
          return res[0];
        });
      } catch (e) {
        return Promise.reject(e);
      }
    },
    batchGet: function (ids) {
      try {
        var _RequestItems;

        if (ids.length === 0) {
          return Promise.resolve([]);
        }

        return Promise.resolve(getDocClient().batchGet({
          RequestItems: (_RequestItems = {}, _RequestItems[config.tableName] = {
            Keys: ids.map(repo.getKey)
          }, _RequestItems)
        }).promise()).then(function (res) {
          return res.Responses && res.Responses[config.tableName] ? res.Responses[config.tableName].map(function (doc) {
            if (doc) {
              return getDataFromDocument(doc);
            } else {
              return null;
            }
          }) : [];
        });
      } catch (e) {
        return Promise.reject(e);
      }
    },
    update: function (id, thing) {
      try {
        return Promise.resolve(repo.get(id)).then(function (old) {
          var updated = _extends({}, old, {}, thing);

          return repo.overwrite(updated);
        });
      } catch (e) {
        return Promise.reject(e);
      }
    },
    put: function put(thing) {
      return repo.overwrite(thing);
    },
    overwrite: function (thing) {
      try {
        return Promise.resolve(getDocClient().put({
          TableName: config.tableName,
          Item: repo.formatForDDB(thing)
        }).promise()).then(function () {
          return thing;
        });
      } catch (e) {
        return Promise.reject(e);
      }
    },
    "delete": function (id) {
      try {
        return Promise.resolve(repo.batchDelete([id])).then(function () {
          return true;
        });
      } catch (e) {
        return Promise.reject(e);
      }
    },
    batchDelete: function (ids) {
      try {
        var _RequestItems2;

        if (ids.length === 0) {
          return Promise.resolve([]);
        }

        return Promise.resolve(getDocClient().batchWrite({
          RequestItems: (_RequestItems2 = {}, _RequestItems2[config.tableName] = ids.map(function (id) {
            return {
              DeleteRequest: {
                Key: repo.getKey(id)
              }
            };
          }), _RequestItems2)
        }).promise()).then(function () {
          return ids.map(function () {
            return true;
          });
        });
      } catch (e) {
        return Promise.reject(e);
      }
    },
    getSortKeyAndHashKeyForQuery: function getSortKeyAndHashKeyForQuery(where, index) {
      if (index.isCustomIndex) {
        var hashKey = where.args[index.hashKeyAttribute];
        var sortKey = where.args[index.sortKeyAttribute];
        return {
          hashKey: hashKey,
          sortKey: sortKey
        };
      } else {
        var _hashKey = getCompositeKeyValue(where.args, index.hashKeyFields, index.hashKeyDescriptor, config.compositeKeySeparator, config.shouldPadNumbersInIndexes);

        var _sortKey = index.sortKeyFields && getSortkeyForBeginsWithQuery(where.args, index.sortKeyFields, index.sortKeyDescriptor, config.compositeKeySeparator, config.shouldPadNumbersInIndexes);

        return {
          sortKey: _sortKey,
          hashKey: _hashKey
        };
      }
    },
    getQueryArgs: function getQueryArgs(where, index) {
      var _this$getSortKeyAndHa = this.getSortKeyAndHashKeyForQuery(where, index),
          sortKey = _this$getSortKeyAndHa.sortKey,
          hashKey = _this$getSortKeyAndHa.hashKey;

      var args = _extends({
        TableName: config.tableName
      }, index.indexName && {
        IndexName: index.indexName
      }, {
        Limit: where.limit || 5,
        ScanIndexForward: where.sort === 'asc',
        KeyConditionExpression: "#hKeyAttribute = :hKey " + (sortKey ? 'and begins_with(#sKeyAttribute, :sKey)' : ''),
        ExpressionAttributeNames: _extends({
          '#hKeyAttribute': index.hashKeyAttribute
        }, sortKey && {
          '#sKeyAttribute': index.sortKeyAttribute
        }),
        ExpressionAttributeValues: _extends({
          ':hKey': hashKey
        }, sortKey && {
          ':sKey': sortKey
        })
      }, where.cursor && {
        ExclusiveStartKey: where.cursor
      });

      return args;
    },
    executeQuery: function (where, index) {
      try {
        return Promise.resolve(getDocClient().query(repo.getQueryArgs(where, index)).promise()).then(function (res) {
          var nextWhere = res && res.LastEvaluatedKey && _extends({}, where, {
            cursor: res.LastEvaluatedKey
          });

          return {
            results: res.Items.map(function (i) {
              return getDataFromDocument(i);
            }),
            nextPageArgs: nextWhere
          };
        });
      } catch (e) {
        return Promise.reject(e);
      }
    },
    query: function query(clause) {
      var builder = new QueryBuilder(repo);

      if (clause) {
        return builder.setClause(clause);
      } else {
        return builder;
      }
    },
    formatForDDB: function formatForDDB(thing) {
      var obj = _extends({}, thing, {
        __objectType: config.objectName
      });

      config.indexes.filter(function (i) {
        return !i.isCustomIndex;
      }).forEach(function (i) {
        obj = _extends({}, obj, {}, _getKey(thing, i, config.compositeKeySeparator, config.shouldPadNumbersInIndexes));
      });
      return obj;
    },
    findIndexForQuery: function findIndexForQuery(where) {
      return _findIndexForQuery(where, config);
    },
    indexes: Object.keys(config.indexesByTag).reduce(function (obj, key) {
      obj[key] = function () {
        return repo.query().index(key);
      };

      return obj;
    }, {})
  };
  return repo;
}

var ensureTableIsConfigured = function ensureTableIsConfigured(tableName, indexes) {
  try {
    var client = new AWS.DynamoDB();
    console.log("checking if the table \"" + tableName + "\" has already been created");
    return Promise.resolve(getTableDescription(client, tableName)).then(function (table) {
      var _exit3 = false;

      function _temp9(_result2) {
        if (_exit3) return _result2;
        console.log("table \"" + tableName + "\" already exists, checking the indexes");

        if (table) {
          (table.GlobalSecondaryIndexes || []).forEach(function (i) {
            delete indexesToBeCreated[i.IndexName || ''];
          });
        }

        var toCreate = Object.values(indexesToBeCreated);

        var _temp7 = function () {
          if (toCreate.length > 0) {
            console.log("creating the following indexes " + Object.keys(indexesToBeCreated).join(',') + " to table " + tableName);
            return Promise.resolve(client.updateTable({
              TableName: tableName,
              AttributeDefinitions: toCreate.reduce(function (prev, index) {
                return prev.concat([{
                  AttributeName: index.sortKeyAttribute,
                  AttributeType: 'S'
                }, {
                  AttributeName: index.hashKeyAttribute,
                  AttributeType: 'S'
                }]);
              }, []),
              GlobalSecondaryIndexUpdates: toCreate.map(function (i) {
                return {
                  Create: getGSIDef(i)
                };
              })
            }).promise()).then(function () {
              return Promise.resolve(client.waitFor('tableExists', {
                TableName: tableName
              })).then(function () {});
            });
          } else {
            console.log("the table " + tableName + " has all the necessary indexes");
          }
        }();

        if (_temp7 && _temp7.then) return _temp7.then(function () {});
      }

      console.log('got the description', table);

      var indexesToBeCreated = _extends({}, indexes);

      var _temp8 = function () {
        if (!table) {
          var ins = Object.values(indexesToBeCreated);
          console.log("table \"" + tableName + "\" does not exist, creating it now");
          return Promise.resolve(createTable({
            tableName: tableName,
            indexes: ins
          })).then(function () {
            console.log("table \"" + tableName + "\" created with the following indexes " + Object.keys(indexesToBeCreated).join(','));
            _exit3 = true;
          });
        }
      }();

      return _temp8 && _temp8.then ? _temp8.then(_temp9) : _temp9(_temp8);
    });
  } catch (e) {
    return Promise.reject(e);
  }
};

var getTableDescription = function getTableDescription(client, tableName) {
  try {
    var _temp5 = function _temp5(_result) {
      if (_exit2) return _result;
      console.log('returning nullll');
      return null;
    };

    var _exit2 = false;

    var _temp6 = _catch(function () {
      console.log('calling for describeTable');
      return Promise.resolve(client.describeTable({
        TableName: tableName
      }).promise()).then(function (description) {
        if (description.Table) {
          console.log('returning table description');
          _exit2 = true;
          return description.Table;
        }
      });
    }, function (e) {
      console.log(e);
    });

    return Promise.resolve(_temp6 && _temp6.then ? _temp6.then(_temp5) : _temp5(_temp6));
  } catch (e) {
    return Promise.reject(e);
  }
};

var ensureTableAndIndexesExist = function ensureTableAndIndexesExist(repos) {
  try {
    var tables = getTablesAndIndexes(repos);
    var tableNames = Object.keys(tables);

    var _temp2 = _forTo(tableNames, function (i) {
      var tableName = tableNames[i];
      return Promise.resolve(ensureTableIsConfigured(tableNames[i], tables[tableName])).then(function () {});
    });

    return Promise.resolve(_temp2 && _temp2.then ? _temp2.then(function () {}) : void 0);
  } catch (e) {
    return Promise.reject(e);
  }
};
var getTablesAndIndexes = function getTablesAndIndexes(repos) {
  var tables = {};
  repos.map(function (c) {
    return c.config;
  }).forEach(function (c) {
    if (!tables[c.tableName]) {
      tables[c.tableName] = {};
    }

    c.indexes.forEach(function (i) {
      if (i.type === 'globalSecondaryIndex') {
        tables[c.tableName][i.indexName] = i;
      }
    });
  });
  return tables;
};

exports.AWS = AWS;
exports.WORKAROUND_updateAWSConfig = WORKAROUND_updateAWSConfig;
exports.ensureTableAndIndexesExist = ensureTableAndIndexesExist;
exports.getRepository = getRepository;
exports.setDefaultTableName = setDefaultTableName;
//# sourceMappingURL=single-table-dynamo.cjs.development.js.map
