
/* Mouse gestures shared by the standalone and hosted editor. MIT license. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MoleculeInteraction=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function bindSelectionReset(element,onReset) {
    const doc=element.ownerDocument,win=doc.defaultView;
    let press=null;
    const cancel=()=>{press=null;};
    const down=event=>{if(event.button===2)press={x:event.clientX,y:event.clientY,moved:false};};
    const move=event=>{if(press&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>6)press.moved=true;};
    const up=event=>{
      if(event.button!==2||!press)return;
      move(event);const clicked=!press.moved&&element.contains(event.target);cancel();
      if(clicked)onReset();
    };
    const menu=event=>event.preventDefault();
    // Observe events without preventing the renderer's right-drag panning.
    element.addEventListener('mousedown',down,true);
    doc.addEventListener('mousemove',move,true);doc.addEventListener('mouseup',up,true);
    element.addEventListener('contextmenu',menu);win.addEventListener('blur',cancel);
    return ()=>{
      element.removeEventListener('mousedown',down,true);
      doc.removeEventListener('mousemove',move,true);doc.removeEventListener('mouseup',up,true);
      element.removeEventListener('contextmenu',menu);win.removeEventListener('blur',cancel);cancel();
    };
  }
  return {bindSelectionReset};
});

