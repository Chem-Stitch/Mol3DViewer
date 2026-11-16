const { test } = require('node:test');
const assert = require('node:assert/strict');
const { shortcutKey } = require('../src/interaction.js');

test('viewer shortcuts accept B/D/F without interfering with typing or repeated keys', () => {
  for (const key of ['b','B','d','D','f','F']) {
    assert.equal(shortcutKey({key}), key.toLowerCase());
    for (const flag of ['repeat','isComposing','ctrlKey','metaKey','altKey','defaultPrevented']) {
      assert.equal(shortcutKey({key,[flag]:true}), null);
    }
    assert.equal(shortcutKey({key}, true), null);
    assert.equal(shortcutKey({key,target:{isContentEditable:true}}), null);
    assert.equal(shortcutKey({key,target:{closest:()=>({})}}), null);
  }
  assert.equal(shortcutKey({key:'x'}), null);
});
