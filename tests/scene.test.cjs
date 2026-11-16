const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} ≈ ${expected}`);

test('zoom limits track fitted molecular size and reset previous limits before fitting',()=>{
  const window={MoleculeCore:{},MoleculeLabels:{}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/scene.js'),'utf8'),{window});
  const scene=Object.create(window.MoleculeScene.prototype);
  let distance=0,fitDistance=57.2,lower=0,upper=Infinity;
  const clamp=()=>distance=Math.max(lower,Math.min(upper,distance));
  scene.viewer={
    setZoomLimits(lo,hi){lower=lo;upper=hi;clamp();},
    zoomTo(){close(lower,0);assert.equal(upper,Infinity);distance=fitDistance;},
    zoom(factor){distance/=factor;clamp();},
    getView(){return [0,0,0,150-distance,0,0,0,1];},
    render(){}
  };
  scene.data={};scene.fit();
  close(distance,40);close(lower,10);close(upper,160);
  scene.viewer.zoom(1e6);close(distance,10);
  scene.viewer.zoom(1e-6);close(distance,160);
  scene.fit();close(distance,40);
  fitDistance=572;scene.fit();
  close(distance,400);close(lower,100);close(upper,1600);
});
