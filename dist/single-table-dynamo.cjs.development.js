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

var _docClient =
/*#__PURE__*/
new AWS.DynamoDB.DocumentClient();

function getDocClient() {
  return _docClient;
}
function WORKAROUND_updateAWSConfig(ops) {
  AWS.config.update(ops);
  _docClient = new AWS.DynamoDB.DocumentClient(ops);
}

/**
 *
 * Each Local Secondary Index is named lsi1, lsi2, ... or lsi3
 * This function should be used when executing a query with a LSI
 *
 * @param i
 */
function getLSIName(which) {
  return "lsi" + which;
}
function getLSISortKeyAttribute(which) {
  return "lsi" + which;
}
function getGSIName(which) {
  return "gsi" + which;
}
function getGSIAttributeName(which, type) {
  return "gsi" + type + which;
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
        ProjectionType: 'INCLUDE',
        NonKeyAttributes: ['data', 'objectType']
      }
    };
  }

  throw "given index of type " + index.type + ", expecting globalSecondaryIndex";
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
  var client = new AWS.DynamoDB();
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
      AttributeName: "hashKey",
      KeyType: "HASH"
    }, {
      AttributeName: "sortKey",
      KeyType: "RANGE"
    }],
    AttributeDefinitions: [{
      AttributeName: "hashKey",
      AttributeType: "S"
    }, {
      AttributeName: "sortKey",
      AttributeType: "S"
    }].concat(localSecondaryIndexes.map(function (i) {
      return {
        AttributeName: i.sortKeyAttributeName,
        AttributeType: "S"
      };
    }), args.indexes.map(function (i) {
      return {
        AttributeName: i.sortKeyAttribute,
        AttributeType: "S"
      };
    }), args.indexes.map(function (i) {
      return {
        AttributeName: i.hashKeyAttribute,
        AttributeType: "S"
      };
    })),
    LocalSecondaryIndexes: [].concat(localSecondaryIndexes.map(function (i) {
      return {
        IndexName: i.indexName,
        KeySchema: [{
          AttributeName: 'hashKey',
          KeyType: 'HASH'
        }, {
          AttributeName: i.sortKeyAttributeName,
          KeyType: 'RANGE'
        }],
        Projection: {
          ProjectionType: 'INCLUDE',
          NonKeyAttributes: ['data', 'objectType']
        }
      };
    })),
    GlobalSecondaryIndexes: globalSecondaryIndexes,
    BillingMode: 'PAY_PER_REQUEST'
  };
  return client.createTable(createTableInput).promise();
}

function getPrimaryIndex(config, tag) {
  if (tag === void 0) {
    tag = '';
  }

  return {
    hashKeyFields: config.hashKeyFields,
    hashKeyDescriptor: config.objectName,
    hashKeyAttribute: 'hashKey',
    sortKeyFields: config.sortKeyFields || [],
    sortKeyDescriptor: config.objectName,
    sortKeyAttribute: 'sortKey',
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

function convertQueryArgToIndex(queryName, config) {
  var index = (config.queries || {})[queryName];

  if (isPrimaryQueryArg(index)) {
    return getPrimaryIndex(config, queryName);
  } else if (isLSIQueryArg(index)) {
    return getLSIIndex(queryName, index, config);
  } else if (isGSIQueryArg(index)) {
    return getGSIIndex(queryName, index, config);
  } else {
    throw queryName + " is not valid";
  }
}
function getLSIIndex(queryName, i, config) {
  return {
    hashKeyFields: config.hashKeyFields,
    hashKeyDescriptor: config.objectName,
    hashKeyAttribute: 'hashKey',
    sortKeyFields: i.sortKeyFields,
    sortKeyDescriptor: queryName,
    sortKeyAttribute: getLSISortKeyAttribute(i.which),
    indexName: getLSIName(i.which),
    type: 'localSecondaryIndex',
    tag: queryName
  };
}
function getGSIIndex(queryName, i, config) {
  return {
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
    queries: {}
  }, argsIn);
  var indexes = [getPrimaryIndex(args)].concat(args.queries ? Object.keys(args.queries).map(function (queryName) {
    return convertQueryArgToIndex(queryName, args);
  }) : []);
  var indexesByTag = indexes.reduce(function (prev, index) {
    var _extends2;

    return _extends({}, prev, (_extends2 = {}, _extends2[index.tag] = index, _extends2));
  }, {});
  return Object.assign({
    tableName: args.tableName || getDefaultTableName(),
    compositeKeySeparator: args.compositeKeySeparator || '#'
  }, {
    objectName: args.objectName,
    primaryIndex: indexes[0],
    indexes: indexes,
    indexesByTag: indexesByTag
  });
}

/**
 *
 * @param thing
 * @param properties
 * @param descriptor
 * @param separator
 *
 * return "{descriptor}#{properties[0]}-{thing[properties[0]]}#..."
 */

function getCompositeKeyValue(thing, properties, descriptor, separator) {
  return [descriptor].concat(properties.map(function (k) {
    return dynamoProperty(k, thing[k]);
  })).join(separator);
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

function dynamoProperty(key, value) {
  return key + "-" + value;
}
function getSortkeyForBeginsWithQuery(thing, indexFields, descriptor, compositeKeySeparator) {
  var fields = [descriptor];

  for (var i = 0; i < indexFields.length; i++) {
    var k = indexFields[i];

    if (k in thing) {
      fields.push(dynamoProperty(k, String(thing[k])));
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
      throw "The index \"" + where.index + "\" does not exist, the following are valid indexes: " + Object.keys(config.indexesByTag).join(',');
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
}

function _getKey(id, i, separator) {
  var _ref;

  return _ref = {}, _ref[i.hashKeyAttribute] = getCompositeKeyValue(id, i.hashKeyFields, i.hashKeyDescriptor, separator), _ref[i.sortKeyAttribute] = getCompositeKeyValue(id, i.sortKeyFields, i.sortKeyDescriptor, separator), _ref;
} //const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


function getRepository(args) {
  var config = getConfig(args);
  var repo = {
    get config() {
      return config;
    },

    getKey: function getKey(id) {
      return _getKey(id, config.primaryIndex, config.compositeKeySeparator);
    },
    get: function (id) {
      try {
        return Promise.resolve(getDocClient().get({
          TableName: config.tableName,
          Key: repo.getKey(id)
        }).promise()).then(function (res) {
          return res.Item ? res.Item.data : null;
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
        return Promise.resolve(getDocClient()["delete"]({
          TableName: config.tableName,
          Key: repo.getKey(id)
        }).promise()).then(function () {
          return true;
        });
      } catch (e) {
        return Promise.reject(e);
      }
    },
    executeQuery: function (where, index) {
      try {
        var hashKey = getCompositeKeyValue(where.args, index.hashKeyFields, index.hashKeyDescriptor, config.compositeKeySeparator);
        var sortKey = index.sortKeyFields && getSortkeyForBeginsWithQuery(where.args, index.sortKeyFields, index.sortKeyDescriptor, config.compositeKeySeparator);
        return Promise.resolve(getDocClient().query(_extends({
          TableName: config.tableName
        }, index.indexName && {
          IndexName: index.indexName
        }, {
          Limit: where.limit || 5,
          KeyConditionExpression: index.hashKeyAttribute + " = :hKey and begins_with(" + index.sortKeyAttribute + ", :sKey) ",
          ExpressionAttributeValues: {
            ':hKey': hashKey,
            ':sKey': sortKey
          }
        }, where.cursor && {
          ExclusiveStartKey: where.cursor
        })).promise()).then(function (res) {
          var nextWhere = res && res.LastEvaluatedKey && _extends({}, where, {
            cursor: res.LastEvaluatedKey
          });

          return {
            results: res.Items.map(function (i) {
              return i.data;
            }),
            nextPageArgs: nextWhere
          };
        });
      } catch (e) {
        return Promise.reject(e);
      }
    },
    query: function (where) {
      try {
        var index = _findIndexForQuery(where, config);

        if (!index) {
          throw 'there isnt an index configured for this query';
        }

        return Promise.resolve(repo.executeQuery(where, index));
      } catch (e) {
        return Promise.reject(e);
      }
    },
    queryOne: function (argsIn) {
      try {
        var _args = _extends({}, argsIn, {
          limit: 1
        });

        return Promise.resolve(repo.query(_args)).then(function (res) {
          if (res.results.length > 0) {
            return res.results[0];
          } else {
            return null;
          }
        });
      } catch (e) {
        return Promise.reject(e);
      }
    },
    formatForDDB: function formatForDDB(thing) {
      var obj = {
        data: thing,
        objectType: config.objectName
      };
      config.indexes.forEach(function (i) {
        obj = _extends({}, obj, {}, _getKey(thing, i, config.compositeKeySeparator));
      });
      return obj;
    },
    findIndexForQuery: function findIndexForQuery(where) {
      return _findIndexForQuery(where, config);
    },
    queries: Object.keys(config.indexesByTag).reduce(function (obj, key) {
      obj[key] = function (where) {
        return repo.executeQuery(where, config.indexesByTag[key]);
      };

      return obj;
    }, {})
  };
  return repo;
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
              GlobalSecondaryIndexUpdates: toCreate.map(function (i) {
                return {
                  Create: getGSIDef(i)
                };
              })
            }).promise()).then(function () {});
          } else {
            console.log("the table " + tableName + " has all the necessary indexes");
          }
        }();

        if (_temp7 && _temp7.then) return _temp7.then(function () {});
      }

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
      return Promise.resolve(client.describeTable({
        TableName: tableName
      }).promise()).then(function (description) {
        if (description.Table) {
          console.log('returning table description!!!!');
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
    console.log(AWS.config.region);
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

exports.AWS = AWS;
exports.WORKAROUND_updateAWSConfig = WORKAROUND_updateAWSConfig;
exports.ensureTableAndIndexesExist = ensureTableAndIndexesExist;
exports.getRepository = getRepository;
exports.setDefaultTableName = setDefaultTableName;
//# sourceMappingURL=single-table-dynamo.cjs.development.js.map
