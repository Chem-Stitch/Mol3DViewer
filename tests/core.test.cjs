const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/core.js');
const water = () => C.parseXYZ(C.DEMOS.water.text)[0];

test('XYZ parsing supports rows, Bohr, D exponents, and XYZ round trips', () => {
  const [frame] = C.parseXYZ('H 1D0 0 0', 'bohr');
  assert.equal(frame.atoms[0].x, .529177210903);
  assert.deepEqual(C.parseXYZ(C.toXYZ(water()))[0], water());
  assert.throws(() => C.parseXYZ('Xx 0 0 0'), /unknown element/);
  assert.throws(() => C.parseXYZ('H NaN 0 0'), /invalid number/);
  assert.throws(() => C.parseXYZ('2\nmissing atom\nH 0 0 0'), /Incomplete/);
});

test('trajectories require consistent atom ordering', () => {
  assert.equal(C.parseXYZ(C.DEMOS.water.text + '\n' + C.DEMOS.water.text).length, 2);
  assert.throws(() => C.parseXYZ('1\na\nH 0 0 0\n1\nb\nO 0 0 0'), /element order/);
});

test('geometry measurements handle right angles and degenerate coordinates', () => {
  const atoms = [{x:1,y:0,z:0},{x:0,y:0,z:0},{x:0,y:1,z:0},{x:0,y:1,z:1}];
  assert.equal(C.measure(atoms, [0,1]).value, 1);
  assert.equal(C.measure(atoms, [0,1,2]).value, 90);
  assert.equal(C.measure(atoms, [0,1,2,3]).value, -90);
  assert.equal(C.angle(atoms[0], atoms[0], atoms[1]), null);
  assert.throws(() => C.measure(atoms, [0,0]), /different/);
});

test('automatic and explicit bonds preserve intended connectivity', () => {
  const atoms = water().atoms;
  assert.equal(C.inferBonds(atoms).bonds.length, 2);
  const bonds = C.parseBondText('1-2:2,1-3:d', atoms, 1);
  assert.equal(bonds[0].order, 2);
  assert.equal(bonds[1].dashed, true);
  const merged = C.mergeBonds(bonds, [{a:1,b:0,order:3}], atoms);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].order, 3);
  assert.throws(() => C.parseBondText('0-9', atoms), /indices/);
});

test('sessions restore settings and reject invalid data', () => {
  const input = {format:'molecule-studio-session-v1',frames:[water()],bonds:[],settings:C.clone(C.DEFAULTS),view:[0,0,0,0,0,0,0,2]};
  const session = C.validateSession(input);
  assert.deepEqual(session.settings, input.settings);
  assert.equal(session.view[7], 1);
  assert.deepEqual(C.validateSession(JSON.parse(JSON.stringify(session))), session);
  assert.throws(() => C.validateSession({...input,frameIndex:2}), /frame/);
  assert.throws(() => C.validateSession({...input,settings:{atomScale:-1}}), /atomScale/);
});
