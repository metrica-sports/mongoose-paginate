var Promise = require('bluebird');

/**
 * @param {Object}              [model]
 * @param {Object}              [query={}]
 * @param {Object}              [options={}]
 * @param {Object|String}         [options.select]
 * @param {Object|String}         [options.sort]
 * @param {Array|Object|String}   [options.populate]
 * @param {Boolean}               [options.lean=false]
 * @param {Boolean}               [options.leanWithId=true]
 * @param {Number}                [options.offset=0] - Use offset or page to set skip position
 * @param {Number}                [options.page=1]
 * @param {Number}                [options.limit=10]
 * @param {Function}            [callback]
 * @param {String}            [dbFunctionSuffix]
 *
 * @returns {Promise}
 */
function _paginate(model, query, options, callback, dbFunctionSuffix = '') {
    var select     = options.select;
    var sort       = options.sort;
    var populate   = options.populate;
    var lean       = options.lean || false;
    var leanWithId = options.hasOwnProperty('leanWithId') ? options.leanWithId : true;

    var limit = options.hasOwnProperty('limit') ? options.limit : 10;
    var skip, offset, page;

    if (options.hasOwnProperty('offset')) {
        offset = options.offset;
        skip   = offset;
    } else if (options.hasOwnProperty('page')) {
        page = options.page;
        skip = (page - 1) * limit;
    } else {
        offset = 0;
        page   = 1;
        skip   = offset;
    }

    var promises = {
        docs:  Promise.resolve([]),
        count: model[`count${dbFunctionSuffix}`](query).exec()
    };

    if (limit) {
        var query = model[`find${dbFunctionSuffix}`](query)
                   .select(select)
                   .sort(sort)
                   .skip(skip)
                   .limit(limit)
                   .lean(lean);

        if (populate) {
            [].concat(populate).forEach(function(item) {
                query.populate(item);
            });
        }

        promises.docs = query.exec();

        if (lean && leanWithId) {
            promises.docs = promises.docs.then(function(docs) {
                docs.forEach(function(doc) {
                    doc.id = String(doc._id);
                });

                return docs;
            });
        }
    }

    return Promise.props(promises)
        .then(function(data) {
            var result = {
                docs:  data.docs,
                total: data.count,
                limit: limit
            };

            if (offset !== undefined) {
                result.offset = offset;
            }

            if (page !== undefined) {
                result.page  = page;
                result.pages = Math.ceil(data.count / limit) || 1;
            }

            return result;
        })
        .asCallback(callback);
}

function paginate(query, options, callback) {
    query   = query || {};
    options = Object.assign({}, paginate.options, options);

    return _paginate(this, query, options, callback);
}

function paginateDeleted(query, options, callback) {
    query   = query || {};
    options = Object.assign({}, paginateDeleted.options, options);

    return _paginate(this, query, options, callback, 'Deleted');
}

function paginateWithDeleted(query, options, callback) {
    query   = query || {};
    options = Object.assign({}, paginateWithDeleted.options, options);

    return _paginate(this, query, options, callback, 'WithDeleted');
}

/**
 * @param {Schema} schema
 */
module.exports = function(schema) {
    schema.statics.paginate = paginate;
    schema.statics.paginateDeleted = paginateDeleted;
    schema.statics.paginateWithDeleted = paginateWithDeleted;
};

module.exports.paginate = paginate;
module.exports.paginateDeleted = paginateDeleted;
module.exports.paginateWithDeleted = paginateWithDeleted;