const { test } = require('node:test');
const assert = require('node:assert/strict');
const { shortcutKey, bindViewerFocus, bondShortcut } = require('../src/interaction.js');

test('viewer shortcuts accept B/D/F/N without interfering with typing or repeated keys', () => {
  for (const key of ['b','B','d','D','f','F','n','N','1','2','3']) {
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

test('canvas pointer down transfers focus without scrolling or cancelling gestures', () => {
  let listener,active='coordinates';
  const element={
    addEventListener(type,callback,capture){assert.equal(type,'pointerdown');assert.equal(capture,true);listener=callback;},
    removeEventListener(type,callback,capture){assert.equal(type,'pointerdown');assert.equal(callback,listener);assert.equal(capture,true);listener=null;}
  };
  const cleanup=bindViewerFocus(element,{focus(options){assert.deepEqual(options,{preventScroll:true});active='workspace';}});
  listener();
  assert.equal(active,'workspace');
  assert.equal(shortcutKey({key:'f',target:{isContentEditable:false,closest:()=>null}}),'f');
  cleanup();assert.equal(listener,null);
});

test('B cycles through all solid orders and removal; dashed starts at single', () => {
  let bond;
  for(const order of [1,2,3]) {
    bond=bondShortcut('b',bond);
    assert.deepEqual(bond,{order,dashed:false});
  }
  bond=bondShortcut('b',bond);assert.equal(bond,null);
  assert.deepEqual(bondShortcut('b',bond),{order:1,dashed:false});
  assert.deepEqual(bondShortcut('b',{order:1,dashed:true}),{order:1,dashed:false});
});

test('numeric keys set solid order and D toggles dashed bonds off', () => {
  for(const current of [undefined,{order:1,dashed:true},...[1,2,3].map(order=>({order,dashed:false}))]) {
    for(const order of [1,2,3])assert.deepEqual(bondShortcut(String(order),current),{order,dashed:false});
    const dashed=bondShortcut('d',current);
    if(current?.dashed)assert.equal(dashed,null);
    else {assert.deepEqual(dashed,{order:1,dashed:true});assert.equal(bondShortcut('d',dashed),null);}
  }
});

test('blank clicks clear after picking, but atom clicks, drags and outside releases do not', async () => {
  const {bindBlankClick}=require('../src/interaction.js');
  const target=()=>({listeners:{},addEventListener(k,fn){this.listeners[k]=fn;},removeEventListener(k){delete this.listeners[k];}});
  const element=target(),doc=target(),win=target();element.ownerDocument=doc;doc.defaultView=win;
  element.contains=node=>node===element;
  let clears=0;
  const binding=bindBlankClick(element,()=>clears++);
  const event=(x=0,target=element)=>({button:0,clientX:x,clientY:0,target});
  element.listeners.mousedown(event());doc.listeners.mouseup(event());
  await Promise.resolve();assert.equal(clears,1);
  element.listeners.mousedown(event());doc.listeners.mouseup(event());binding.markPicked();
  await Promise.resolve();assert.equal(clears,1);
  element.listeners.mousedown(event());doc.listeners.mousemove(event(20));doc.listeners.mouseup(event());
  await Promise.resolve();assert.equal(clears,1);
  element.listeners.mousedown(event());doc.listeners.mouseup(event(0,{}));
  await Promise.resolve();assert.equal(clears,1);
  element.listeners.mousedown(event());doc.listeners.mouseup(event());win.listeners.blur();
  await Promise.resolve();assert.equal(clears,1);
  binding.destroy();assert.deepEqual(element.listeners,{});assert.deepEqual(doc.listeners,{});
});
