const { compile, and, or, root, arg0, arg1, setter, splice, bind, chain } = require('../../index');
const {
  describeCompilers,
  currentValues,
  funcLibrary,
  expectTapFunctionToHaveBeenCalled,
  rand
} = require('../test-utils');
const _ = require('lodash');

describe('testing math', () => {
  describeCompilers(['simple', 'optimizing'], compiler => {
    it('floor', async () => {        
        const model = { floored: root.map(val => val.floor().call('tap')), set: setter(arg0) };
        const optCode = eval(await compile(model, { compiler }));
        const inst = optCode([0, 3, 5.5, -2, -10.1], funcLibrary);
        expect(inst.floored).toEqual([0, 3, 5, -2, -11]);
        expectTapFunctionToHaveBeenCalled(inst.$model.length, compiler);
        inst.set(1, 2.2);
        expect(inst.floored).toEqual([0, 2, 5, -2, -11]);
        expectTapFunctionToHaveBeenCalled(1, compiler);
      });
      it('ceil', async () => {        
        const model = { ceiled: root.map(val => val.ceil().call('tap')), set: setter(arg0) };
        const optCode = eval(await compile(model, { compiler }));
        const inst = optCode([0, 3, 5.5, -2, -10.1], funcLibrary);
        expect(inst.ceiled).toEqual([0, 3, 6, -2, -10]);
        expectTapFunctionToHaveBeenCalled(inst.$model.length, compiler);
        inst.set(1, 3.2);
        expect(inst.ceiled).toEqual([0, 4, 6, -2, -10]);
        expectTapFunctionToHaveBeenCalled(1, compiler);
      });
      });
});
