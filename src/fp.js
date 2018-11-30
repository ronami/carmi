const _ = require('lodash')

function create(carmi) {
    const mapFunctions = (...funcs) =>
        _(funcs).map(f => _.isObject(f) ? _.mapValues(f, (carmiName, fpName) => ({[fpName]: carmi[carmiName]})) : ({[f]: f})).reduce(_.assign)

    const wrappers = new WeakMap()
    function wrap(carmiObject) {
        if (wrappers.has(carmiObject)) {
            return wrappers.get(carmiObject)
        }
        const wrapper = new Proxy(carmiObject, {
            get: (target, prop) => {
                console.log(prop)
                if (_.includes(['toString', 'toJSON', 'toPrimitive'], prop)) {
                    return target[prop]
                }
                return wrap(target[prop])
            }
        })

        wrappers.set(carmiObject, wrapper)
        return wrapper
    }

    function unwrap(wrapperObject) {
        return wrappers.get(wrapperObject)
    }

    function toFP(compiled) {
        return (data, functionLibrary) => {
            
        }
    }
    return {
        Carmi: {
            compile: async (...args) => toFp(await carmi.compile(...args)),
            root: wrap(carmi.root),
            external: new Proxy({}, {
                get: functionName => (firstArg, ...additionalArgs) => firstArg.call(functionName, ...additionalArgs)
            })
        },
        Collection: _.assign({}, _.mapValues(mapFunctions('filter'), toMapperFunction),

        Object: mapFunctions([]),

        String: mapFunctions('startsWith'),

        Number: {
            
        },

        Lang: {

        }
    }
}

module.exports = {
    create
}