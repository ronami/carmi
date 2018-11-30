const { fp } = require('../../index');
const {
  describeCompilers,
  currentValues,
  funcLibrary,
  expectTapFunctionToHaveBeenCalled,
  rand
} = require('../test-utils');
const _ = require('lodash');

describeCompilers(['basic', 'optimizing'], () => {
    describe('fp', () => {
        describe('String', () => {
            describe('startsWith', () => {
                it('should ', async() => {
                    const model = {get: fp.Collection.filter(v => fp.external.tap(fp.String.startsWith('with-')(v)))(fp.root)}
                    const transforms = await fp.compile(model, {compiler})
                    const inst = optCode(['garbage', 'with-prefix', 'with-something', 'nothing'], funcLibrary);
                    expect(inst.get).toEqual(['with-prefix', 'with-something'])
                })
            })
        })        
    })
})
