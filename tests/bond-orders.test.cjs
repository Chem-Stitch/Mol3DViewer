const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../src/core.js');
const atom=(elem,x,y=0,z=0)=>({elem,x,y,z});
const infer=atoms=>C.inferBonds(atoms);
const order=(result,a,b)=>result.bonds.find(v=>C.key(v.a,v.b)===C.key(a,b))?.order;

test('distinguishes ordinary single, double, triple, carbonyl and nitrile distances',()=>{
  for(const [a,b,d,n] of [['C','C',1.54,1],['C','C',1.34,2],['C','C',1.20,3],['C','O',1.23,2],['C','N',1.16,3],['C','O',1.43,1]])
    assert.equal(order(infer([atom(a,0),atom(b,d)]),0,1),n);
});

test('explicit hydrogens constrain ethene, acetylene, and formaldehyde',()=>{
  const ethene=[atom('C',-.67),atom('C',.67),atom('H',-1.21,.94),atom('H',-1.21,-.94),atom('H',1.21,.94),atom('H',1.21,-.94)];
  const acetylene=[atom('H',-1.66),atom('C',-.6),atom('C',.6),atom('H',1.66)];
  const formaldehyde=[atom('C',0),atom('O',1.23),atom('H',-.55,.94),atom('H',-.55,-.94)];
  assert.equal(order(infer(ethene),0,1),2);
  assert.equal(order(infer(acetylene),1,2),3);
  assert.equal(order(infer(formaldehyde),0,1),2);
  assert.ok(infer(ethene).bonds.filter(b=>b.a>1||b.b>1).every(b=>b.order===1));
});

test('benzene gets three nonadjacent double bonds with or without explicit H and reordered atoms',()=>{
  const carbons=Array.from({length:6},(_,i)=>atom('C',1.4*Math.cos(i*Math.PI/3),1.4*Math.sin(i*Math.PI/3)));
  const hydrogens=Array.from({length:6},(_,i)=>atom('H',2.48*Math.cos(i*Math.PI/3),2.48*Math.sin(i*Math.PI/3)));
  for(const atoms of [carbons,[...carbons,...hydrogens],[carbons[3],carbons[0],carbons[5],carbons[1],carbons[4],carbons[2],...hydrogens]]){
    const result=infer(atoms),doubles=result.bonds.filter(b=>b.order===2);
    assert.equal(doubles.length,3);
    assert.equal(new Set(doubles.flatMap(b=>[b.a,b.b])).size,6);
    assert.ok(result.bonds.every(b=>b.order<=2));
  }
});

test('valence prevents promoting a short bond on saturated carbon',()=>{
  const atoms=[atom('C',0),atom('C',1.4),atom('H',-.36,1),atom('H',-.36,-.5,.866),atom('H',-.36,-.5,-.866)];
  assert.equal(order(infer(atoms),0,1),1);
});

test('metals and excessive connectivity retain single bonds with warnings',()=>{
  const metal=infer([atom('C',0),atom('O',1.23),atom('Pd',8)]);
  assert.equal(order(metal,0,1),1);assert.ok(metal.warnings.length);
  const crowded=infer([atom('N',0),atom('H',1),atom('H',-1),atom('H',0,1),atom('H',0,-1)]);
  assert.ok(crowded.warnings.length);assert.ok(crowded.bonds.every(b=>b.order===1));
});

test('multiple bond cutoff does not change with connectivity tolerance',()=>{
  const atoms=[atom('C',0),atom('C',1.48)];
  for(const tolerance of [1,1.2,1.6])assert.equal(order(C.inferBonds(atoms,tolerance),0,1),1);
});
