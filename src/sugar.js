const _ = require('lodash');

module.exports = function(chain) {
    function getIn(obj, path) {
        return _.reduce(path, (acc, val) => {
            return acc.ternary(acc.get(val), acc)
        }, obj);
    }

    function includes(collection, val) {
        return collection.anyValues(item => item.eq(val));
    }

    function assignIn(obj, args) {
        return chain([
            obj,
            ...args
        ]).assign();
    }

    function reduce(collection, predicate, initialValue) {
        return collection.size().eq(0).ternary(
            initialValue,
            collection.recursiveMap((loop, value, index) => 
                predicate(index.eq(0).ternary(
                    initialValue, index.minus(1).recur(loop)), value, index))
                .get(collection.size().minus(1)))
    }

    function chunks(collection, chunkSize) {
        const numberOfChunks = collection.size().div(chunkSize).ceil()
        const remainder = collection.size().mod(chunkSize)
        const sizeOfLastChunk = remainder.eq(0).ternary(chunkSize, remainder)
        return numberOfChunks.range().map(chunkIndex => 
            chunkIndex.eq(numberOfChunks.minus(1)).ternary(sizeOfLastChunk, chain(chunkSize)).range().map(
            (indexInChunk, i, context) => collection.get(context.get('chunkIndex').mult(chunkSize).plus(indexInChunk)), {chunkIndex}))
    }


    function find(collection, pred) {
        const filtered = collection.filter(pred)
        return filtered.size().eq(0).ternary(null, filtered.get(0))
    }

    function concat(collection, ...args) {
        return _.reduce(args, (a, b) => a.size().plus(b.size()).range().map(index => index.lt(a.size()).ternary(a.get(index), b.get(index.minus(a.size())))), collection)
    }

    return { getIn, includes, assignIn, reduce, concat, chunks, find };
};

