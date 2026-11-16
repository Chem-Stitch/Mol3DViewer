const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');

test('zoom limits track fitted molecular size and reset previous limits before fitting',()=>{
  const window={MoleculeCore:{},MoleculeLabels:{}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/scene.js'),'utf8'),{window});
  const scene=Object.create(window.MoleculeScene.prototype);
  let distance=0,fitDistance=52,lower=0,upper=Infinity;
  const clamp=()=>distance=Math.max(lower,Math.min(upper,distance));
  scene.viewer={
    setZoomLimits(lo,hi){lower=lo;upper=hi;clamp();},
    zoomTo(){assert.equal(lower,0);assert.equal(upper,Infinity);distance=fitDistance;},
    zoom(factor){distance/=factor;clamp();},
    getView(){return [0,0,0,150-distance,0,0,0,1];},
    render(){}
  };
  scene.data={};scene.fit();
  assert.equal(distance,40);assert.equal(lower,10);assert.equal(upper,160);
  scene.viewer.zoom(1e6);assert.equal(distance,10);
  scene.viewer.zoom(1e-6);assert.equal(distance,160);
  scene.fit();assert.equal(distance,40);
  fitDistance=520;scene.fit();
  assert.equal(distance,400);assert.equal(lower,100);assert.equal(upper,1600);
});
