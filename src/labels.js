
/* Crisp atom labels: native Canvas text, never an enlarged WebGL texture. MIT. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MoleculeLabels=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function entries(viewer,data) {
    const {atoms,settings,selected=[]}=data;
    const indices=settings.labels?atoms.map((_,i)=>i):selected;
    if(!indices.length)return [];
    const canvas=viewer.getCanvas(),rect=canvas.getBoundingClientRect();
    const doc=canvas.ownerDocument,win=doc.defaultView;
    // 3Dmol modelToScreen returns document coordinates, including scroll offsets.
    const left=rect.left+win.pageXOffset-doc.documentElement.clientLeft;
    const top=rect.top+win.pageYOffset-doc.documentElement.clientTop;
    const projected=viewer.modelToScreen(indices.map(i=>atoms[i]));
    return indices.map((i,k)=>{
      const order=selected.indexOf(i),active=order!==-1;
      return {text:`${active?`${order+1} · `:''}${atoms[i].elem}${i+settings.indexBase}`,x:projected[k].x-left,y:projected[k].y-top,active};
    }).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
  }
  function paint(context,items,{positionScale=1,fontScale=1}={}) {
    context.save();
    const fontSize=14*fontScale,padX=5*fontScale,padY=3*fontScale,height=fontSize+2*padY;
    context.font=`600 ${fontSize}px Arial, sans-serif`;
    context.textBaseline='middle';context.textAlign='left';
    for(const item of items) {
      const x=item.x*positionScale+8*fontScale,y=item.y*positionScale-8*fontScale-height;
      const width=context.measureText(item.text).width+2*padX;
      context.fillStyle=item.active?'rgba(19,125,120,0.97)':'rgba(255,255,255,0.92)';
      context.beginPath();context.roundRect(x,y,width,height,4*fontScale);context.fill();
      context.fillStyle=item.active?'#ffffff':'#243941';
      context.fillText(item.text,x+padX,y+height/2+.5*fontScale);
    }
    context.restore();
  }
  function overlay(canvas,viewer,data,width,height,dpr=1) {
    const w=Math.max(1,Math.round(width*dpr)),h=Math.max(1,Math.round(height*dpr));
    if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;
    const context=canvas.getContext('2d');
    context.setTransform(1,0,0,1,0,0);context.clearRect(0,0,w,h);
    context.setTransform(dpr,0,0,dpr,0,0);
    paint(context,entries(viewer,data));
  }
  return {entries,paint,overlay};
});

