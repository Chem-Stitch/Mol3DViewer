
/* Mol3DViewer — WebGL scene and image export. MIT license. */
(function () {
  'use strict';
  const C = window.MoleculeCore;
  const L = window.MoleculeLabels;
  const FIT_ZOOM = 1.43;
  // 3Dmol 2.5.5's default camera Z; limits are camera-to-model distances.
  const CAMERA_Z = 150;
  const MIN_ZOOM = .25, MAX_ZOOM = 4;
  function shading(viewer,s) {
    // Pinned 3Dmol 2.5.5's renderer reads `scale` in enableAmbientOcclusion,
    // although GLViewer.setViewStyle forwards `radius`. Pass both through the
    // public config API so the radius slider really updates the AO kernel.
    viewer.setConfig({...viewer.getConfig(),ambientOcclusion:s.ambientOcclusion?{strength:s.aoStrength,radius:s.aoRadius,scale:s.aoRadius}:null});
    viewer.setViewStyle({style:s.ambientOcclusion?'ambientOcclusion':'none',strength:s.aoStrength,radius:s.aoRadius});
  }
  const radius = (a,s) => (C.RADII[a.elem] || .30) * s.atomScale;
  const add = (a,b,k=1) => ({x:a.x+b.x*k,y:a.y+b.y*k,z:a.z+b.z*k});
  function cylinder(shape,start,end,r,color) {
    if (C.distance(start,end)<.0001) return;
    shape.addCylinder({start,end,radius:r,color,fromCap:2,toCap:2});
  }
  function perpendicular(u) {
    const v = Math.abs(u.z)<.8 ? {x:0,y:0,z:1} : {x:0,y:1,z:0};
    const p={x:u.y*v.z-u.z*v.y,y:u.z*v.x-u.x*v.z,z:u.x*v.y-u.y*v.x};
    const n=Math.hypot(p.x,p.y,p.z);
    return {x:p.x/n,y:p.y/n,z:p.z/n};
  }
  function populate(viewer,data,onPick) {
    const {atoms,bonds,settings:s}=data;
    viewer.clear();
    shading(viewer,s);
    viewer.setProjection(s.orthographic?'orthographic':'perspective');
    const model=viewer.addModel();
    model.addAtoms(atoms.map((a,i)=>({...a,index:i,serial:i+1,bonds:[],bondOrder:[]})));
    for(const elem of new Set(atoms.map(a=>a.elem))) model.setStyle({elem},{sphere:{radius:radius({elem},s),color:s.elementColors[elem]||C.COLORS[elem]||'#b59ab7'}});
    if(onPick)model.setClickable({},true,(atom,_viewer,event)=>{
      // 3Dmol also dispatches atom picks on right mouseup; reserve that for reset.
      if(event?.button===2||event?.which===3)return;
      onPick(atom.index);
    });
    // GLShape assigns black when shape.color is omitted, then overwrites every
    // cylinder's vertex colors at render time. Explicit groups avoid that override.
    const shapes={solid:viewer.addShape({color:s.bondColor}),dashed:viewer.addShape({color:s.dashColor})};
    for(const b of bonds) {
      const a=atoms[b.a],z=atoms[b.b],length=C.distance(a,z);
      if(length<.001)continue;
      const u={x:(z.x-a.x)/length,y:(z.y-a.y)/length,z:(z.z-a.z)/length};
      if(b.dashed) {
        // Trim to visible atom surfaces and distribute finite dashes symmetrically.
        const start=radius(a,s)*.86,end=length-radius(z,s)*.86,span=end-start;
        if(span<=0)continue;
        const count=Math.max(1,Math.ceil((span+s.dashGap)/(s.dashLength+s.dashGap)));
        const gap=Math.min(s.dashGap,span/(2*count));
        const dash=(span-gap*(count-1))/count;
        for(let j=0;j<count;j++) {
          const from=start+j*(dash+gap),to=Math.min(end,from+dash);
          cylinder(shapes.dashed,add(a,u,from),add(a,u,to),s.dashRadius,s.dashColor);
        }
      } else {
        // Stable geometric offset; no camera-dependent rebuilding while rotating.
        const p=perpendicular(u),step=2.5*s.bondRadius+.025;
        for(let j=0;j<b.order;j++) {
          const offset=(j-(b.order-1)/2)*step;
          cylinder(shapes.solid,add(a,p,offset),add(z,p,offset),s.bondRadius,s.bondColor);
        }
      }
    }
  }
  class MoleculeScene {
    constructor(element,onPick,onError) {
      if(!window.$3Dmol)throw new Error('The bundled 3Dmol library did not load.');
      this.element=element;
      this.viewer=$3Dmol.createViewer(element,{orthographic:true,antialias:true,backgroundColor:'#ffffff',upscale:false});
      if(!this.viewer?.getCanvas())throw new Error('No WebGL canvas was created.');
      this.onPick=onPick;this.onError=onError;this.initialView=null;this.data=null;
      this.labelCanvas=document.createElement('canvas');this.labelCanvas.className='atom-label-overlay';
      this.labelCanvas.setAttribute('aria-hidden','true');element.append(this.labelCanvas);
      this.viewer.setViewChangeCallback(()=>this.refreshLabels());
      let frame=0;
      this.observer=new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{this.viewer.resize();this.refreshLabels();});});
      this.observer.observe(element);
      this.viewer.getCanvas().addEventListener('webglcontextlost',event=>{
        event.preventDefault();onError?.('The graphics context was interrupted. Save your session, then reload the page.');
      });
    }
    draw(data,{fit=false,view=null}={}) {
      const saved=view||(!fit&&this.data?this.viewer.getView():null);
      this.data=data;
      populate(this.viewer,data,this.onPick);
      this.viewer.setBackgroundColor(data.settings.background,1);
      this.fitZoom();
      if(saved){this.viewer.setView(saved);this.viewer.setZoomLimits(...this.zoomLimits);}
      if(fit||!this.initialView)this.initialView=this.viewer.getView().slice();
      this.viewer.render();
      this.refreshLabels();
    }
    refreshLabels() {if(this.data)L.overlay(this.labelCanvas,this.viewer,this.data,this.element.clientWidth,this.element.clientHeight,window.devicePixelRatio||1);}
    clear() {
      this.viewer.clear();this.viewer.render();this.data=null;this.initialView=null;
      this.labelCanvas.width=this.labelCanvas.width;
    }
    updateShading(settings) {
      if(!this.data)return;
      this.data.settings=settings;shading(this.viewer,settings);this.viewer.render();
    }
    setSelection(selected) {if(this.data){this.data.selected=selected;this.refreshLabels();}}
    fitZoom() {
      // Remove old bounds before measuring a new structure's fitted view.
      this.viewer.setZoomLimits(0,Infinity);
      this.viewer.zoomTo();this.viewer.zoom(FIT_ZOOM);
      const distance=Math.max(1,CAMERA_Z-this.viewer.getView()[3]);
      this.zoomLimits=[Math.max(1,distance/MAX_ZOOM),distance/MIN_ZOOM];
      this.viewer.setZoomLimits(...this.zoomLimits);
    }
    fit() {if(!this.data)return;this.fitZoom();this.viewer.render();}
    reset() {if(this.initialView)this.viewer.setView(this.initialView.slice());this.viewer.render();}
    preset(name) {
      if(!this.data)return;
      const q={front:[0,0,0,1],top:[Math.SQRT1_2,0,0,Math.SQRT1_2],side:[0,Math.SQRT1_2,0,Math.SQRT1_2]}[name];
      const view=this.viewer.getView();view.splice(4,4,...q);this.viewer.setView(view);this.viewer.render();
    }
    getView() {return this.viewer.getView().slice();}
    dimensions(longEdge) {
      const w=this.element.clientWidth,h=this.element.clientHeight,ratio=w/h;
      return ratio>=1?{width:longEdge,height:Math.max(1,Math.round(longEdge/ratio))}:{width:Math.max(1,Math.round(longEdge*ratio)),height:longEdge};
    }
    async exportPNG(longEdge,transparent) {
      if(!this.data)throw new Error('Enter coordinates before exporting.');
      const {width,height}=this.dimensions(longEdge);
      if(!this.exportViewer) {
        this.exportHost=document.createElement('div');
        Object.assign(this.exportHost.style,{position:'fixed',left:'-20000px',top:'0',width:'1px',height:'1px',pointerEvents:'none'});
        this.exportHost.setAttribute('aria-hidden','true');document.body.append(this.exportHost);
        this.exportViewer=$3Dmol.createViewer(this.exportHost,{nomouse:true,antialias:true,upscale:false});
      }
      const viewer=this.exportViewer,dpr=window.devicePixelRatio||1;
      try {
        this.exportHost.style.width=`${width/dpr}px`;this.exportHost.style.height=`${height/dpr}px`;
        viewer.setWidth(width/dpr);viewer.setHeight(height/dpr);
        populate(viewer,{...this.data,selected:[]});
        viewer.setBackgroundColor(this.data.settings.background,transparent?0:1);
        const slab=this.viewer.getSlab();viewer.setSlab(slab.near,slab.far);
        viewer.setView(this.getView());viewer.render();
        const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
        const context=canvas.getContext('2d');
        context.drawImage(viewer.getCanvas(),0,0,width,height);
        // Draw text directly at final PNG resolution, preserving its visual size.
        if(this.data.settings.labels)L.paint(context,L.entries(viewer,{...this.data,selected:[]}),{positionScale:dpr,fontScale:width/this.element.clientWidth});
        const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG encoding failed.')),'image/png'));
        return {blob,width,height};
      } finally {
        viewer.clear();viewer.setWidth(1);viewer.setHeight(1);
        this.exportHost.style.width='1px';this.exportHost.style.height='1px';
      }
    }
  }
  window.MoleculeScene=MoleculeScene;
})();

