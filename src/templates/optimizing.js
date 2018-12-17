function base() {
  function $NAME($model, $funcLib, $batchingStrategy) {
    'use strict';
    const $res = { $model };
    const $listeners = new Set();
    const $trackingMap = new WeakMap();
    const $trackedMap = new WeakMap();
    const $trackingWildcards = new WeakMap();
    const $invalidatedMap = new WeakMap();
    const $invalidatedRoots = new Set();
    $invalidatedRoots.$subKeys = {};
    $invalidatedRoots.$parentKey = null;
    $invalidatedRoots.$parent = null;
    let $first = true;
    let $tainted = new WeakSet();
    $invalidatedMap.set($res, $invalidatedRoots);

    const $uniquePersistentObjects = new Map();
    const getUniquePersistenObject = id => {
      if (!$uniquePersistentObjects.has(id)) {
        $uniquePersistentObjects.set(id, {});
      }
      return $uniquePersistentObjects.get(id);
    };

    const collectAllItems = (res, obj, prefix) => {
      if (typeof obj !== 'object') {
        return;
      }
      res.set(obj, prefix);
      const keys = Array.isArray(obj) ? new Array(obj.length).fill().map((_, idx) => idx) : Object.keys(obj);
      keys.forEach(idx => {
        const child = obj[idx];
        if (typeof child === 'object') {
          collectAllItems(res, child, `${prefix}.${idx}`);
        }
      });
    };

    const serialize = (all, obj) => {
      if (all.has(obj)) {
        return all.get(obj);
      } else if (obj instanceof WeakMap) {
        return Array.from(all.keys()).reduce((acc, item) => {
          if (obj.has(item)) {
            acc[all.get(item)] = serialize(all, obj.get(item));
          }
          return acc;
        }, {});
      } else if (obj instanceof Map) {
        return Array.from(obj.keys()).reduce((acc, item) => {
          if (all.has(item)) {
            acc[all.get(item)] = serialize(all, obj.get(item));
          } else {
            acc[item] = serialize(all, obj.get(item));
          }
          return acc;
        }, {});
      } else if (obj instanceof Set || obj instanceof Array) {
        return Array.from(obj).map(x => (all.has(x) ? all.get(x) : serialize(all, x)));
      } else if (typeof obj === 'object') {
        return Object.keys(obj).reduce((acc, key) => {
          acc[key] = serialize(all, obj[key]);
          return acc;
        }, {});
      } else {
        return obj;
      }
    };

    const debug = () => {
      const all = new Map();
      collectAllItems(all, $model, '$model');
      collectAllItems(all, $res, '$res');
      console.log(`Found ${all.size} records`);
      console.log(JSON.stringify(serialize(all, { $trackingMap, $invalidatedMap }), null, 2));
    };

    const untrack = ($targetKeySet, $targetKey) => {
      const $tracked = $trackedMap.get($targetKeySet);
      if (!$tracked || !$tracked[$targetKey]) {
        return;
      }
      $tracked[$targetKey].forEach(({ $sourceObj, $sourceKey, $target }) => {
        const $trackingSource = $trackingMap.get($sourceObj);
        $trackingSource[$sourceKey].delete($target);
      });
      delete $tracked[$targetKey];
    };

    const invalidate = ($targetKeySet, $targetKey) => {
      if ($targetKeySet.has($targetKey)) {
        return;
      }
      $targetKeySet.add($targetKey);
      untrack($targetKeySet, $targetKey);
      if ($targetKeySet.$parent) {
        invalidate($targetKeySet.$parent, $targetKeySet.$parentKey);
      }
    };

    function setOnObject($target, $key, $val, $invalidates) {
      let $changed = false;
      let $hard = false;
      if ($invalidates && !$first) {
        if (typeof $target[$key] === 'object' && $target[$key] && $target[$key] !== $val) {
          $hard = true;
        }
        if (
          $hard ||
          $target[$key] !== $val ||
          (typeof $val === 'object' && $tainted.has($val)) ||
          (!$target.hasOwnProperty($key) && $target[$key] === undefined)
        ) {
          $changed = true;
          triggerInvalidations($target, $key, $hard);
        }
      }
      $target[$key] = $val;
      return $changed;
    }

    function deleteOnObject($target, $key, $invalidates) {
      let $hard = false;
      if ($invalidates) {
        if (typeof $target[$key] === 'object' && $target[$key]) {
          $hard = true;
        }
        triggerInvalidations($target, $key, $hard);
      }
      const $invalidatedKeys = $invalidatedMap.get($target);
      if ($invalidatedKeys) {
        delete $invalidatedKeys.$subKeys[$key]
      }
      delete $target[$key];
    }

    function setOnArray($target, $key, $val, $invalidates) {
      let $hard = false;
      if ($invalidates && !$first) {
        if (typeof $target[$key] === 'object' && $target[$key] && $target[$key] !== $val) {
          $hard = true;
        }
        if (
          $hard ||
          $target[$key] !== $val ||
          (typeof $target[$key] === 'object' && $tainted.has($val)) ||
          (!$target.hasOwnProperty($key) && $target[$key] === undefined)
        ) {
          triggerInvalidations($target, $key, $hard);
        }
      }
      $target[$key] = $val;
    }

    function track($target, $sourceObj, $sourceKey, $soft) {
      if (!$trackingMap.has($sourceObj)) {
        $trackingMap.set($sourceObj, {});
      }
      const $track = $trackingMap.get($sourceObj);
      $track[$sourceKey] = $track[$sourceKey] || new Map();
      $track[$sourceKey].set($target, $soft);
      const $tracked = $trackedMap.get($target[0]);
      $tracked[$target[1]] = $tracked[$target[1]] || [];
      $tracked[$target[1]].push({ $sourceKey, $sourceObj, $target });
    }

    function trackPath($target, $path) {
      if (!$trackedMap.has($target[0])) {
        $trackedMap.set($target[0], {});
      }
      const $end = $path.length - 2;
      let $current = $path[0];
      for (let i = 0; i <= $end; i++) {
        track($target, $current, $path[i + 1], i !== $end);
        $current = $current[$path[i + 1]];
      }
    }

    function triggerInvalidations($sourceObj, $sourceKey, $hard) {
      $tainted.add($sourceObj);
      const $track = $trackingMap.get($sourceObj);
      if ($track && $track.hasOwnProperty($sourceKey)) {
        $track[$sourceKey].forEach(($soft, $target) => {
          if (!$soft || $hard) {
            invalidate($target[0], $target[1]);
          }
        });
      }
      if ($trackingWildcards.has($sourceObj)) {
        $trackingWildcards.get($sourceObj).forEach($targetInvalidatedKeys => {
          invalidate($targetInvalidatedKeys, $sourceKey);
        });
      }
    }

    function initOutput($parentInvalidatedKeys, $targetKey, src, func, createDefaultValue, createCacheValue) {
      const subKeys = $parentInvalidatedKeys.$subKeys;
      const $cachePerTargetKey = subKeys[$targetKey] = subKeys[$targetKey] || new Map();
      let $cachedByFunc = $cachePerTargetKey.get(func);
      if (!$cachedByFunc) {
        const $resultObj = createDefaultValue();
        const $cacheValue = createCacheValue();
        const $invalidatedKeys = new Set();
        $invalidatedKeys.$subKeys = {};
        $invalidatedKeys.$parentKey = $targetKey;
        $invalidatedKeys.$parent = $parentInvalidatedKeys;
        $invalidatedMap.set($resultObj, $invalidatedKeys);
        $cachedByFunc = [null, $resultObj, $invalidatedKeys, true, $cacheValue];
        $cachePerTargetKey.set(func, $cachedByFunc);
      } else {
        $cachedByFunc[3] = false;
      }
      const $invalidatedKeys = $cachedByFunc[2];
      const $prevSrc = $cachedByFunc[0];
      if ($prevSrc !== src) {
        if ($prevSrc) { // prev mapped to a different collection
          $trackingWildcards.get($prevSrc).delete($invalidatedKeys);
          if (Array.isArray($prevSrc)) {
            $prevSrc.forEach((_item, index) => $invalidatedKeys.add(index));
          } else {
            Object.keys($prevSrc).forEach(key => $invalidatedKeys.add(key));
          }
          if (Array.isArray(src)) {
            src.forEach((_item, index) => $invalidatedKeys.add(index));
          } else {
            Object.keys(src).forEach(key => $invalidatedKeys.add(key));
          }
        }
        if (!$trackingWildcards.has(src)) {
          $trackingWildcards.set(src, new Set());
        }
        $trackingWildcards.get(src).add($invalidatedKeys);
        $cachedByFunc[0] = src;
      }
      return $cachedByFunc;
    }

    const emptyObj = () => {
      return {};
    };
    const emptyArr = () => [];
    const nullFunc = () => null;

    function mapValuesOpt($targetObj, $targetKey, identifier, func, src, context, $invalidates) {
      const $storage = initOutput($targetObj, $targetKey, src, identifier, emptyObj, nullFunc);
      const $out = $storage[1]
      const $invalidatedKeys = $storage[2];
      const $new = $storage[3];
      (($new && Object.keys(src)) || $invalidatedKeys).forEach(key => {
        if (!src.hasOwnProperty(key)) {
          if ($out.hasOwnProperty(key)) {
            deleteOnObject($out, key, $invalidates);
          }
        } else {
          const res = func($invalidatedKeys, key, src[key], context);
          setOnObject($out, key, res, $invalidates);
        }
      });
      $invalidatedKeys.clear();
      return $out;
    }


    function filterByOpt($targetObj, $targetKey, identifier, func, src, context, $invalidates) {
      const $storage = initOutput($targetObj, $targetKey, src, identifier, emptyObj, nullFunc);
      const $out = $storage[1]
      const $invalidatedKeys = $storage[2];
      const $new = $storage[3];
      (($new && Object.keys(src)) || $invalidatedKeys).forEach(key => {
        if (!src.hasOwnProperty(key)) {
          if ($out.hasOwnProperty(key)) {
            deleteOnObject($out, key, $invalidates);
          }
        } else {
          const res = func($invalidatedKeys, key, src[key], context);
          if (res) {
            setOnObject($out, key, src[key], $invalidates);
          } else if ($out.hasOwnProperty(key)) {
            deleteOnObject($out, key, $invalidates);
          }
        }
      });
      $invalidatedKeys.clear();
      return $out;
    }

    function mapOpt($targetObj, $targetKey, identifier, func, src, context, $invalidates) {
      const $storage = initOutput($targetObj, $targetKey, src, identifier, emptyArr, nullFunc);
      const $out = $storage[1]
      const $invalidatedKeys = $storage[2];
      const $new = $storage[3];
      if ($new) {
        for (let key = 0; key < src.length; key++) {
          const res = func($invalidatedKeys, key, src[key], context);
          setOnArray($out, key, res, $invalidates);
        }
      } else {
        $invalidatedKeys.forEach(key => {
          if (key >= src.length) {
            setOnArray($out, key, undefined, $invalidates);
            $out.length = src.length;
          } else {
            const res = func($invalidatedKeys, key, src[key], context);
            setOnArray($out, key, res, $invalidates);
          }
        })
      }
      $invalidatedKeys.clear();
      return $out;
    }

    function forArray($targetObj, $targetKey, identifier, func, src, context) {
      const $storage = initOutput($targetObj, $targetKey, src, identifier, emptyArr, nullFunc);
      const $out = $storage[1]
      const $invalidatedKeys = $storage[2];
      const $new = $storage[3];
      if ($new) {
        for (let key = 0; key < src.length; key++) {
          func($invalidatedKeys, src, key, $out, context);
        }
      } else {
        $invalidatedKeys.forEach(key => {
          func($invalidatedKeys, src, key, $out, context);
        });
      }
      $invalidatedKeys.clear();
      return $out;
    }

    function recursiveSteps(key, $localInvalidatedKeys, $localKey) {
      const { $dependencyMap, $currentStack, $invalidatedKeys, $out, func, src, context } = this;
      if ($currentStack.length > 0) {
        const prevKey = $currentStack[$currentStack.length - 1];
        if (!$dependencyMap.has(key)) {
          $dependencyMap.set(key, []);
        }
        $dependencyMap.get(key).push({ $localInvalidatedKeys, $localKey });
      }
      if ($invalidatedKeys.has(key)) {
        $currentStack.push(key);
        func($invalidatedKeys, src, key, $out, context, this);
        $invalidatedKeys.delete(key);
        $currentStack.pop();
      }
      return $out[key];
    }

    function cascadeRecursiveInvalidations($loop) {
      const { $dependencyMap, $invalidatedKeys } = $loop;
      $invalidatedKeys.forEach(key => {
        if ($dependencyMap.has(key)) {
          $dependencyMap.get(key).forEach(({ $localInvalidatedKeys, $localKey }) => {
            invalidate($localInvalidatedKeys, $localKey);
          });
          $dependencyMap.delete(key);
        }
      });
    }

    const recursiveCacheFunc = () => ({
      $dependencyMap: new Map(),
      $currentStack: [],
      recursiveSteps
    })

    function recursiveMapArray($targetObj, $targetKey, identifier, func, src, context) {
      const $storage = initOutput($targetObj, $targetKey, src, identifier, emptyArr, recursiveCacheFunc);
      const $out = $storage[1]
      const $invalidatedKeys = $storage[2];
      const $new = $storage[3];
      const $loop = $storage[4];
      $loop.$invalidatedKeys = $invalidatedKeys;
      $loop.$out = $out;
      $loop.context = context;
      $loop.func = func;
      $loop.src = src;

      if ($new) {
        for (let key = 0; key < src.length; key++) {
          $invalidatedKeys.add(key);
        }
        for (let key = 0; key < src.length; key++) {
          $loop.recursiveSteps(key, $invalidatedKeys, key);
        }
      } else {
        cascadeRecursiveInvalidations($loop);
        $invalidatedKeys.forEach(key => {
          $loop.recursiveSteps(key, $invalidatedKeys, key);
        });
      }
      $invalidatedKeys.clear();
      return $out;
    }

    function recursiveMapObject($targetObj, $targetKey, identifier, func, src, context) {
      const $storage = initOutput($targetObj, $targetKey, src, identifier, emptyObj, recursiveCacheFunc);
      const $out = $storage[1]
      const $invalidatedKeys = $storage[2];
      const $new = $storage[3];
      const $loop = $storage[4];
      $loop.$invalidatedKeys = $invalidatedKeys;
      $loop.$out = $out;
      $loop.context = context;
      $loop.func = func;
      $loop.src = src;
      if ($new) {
        Object.keys(src).forEach(key => $invalidatedKeys.add(key));
        Object.keys(src).forEach(key => $loop.recursiveSteps(key, $invalidatedKeys, key));
      } else {
        cascadeRecursiveInvalidations($loop);
        $invalidatedKeys.forEach(key => {
          $loop.recursiveSteps(key, $invalidatedKeys, key);
        });
      }
      $invalidatedKeys.clear();
      return $out;
    }

    function keyByArray($targetObj, $targetKey, identifier, func, src, context) {
      const $storage = initOutput($targetObj, $targetKey, src, identifier, emptyObj, emptyArr);
      const $out = $storage[1]
      const $invalidatedKeys = $storage[2];
      const $new = $storage[3];
      const $idxToKey = $storage[4];
      if ($new) {
        for (let key = 0; key < src.length; key++) {
          func($invalidatedKeys, $idxToKey, src, key, $out, context);
        }
      } else {
        const keysPendingDelete = new Set();
        $invalidatedKeys.forEach(key => keysPendingDelete.add($idxToKey[key]));
        $invalidatedKeys.forEach(key => {
          keysPendingDelete.delete(func($invalidatedKeys, $idxToKey, src, key, $out, context));
        });
        keysPendingDelete.forEach(key => {
          triggerInvalidations($out, key);
          delete $out[key];
        });
      }
      $idxToKey.length = src.length;
      $invalidatedKeys.clear();
      return $out;
    }

    function mapKeysObject($targetObj, $targetKey, identifier, func, src, context) {
      const $storage = initOutput($targetObj, $targetKey, src, identifier, emptyObj, emptyObj);
      const $out = $storage[1]
      const $invalidatedKeys = $storage[2];
      const $new = $storage[3];
      const $keyToKey = $storage[4];
      if ($new) {
        Object.keys(src).forEach(key => {
          $keyToKey[key] = func($invalidatedKeys, src, key, $out, context);
        });
      } else {
        const keysPendingDelete = new Set();
        $invalidatedKeys.forEach(key => {
          if ($keyToKey.hasOwnProperty(key)) {
            keysPendingDelete.add($keyToKey[key]);
            delete $keyToKey[key];
          }
        });
        $invalidatedKeys.forEach(key => {
          if (src.hasOwnProperty(key)) {
            const newKey = func($invalidatedKeys, src, key, $out, context);
            $keyToKey[key] = newKey;
            keysPendingDelete.delete(newKey);
          }
        });
        keysPendingDelete.forEach(key => {
          deleteOnObject($out, key, true);
        });
      }
      $invalidatedKeys.clear();
      return $out;
    }

    const filterCacheFunc = () => [0];

    function filterArray($targetObj, $targetKey, identifier, func, src, context) {
      const $storage = initOutput($targetObj, $targetKey, src, identifier, emptyArr, filterCacheFunc);
      const $out = $storage[1]
      const $invalidatedKeys = $storage[2];
      const $new = $storage[3];
      const $idxToIdx = $storage[4];
      if ($new) {
        for (let key = 0; key < src.length; key++) {
          func($invalidatedKeys, $idxToIdx, src, key, $out, context);
        }
      } else {
        let firstIndex = Number.MAX_SAFE_INTEGER;
        $invalidatedKeys.forEach(key => (firstIndex = Math.min(firstIndex, key)));
        for (let key = firstIndex; key < src.length; key++) {
          func($invalidatedKeys, $idxToIdx, src, key, $out, context);
        }
        $idxToIdx.length = src.length + 1;
        for (let key = $idxToIdx[$idxToIdx.length - 1]; key < $out.length; key++) {
          triggerInvalidations($out, key);
        }
        $out.length = $idxToIdx[$idxToIdx.length - 1];
      }
      $invalidatedKeys.clear();
      return $out;
    }

    function anyObject($targetObj, $targetKey, identifier, func, src, context) {
      const $storage = initOutput($targetObj, $targetKey, src, identifier, emptyArr, nullFunc);
      const $out = $storage[1]
      const $invalidatedKeys = $storage[2];
      const $new = $storage[3];
      // $out has at most 1 key - the one that stopped the previous run because it was truthy
      if ($new) {
        Object.keys(src).forEach(key => $invalidatedKeys.add(key));
      }
      const $prevStop = $out.length > 0 ? $out[0] : false;
      if ($prevStop) {
        if ($invalidatedKeys.has($prevStop)) {
          $invalidatedKeys.delete($prevStop);
          if (func($invalidatedKeys, src, $prevStop, $out, context)) {
            return true;
          } else {
            $out.length = 0;
          }
        } else {
          return true;
        }
      }
      for (let key of $invalidatedKeys) {
        $invalidatedKeys.delete(key);
        if (func($invalidatedKeys, src, key, $out, context)) {
          $out[0] = key;
          return true;
        }
      }
      return false;
    }

    function anyArray($targetObj, $targetKey, identifier, func, src, context) {
      const $storage = initOutput($targetObj, $targetKey, src, identifier, emptyArr, nullFunc);
      const $out = $storage[1]
      const $invalidatedKeys = $storage[2];
      const $new = $storage[3];
      // $out has at most 1 key - the one that stopped the previous run because it was truthy
      if ($new) {
        for (let key = 0; key < src.length; key++) {
          $invalidatedKeys.add(key);
        }
      }
      const $prevStop = $out.length > 0 ? $out[0] : -1;
      if ($prevStop !== -1) {
        if ($invalidatedKeys.has($prevStop)) {
          $invalidatedKeys.delete($prevStop);
          if (func($invalidatedKeys, src, $prevStop, $out, context)) {
            return true;
          } else {
            $out.length = 0;
          }
        } else {
          return true;
        }
      }
      for (let key of $invalidatedKeys) {
        $invalidatedKeys.delete(key);
        if (func($invalidatedKeys, src, key, $out, context)) {
          $out[0] = key;
          return true;
        }
      }
      return false;
    }

    function groupByOpt($targetObj, $targetKey, identifier, func, src, context, $invalidates) {
      const $storage = initOutput($targetObj, $targetKey, src, identifier, emptyObj, emptyObj);
      const $out = $storage[1]
      const $invalidatedKeys = $storage[2];
      const $new = $storage[3];
      const $keyToKey = $storage[4];
      if (Array.isArray(src)) {
        throw new Error('groupBy only works on objects');
      }
      if ($new) {
        Object.keys(src).forEach(key => {
          const res = '' + func($invalidatedKeys, key, src[key], context);
          $keyToKey[key] = res;
          if (!$out[res]) {
            setOnObject($out, res, {}, $invalidates);
          }
          setOnObject($out[res], key, src[key], $invalidates);
        });
      } else {
        const keysPendingDelete = {};
        $invalidatedKeys.forEach(key => {
          if ($keyToKey[key]) {
            keysPendingDelete[$keyToKey[key]] = keysPendingDelete[$keyToKey[key]] || new Set();
            keysPendingDelete[$keyToKey[key]].add(key);
          }
        });
        $invalidatedKeys.forEach(key => {
          const res = '' + func($invalidatedKeys, key, src[key], context);
          $keyToKey[key] = res;
          if (!$out[res]) {
            setOnObject($out, res, {}, $invalidates);
          }
          setOnObject($out[res], key, src[key], $invalidates);
          if (keysPendingDelete.hasOwnProperty(res)) {
            keysPendingDelete[res].delete(key);
          }
        });
        Object.keys(keysPendingDelete).forEach(res => {
          if (keysPendingDelete[res].size > 0) {
            keysPendingDelete[res].forEach(key => {
              triggerInvalidations($out[res], key);
              delete $out[res][key];
            });
            triggerInvalidations($out, res);
            if (Object.keys($out[res]).length == 0) {
              delete $out[res];
            }
          }
        });
      }
      $invalidatedKeys.clear();
      return $out;
    }

    const valuesOrKeysCacheFunc = () => ({$keyToIdx: {}, $idxToKey: []});

    function valuesOrKeysForObject($targetObj, $targetKey, identifier, src, getValues) {
      const $storage = initOutput($targetObj, $targetKey, src, identifier, emptyArr, valuesOrKeysCacheFunc);
      const $out = $storage[1]
      const $invalidatedKeys = $storage[2];
      const $new = $storage[3];
      const { $keyToIdx, $idxToKey } = $storage[4];
      if ($new) {
        Object.keys(src).forEach((key, idx) => {
          $out[idx] = getValues ? src[key] : key;
          $idxToKey[idx] = key;
          $keyToIdx[key] = idx;
        });
      } else {
        const $deletedKeys = [];
        const $addedKeys = [];
        const $touchedKeys = [];
        $invalidatedKeys.forEach(key => {
          if (src.hasOwnProperty(key) && !$keyToIdx.hasOwnProperty(key)) {
            $addedKeys.push(key);
          } else if (!src.hasOwnProperty(key) && $keyToIdx.hasOwnProperty(key)) {
            $deletedKeys.push(key);
          } else {
            if ($keyToIdx.hasOwnProperty(key)) {
              $out[$keyToIdx[key]] = getValues ? src[key] : key;
              triggerInvalidations($out, $keyToIdx[key]);
            }
          }
        });
        if ($addedKeys.length < $deletedKeys.length) {
          $deletedKeys.sort((a, b) => $keyToIdx[a] - $keyToIdx[b]);
        }
        const $finalOutLength = $out.length - $deletedKeys.length + $addedKeys.length;
        // keys both deleted and added fill created holes first
        for (let i = 0; i < $addedKeys.length && i < $deletedKeys.length; i++) {
          const $addedKey = $addedKeys[i];
          const $deletedKey = $deletedKeys[i];
          const $newIdx = $keyToIdx[$deletedKey];
          delete $keyToIdx[$deletedKey];
          $keyToIdx[$addedKey] = $newIdx;
          $idxToKey[$newIdx] = $addedKey;
          $out[$newIdx] = getValues ? src[$addedKey] : $addedKey;
          triggerInvalidations($out, $newIdx);
        }
        // more keys added - append to end
        for (let i = $deletedKeys.length; i < $addedKeys.length; i++) {
          const $addedKey = $addedKeys[i];
          const $newIdx = $out.length;
          $keyToIdx[$addedKey] = $newIdx;
          $idxToKey[$newIdx] = $addedKey;
          $out[$newIdx] = getValues ? src[$addedKey] : $addedKey;
          triggerInvalidations($out, $newIdx);
        }
        // more keys deleted - move non deleted items at the tail to the location of deleted
        const $deletedNotMoved = $deletedKeys.slice($addedKeys.length);
        const $deletedNotMovedSet = new Set($deletedKeys.slice($addedKeys.length));
        const $keysToMoveInside = new Set(
          $idxToKey.slice($finalOutLength).filter(key => !$deletedNotMovedSet.has(key))
        );
        let $savedCount = 0;
        for (let $tailIdx = $finalOutLength; $tailIdx < $out.length; $tailIdx++) {
          const $currentKey = $idxToKey[$tailIdx];
          if ($keysToMoveInside.has($currentKey)) {
            // need to move this key to one of the pending delete
            const $switchedWithDeletedKey = $deletedNotMoved[$savedCount];
            const $newIdx = $keyToIdx[$switchedWithDeletedKey];
            $out[$newIdx] = getValues ? src[$currentKey] : $currentKey;
            $keyToIdx[$currentKey] = $newIdx;
            $idxToKey[$newIdx] = $currentKey;
            delete $keyToIdx[$switchedWithDeletedKey];
            triggerInvalidations($out, $newIdx);
            $savedCount++;
          } else {
            delete $keyToIdx[$currentKey];
          }
          triggerInvalidations($out, $tailIdx);
        }
        $out.length = $finalOutLength;
        $idxToKey.length = $out.length;
        $invalidatedKeys.clear();
      }
      return $out;
    }

    function getEmptyArray($invalidatedKeys, $targetKey, token) {
      const subKeys = $invalidatedKeys.$subKeys;
      const $cachePerTargetKey = subKeys[$targetKey] = subKeys[$targetKey] || new Map();
      if (!$cachePerTargetKey.has(token)) {
        $cachePerTargetKey.set(token, []);
      }
      return $cachePerTargetKey.get(token);
    }

    function getEmptyObject($invalidatedKeys, $targetKey, token) {
      const subKeys = $invalidatedKeys.$subKeys;
      const $cachePerTargetKey = subKeys[$targetKey] = subKeys[$targetKey] || new Map();
      if (!$cachePerTargetKey.has(token)) {
        $cachePerTargetKey.set(token, {});
      }
      return $cachePerTargetKey.get(token);
    }

    function array($invalidatedKeys, key, newVal, identifier, len, invalidates) {
      const res = getEmptyArray($invalidatedKeys, key, identifier);
      invalidates = invalidates && res.length === len;
      for (let i = 0; i < len; i++) {
        setOnArray(res, i, newVal[i], invalidates);
      }
      return res;
    }

    function object($invalidatedKeys, key, newVal, identifier, keysList, invalidates) {
      const res = getEmptyObject($invalidatedKeys, key, identifier);
      invalidates = invalidates && keysList.length && res.hasOwnProperty(keysList[0]);
      for (let i = 0; i < keysList.length; i++) {
        const name = keysList[i];
        setOnObject(res, name, newVal[name], invalidates);
      }
      return res;
    }

    function call($invalidatedKeys, key, newVal, identifier, len, invalidates) {
      const arr = getEmptyArray($invalidatedKeys, key, identifier);
      if (arr.length === 0) {
        arr.push([]);
      }
      const args = arr[0];
      for (let i = 0; i < len; i++) {
        setOnArray(args, i, newVal[i], true);
      }
      if (arr.length === 1 || $tainted.has(args)) {
        arr[1] = $funcLib[args[0]].apply($res, args.slice(1));
      }
      return arr[1];
    }

    function bind($invalidatedKeys, key, newVal, identifier, len) {
      const arr = getEmptyArray($invalidatedKeys, key, identifier);
      if (arr.length === 0) {
        arr.push([]);
      }
      const args = arr[0];
      for (let i = 0; i < len; i++) {
        args[i] = newVal[i];
      }
      if (arr.length === 1) {
        arr[1] = (...extraArgs) => {
          const fn = $funcLib[args[0]] || $res[args[0]];
          return fn.apply($res, args.slice(1).concat(extraArgs));
        };
      }
      return arr[1]
    }

    function assignOrDefaults($targetObj, $targetKey, identifier, src, assign, invalidates) {
      const $storage = initOutput($targetObj, $targetKey, src, identifier, emptyObj, nullFunc);
      const $out = $storage[1]
      const $invalidatedKeys = $storage[2];
      const $new = $storage[3];
      if (!assign) {
        src = [...src].reverse();
      }
      if ($new) {
        Object.assign($out, ...src);
      } else {
        const $keysPendingDelete = new Set(Object.keys($out));
        const res = Object.assign({}, ...src);
        Object.keys(res).forEach(key => {
          $keysPendingDelete.delete(key);
          setOnObject($out, key, res[key], invalidates);
        });
        $keysPendingDelete.forEach(key => {
          delete $out[key];
          triggerInvalidations($out, key);
        });
        $invalidatedKeys.clear();
      }
      return $out;
    }

    function size($targetObj, $targetKey, src, identifier) {
      const $storage = initOutput($targetObj, $targetKey, src, identifier, emptyArr, nullFunc);
      const $out = $storage[1]
      const $invalidatedKeys = $storage[2];
      const $new = $storage[3];
      if ($new) {
        $out[0] = Array.isArray(src) ? src.length : Object.keys(src).length;
      }
      if (!$new) {
        $out[0] = Array.isArray(src) ? src.length : Object.keys(src).length;
        $invalidatedKeys.clear();
      }
      return $out[0];
    }

    function range($invalidatedKeys, key, end, start, step, identifier) {
      const $out = getEmptyArray($invalidatedKeys, key, identifier);
      if ($out.length === 0) {
        for (let val = start; (step > 0 && val < end) || (step < 0 && val > end); val += step) {
          $out.push(val);
        }
      } else {
        let len = 0;
        for (let val = start; (step > 0 && val < end) || (step < 0 && val > end); val += step) {
          if ($out[len] !== val) {
            triggerInvalidations($out, len);
          }
          $out[len] = val;
          len++;
        }
        if ($out.length > len) {
          for (let i = len; i < $out.length; i++) {
            triggerInvalidations($out, i);
          }
          $out.length = len;
        }
      }
      return $out;
    }

    /* ALL_EXPRESSIONS */
    let $inBatch = false;
    let $batchPending = [];
    let $inRecalculate = false;

    function recalculate() {
      if ($inBatch) {
        return;
      }
      $inRecalculate = true;
      /* DERIVED */
      $tainted = new WeakSet();
      $first = false;
      $listeners.forEach(callback => callback());
      $inRecalculate = false;
      if ($batchPending.length) {
        $res.$endBatch();
      }
    }

    function $setter(func, ...args) {
      if (!$inBatch && $batchingStrategy) {
        $batchingStrategy.call($res);
        $inBatch = true;
      }
      if ($inBatch || $inRecalculate) {
        $batchPending.push({ func, args });
      } else {
        func.apply($res, args);
        recalculate();
      }
    }

    Object.assign(
      $res,
      {
        /* SETTERS */
      },
      {
        $startBatch: () => ($inBatch = true),
        $endBatch: () => {
          $inBatch = false;
          if ($batchPending.length) {
            $batchPending.forEach(({ func, args }) => {
              func.apply($res, args);
            });
            $batchPending = [];
            recalculate();
          }
        },
        $runInBatch: func => {
          $res.$startBatch();
          func();
          $res.$endBatch();
        },
        $addListener: func => {
          $listeners.add(func);
        },
        $removeListener: func => {
          $listeners.delete(func);
        },
        /* DEBUG */
        $ast: () => {
          return $AST;
        },
        $source: () => {
          return /* SOURCE_FILES */;
        }
        /* DEBUG-END */
      }
    );
    recalculate();
    return $res;
  }
}

function topLevel() {
  $invalidatedRoots.add('$FUNCNAME');
  function $$FUNCNAMEBuild() {
    const acc = $res;
    const key = '$FUNCNAME';
    const $invalidatedKeys = $invalidatedRoots;
    /* PRETRACKING */
    const newValue = $EXPR;
    setOnObject($res, '$FUNCNAME', newValue, $INVALIDATES);
    $invalidatedRoots.delete('$FUNCNAME');
    /* TRACKING */
    return $res.$FUNCNAME;
  }
}

function mapKeys() {
  function $FUNCNAME($invalidatedKeys, src, key, acc, context) {
    let $changed = false;
    /* PRETRACKING */
    const val = src[key];
    const newKey = $EXPR1;
    setOnObject(acc, newKey, val, $INVALIDATES);
    /* TRACKING */
    return newKey;
  }
}

mapKeys.collectionFunc = 'mapKeysObject';


function any() {
  function $FUNCNAME($invalidatedKeys, src, key, acc, context) {
    let $changed = false;
    /* PRETRACKING */
    const val = src[key];
    let res = false;
    if (key >= src.length) {
      $changed = true;
    } else {
      res = $EXPR1;
      $changed = acc[0] !== key;
    }
    /* TRACKING */
    return res;
  }
}
any.collectionFunc = 'anyArray';

function anyValues() {
  function $FUNCNAME($invalidatedKeys, src, key, acc, context) {
    let $changed = false;
    /* PRETRACKING */
    let res = false;
    const val = src[key];
    if (!src.hasOwnProperty(key)) {
      $changed = true;
    } else {
      res = $EXPR1;
      $changed = acc[0] !== key;
    }
    /* TRACKING */
    return res;
  }
}
anyValues.collectionFunc = 'anyObject';

function keyBy() {
  function $FUNCNAME($invalidatedKeys, $idxToKey, src, key, acc, context) {
    /* PRETRACKING */
    let res = null;
    if (key < src.length) {
      const val = src[key];
      res = '' + $EXPR1;
      setOnObject(acc, res, val, $INVALIDATES);
      acc[res] = val;
      $idxToKey[key] = res;
      /* TRACKING */
    }
    return res;
  }
}
keyBy.collectionFunc = 'keyByArray';

function filter() {
  function $FUNCNAME($invalidatedKeys, $idxToIdx, src, key, acc, context) {
    /* PRETRACKING */
    const val = src[key];
    const res = $EXPR1;
    const prevItemIdx = $idxToIdx[key];
    const nextItemIdx = res ? prevItemIdx + 1 : prevItemIdx;
    let $changed = false;
    if (nextItemIdx !== prevItemIdx) {
      setOnArray(acc, prevItemIdx, val, $INVALIDATES);
    }
    $idxToIdx[key + 1] = nextItemIdx;
    /* TRACKING */
  }
}
filter.collectionFunc = 'filterArray';

function recursiveMap() {
  function $FUNCNAME($invalidatedKeys, src, key, acc, context, loop) {
    let $changed = false;
    /* PRETRACKING */
    const val = src[key];
    if (key >= src.length) {
      setOnArray(acc, key, undefined, $INVALIDATES);
      if (acc.length >= key) {
        acc.length = src.length;
      }
    } else {
      const res = $EXPR1;
      setOnArray(acc, key, res, $INVALIDATES);
      /* TRACKING */
    }
  }
}
recursiveMap.collectionFunc = 'recursiveMapArray';

function recursiveMapValues() {
  function $FUNCNAME($invalidatedKeys, src, key, acc, context, loop) {
    let $changed = false;
    /* PRETRACKING */
    const val = src[key];
    if (!src.hasOwnProperty(key)) {
      if (acc.hasOwnProperty(key)) {
        deleteOnObject(acc, key, $INVALIDATES);
      }
    } else {
      const res = $EXPR1;
      setOnObject(acc, key, res, $INVALIDATES);
      acc[key] = res;
      /* TRACKING */
    }
  }
}
recursiveMapValues.collectionFunc = 'recursiveMapObject';

function object() {
  const $FUNCNAMEArgs = [
    /*ARGS*/
  ];
}

function array() {
}

function library() {}


function func() {
  function $FUNCNAME($invalidatedKeys, key, val, context) {
    /* PRETRACKING */
    const res = $EXPR1;
    /* TRACKING */
    return res;
  }
}

module.exports = {
  base,
  library,
  topLevel,
  mapKeys,
  any,
  anyValues,
  keyBy,
  filter,
  recursiveMap,
  recursiveMapValues,
  object,
  array,
  func
};
