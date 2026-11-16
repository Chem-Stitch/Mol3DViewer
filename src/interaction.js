
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
  function bindBlankClick(element,onReset) {
    const doc=element.ownerDocument,win=doc.defaultView;
    let press=null;
    const cancel=()=>{press=null;};
    const down=event=>{if(event.button===0)press={x:event.clientX,y:event.clientY,moved:false,picked:false};};
    const move=event=>{if(press&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>6)press.moved=true;};
    const up=event=>{
      if(event.button!==0||!press)return;
      move(event);
      const gesture=press,inside=element.contains(event.target);
      // The renderer picks atoms synchronously during mouseup. Wait until its
      // handlers have completed before deciding that this was a blank click.
      queueMicrotask(()=>{
        if(press!==gesture)return;
        cancel();
        if(inside&&!gesture.moved&&!gesture.picked)onReset();
      });
    };
    element.addEventListener('mousedown',down,true);
    doc.addEventListener('mousemove',move,true);doc.addEventListener('mouseup',up,true);
    win.addEventListener('blur',cancel);
    return {
      markPicked(){if(press)press.picked=true;},
      destroy(){
        element.removeEventListener('mousedown',down,true);
        doc.removeEventListener('mousemove',move,true);doc.removeEventListener('mouseup',up,true);
        win.removeEventListener('blur',cancel);cancel();
      }
    };
  }
  function bindViewerFocus(element,focusTarget) {
    // Capture runs before the renderer cancels pointer defaults during rotation.
    const focus=()=>focusTarget.focus({preventScroll:true});
    element.addEventListener('pointerdown',focus,true);
    return ()=>element.removeEventListener('pointerdown',focus,true);
  }
  function bindEscapeFocus(input,focusTarget) {
    const escape=event=>{
      if(event.key!=='Escape'&&event.code!=='Escape')return;
      event.preventDefault();event.stopPropagation();
      focusTarget.focus({preventScroll:true});
    };
    input.addEventListener('keydown',escape);
    return ()=>input.removeEventListener('keydown',escape);
  }
  function shortcutKey(event,dialogOpen=false) {
    if(dialogOpen||event.defaultPrevented||event.repeat||event.ctrlKey||event.metaKey||event.altKey)return null;
    const target=event.target;
    if(target?.isContentEditable||target?.closest?.('input, textarea, select, [role="textbox"]'))return null;
    // Physical keys remain stable when a Korean IME reports Hangul or Process.
    // Editable targets were excluded above, so this never consumes text input.
    const physical={KeyB:'b',KeyD:'d',KeyF:'f',KeyN:'n',Digit1:'1',Digit2:'2',Digit3:'3',Numpad1:'1',Numpad2:'2',Numpad3:'3'}[event.code];
    if(physical)return physical;
    if(event.isComposing)return null;
    const raw=(event.key||'').toLowerCase();
    const key=({'ㅠ':'b','ㅇ':'d','ㄹ':'f','ㅜ':'n'})[raw]||raw;
    return ['f','b','d','n','1','2','3'].includes(key)?key:null;
  }
  // null means remove the selected bond; numeric keys always set a solid bond.
  function bondShortcut(key,current) {
    if(key==='d')return current?.dashed?null:{order:1,dashed:true};
    if(key==='b')return current&&!current.dashed
      ?(current.order===3?null:{order:current.order+1,dashed:false})
      :{order:1,dashed:false};
    if(['1','2','3'].includes(key))return {order:Number(key),dashed:false};
    throw new Error('Unknown bond shortcut.');
  }
  return {bindSelectionReset,bindBlankClick,bindViewerFocus,bindEscapeFocus,shortcutKey,bondShortcut};
});

