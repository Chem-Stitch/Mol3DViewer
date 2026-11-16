
/* Mol3DViewer — browser-only application. MIT license. */
(function () {
  'use strict';
  const C=window.MoleculeCore,$=id=>document.getElementById(id);
  const state={name:'',frames:[],frameIndex:0,bonds:[],settings:C.clone(C.DEFAULTS),selection:[],history:[]};
  let scene,renderFrame=0,geometryDirty=false,inputTimer=0,validInput=true,graphicsError='',statusTimer=0;
  const atoms=()=>state.frames[state.frameIndex]?.atoms||[];
  function status(message,error=false) {
    clearTimeout(statusTimer);$('status').textContent=message;$('status').classList.toggle('error',error);$('status').hidden=!message;
    if(message&&!error)statusTimer=setTimeout(()=>{$('status').hidden=true;},3000);
  }
  function controlsUI() {
    const ready=validInput&&atoms().length>0;
    for(const id of ['save-session','save-xyz','apply-bond','remove-bond','apply-batch','measure-atoms','auto-bonds','clear-bonds','atom-a','atom-b','measure-indices','frame-slider'])$(id).disabled=!ready;
    $('undo-bonds').disabled=!ready||!state.history.length;
    for(const el of document.querySelectorAll('[data-view]'))el.disabled=!ready||!scene;
    for(const id of ['fit-view','reset-view','open-export'])$(id).disabled=!ready||!scene;
  }
  function safely(fn) {return async function(...args){try{return await fn.apply(this,args);}catch(error){status(error.message||String(error),true);}};}
  function draw(options={}) {
    if(!atoms().length){scene?.clear();$('webgl-error').hidden=true;controlsUI();return;}
    // Leave the initial canvas empty; graphics start only when a structure exists.
    if(!scene&&!graphicsError) {
      try {scene=new window.MoleculeScene($('viewer'),pick,message=>status(message,true));}
      catch(error){graphicsError=error?.message||String(error);$('webgl-detail').textContent=graphicsError;}
    }
    $('webgl-error').hidden=!graphicsError;
    scene?.draw({atoms:atoms(),bonds:state.bonds,settings:state.settings,selected:state.selection},options);controlsUI();
  }
  function scheduleDraw(shadingOnly=false) {
    if(!shadingOnly)geometryDirty=true;
    cancelAnimationFrame(renderFrame);
    renderFrame=requestAnimationFrame(()=>{try{if(geometryDirty)draw();else scene?.updateShading(state.settings);}catch(error){status(error.message,true);}finally{geometryDirty=false;}});
  }
  function download(blob,name) {
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  function filename(name,extension) {return (String(name).replace(/\.[a-z0-9]+$/i,'').replace(/[<>:"/\\|?*\x00-\x1F]/g,'_').trim().slice(0,100)||'molecule')+extension;}
  function showTab(name) {
    document.querySelectorAll('[data-tab]').forEach(el=>{const active=el.dataset.tab===name;el.setAttribute('aria-selected',active);el.tabIndex=active?0:-1;$(`panel-${el.dataset.tab}`).hidden=!active;});
  }
  function updateOutputs() {
    for(const el of document.querySelectorAll('[data-setting]')) {
      const k=el.dataset.setting,v=state.settings[k];
      el.value=v;$(k+'-value').textContent=k==='aoStrength'?v.toFixed(2):(k==='atomScale'||k==='autoScale')?v.toFixed(2)+'×':v.toFixed(k==='aoRadius'?2:3)+' Å';
    }
    $('ambient-occlusion').checked=state.settings.ambientOcclusion;
    for(const k of ['aoStrength','aoRadius'])$(k).disabled=!state.settings.ambientOcclusion;
    const preset=state.settings.ambientOcclusion?Object.entries(C.SHADING_PRESETS).find(([,p])=>Object.keys(p).every(k=>Math.abs(Number(p[k])-Number(state.settings[k]))<1e-8))?.[0]||'custom':'basic';
    $('shading-preset').value=preset;
    document.querySelectorAll('[data-color]').forEach(el=>el.value=state.settings[el.dataset.color]);
    $('orthographic').checked=state.settings.orthographic;
    $('toggle-labels').setAttribute('aria-pressed',state.settings.labels);
    $('index-base').value=state.settings.indexBase;
    $('export-size').value=state.settings.exportSize;$('transparent-export').checked=state.settings.transparent;
  }
  function palette() {
    const host=$('element-colors');host.replaceChildren();
    for(const elem of new Set(atoms().map(a=>a.elem))) {
      const label=document.createElement('label'),input=document.createElement('input'),text=document.createElement('span');
      label.className='element-color';text.textContent=elem;input.type='color';input.value=state.settings.elementColors[elem]||C.COLORS[elem]||'#b59ab7';input.setAttribute('aria-label',`${elem} atom color`);
      input.addEventListener('input',()=>{state.settings.elementColors[elem]=input.value;scheduleDraw();});label.append(input,text);host.append(label);
    }
  }
  function selectionUI() {
    const base=state.settings.indexBase,chosen=state.selection;
    $('selection-card').hidden=chosen.length===0;
    $('selection-text').textContent=chosen.map((i,k)=>`${'ABCD'[k]}: ${atoms()[i].elem}${i+base}`).join(' → ');
    const measurement=chosen.length>=2?C.measure(atoms(),chosen):null;
    $('selection-distance').textContent=measurement?`${measurement.kind}: ${measurement.value===null?'undefined (coincident or collinear atoms)':measurement.value.toFixed(chosen.length===2?3:2)+' '+measurement.unit}`:'Select another atom to measure a distance.';
    $('selection-note').textContent=chosen.length===4?'A–B–C–D · signed angle (−180° to +180°). Click a fifth atom to start again.':chosen.length===3?'A–B–C · angle at B. Select a fourth atom for a dihedral.':'Select 3 atoms for an angle, or 4 for a dihedral.';
    $('measure-indices').value=chosen.map(i=>i+base).join(', ');
    $('edit-selected').hidden=chosen.length!==2;
    if(chosen.length===1||chosen.length===2)$('atom-a').value=chosen[0]+base;else $('atom-a').value='';
    if(chosen.length===2) {
      $('atom-b').value=chosen[1]+base;
      const bond=state.bonds.find(b=>C.key(b.a,b.b)===C.key(...chosen));
      $('bond-type').value=bond?(bond.dashed?'d':String(bond.order)):'1';
    }else $('atom-b').value='';
    for(const id of ['atom-a','atom-b']) {$(id).min=base;$(id).max=Math.max(base,atoms().length-1+base);}
  }
  function pick(index) {
    state.selection=C.selectAtom(state.selection,index);
    selectionUI();scene?.setSelection(state.selection);
  }
  function clearSelection() {
    state.selection=[];selectionUI();scene?.setSelection([]);
    status('Atom selection and measurement cleared.');
  }
  function bondsUI() {
    const host=$('bond-list');host.replaceChildren();
    if(atoms().length&&!state.bonds.length){const p=document.createElement('p');p.className='hint';p.textContent='No bonds';host.append(p);}
    // Large structures remain usable without creating thousands of sidebar controls.
    for(const b of state.bonds.slice(0,250)) {
      const row=document.createElement('button');row.type='button';row.className='bond-row';
      const pair=document.createElement('span'),kind=document.createElement('span');
      pair.textContent=`${atoms()[b.a].elem}${b.a+state.settings.indexBase} — ${atoms()[b.b].elem}${b.b+state.settings.indexBase}`;
      kind.textContent=b.dashed?'Dashed':['','Single','Double','Triple'][b.order];kind.className=b.dashed?'bond-kind dashed':'bond-kind';row.append(pair,kind);
      row.addEventListener('click',()=>{state.selection=[b.a,b.b];selectionUI();scene?.setSelection(state.selection);});host.append(row);
    }
    if(state.bonds.length>250){const note=document.createElement('p');note.className='hint';note.textContent='Showing the first 250 bonds. Any pair can still be edited by index.';host.append(note);}
    controlsUI();
  }
  function structureUI(syncInput=true) {
    if(syncInput){$('coordinates').value=state.frames.map(C.toXYZ).join('');$('units').value='angstrom';}
    $('trajectory-controls').hidden=state.frames.length<2;
    $('frame-slider').max=Math.max(0,state.frames.length-1);$('frame-slider').value=state.frameIndex;
    $('frame-value').textContent=`${state.frameIndex+1} / ${state.frames.length}`;
    selectionUI();bondsUI();palette();updateOutputs();
  }
  function inputError(message='') {
    $('coordinate-error').textContent=message;$('coordinate-error').hidden=!message;
    $('coordinates').setAttribute('aria-invalid',Boolean(message));
  }
  function cancelCoordinateUpdate() {clearTimeout(inputTimer);inputTimer=0;validInput=true;inputError();}
  function clearStructure() {
    cancelCoordinateUpdate();Object.assign(state,{name:'',frames:[],frameIndex:0,bonds:[],selection:[],history:[]});
    $('bond-spec').value='';clearDemoMarker();structureUI(false);draw();status('');
  }
  function applyLiveCoordinates() {
    clearTimeout(inputTimer);inputTimer=0;
    const text=$('coordinates').value;
    if(!text.trim()){clearStructure();return;}
    try {
      const frames=C.parseXYZ(text,$('units').value),next=frames[0].atoms;
      const sameOrder=next.length===atoms().length&&next.every((a,i)=>a.elem===atoms()[i].elem);
      const inferred=sameOrder?null:C.inferBonds(next,state.settings.autoScale);
      if(!sameOrder){state.bonds=inferred.bonds;state.selection=[];state.history=[];state.name='molecule';}
      state.frames=frames;state.frameIndex=Math.min(state.frameIndex,frames.length-1);
      validInput=true;inputError();clearDemoMarker();structureUI(false);draw({fit:!sameOrder});status(inferred?.warnings.join(' ')||'');
    } catch(error) {
      validInput=false;inputError(`${error.message}${atoms().length?' Showing the last valid structure.':''}`);controlsUI();
    }
  }
  function queueCoordinates(event) {
    clearTimeout(inputTimer);validInput=false;controlsUI();
    if(event?.isComposing)return;
    if(!$('coordinates').value.trim()||event?.inputType==='insertFromPaste')applyLiveCoordinates();
    else inputTimer=setTimeout(applyLiveCoordinates,180);
  }
  function loadStructure(name,frames,bonds,view=null) {
    cancelCoordinateUpdate();
    state.name=name;state.frames=frames;state.frameIndex=0;state.bonds=bonds;state.selection=[];state.history=[];
    structureUI();draw({fit:true,view});
  }
  function loadExample(name) {
    const demo=C.DEMOS[name],frames=C.parseXYZ(demo.text);
    loadStructure(demo.name,frames,C.parseBondText(demo.bondText,frames[0].atoms));
    document.querySelectorAll('[data-example]').forEach(el=>el.classList.toggle('active',el.dataset.example===name));
    status('');
  }
  function clearDemoMarker(){document.querySelectorAll('[data-example]').forEach(el=>el.classList.remove('active'));}
  function importCoordinates(text,name,units) {
    const frames=C.parseXYZ(text,units),auto=C.inferBonds(frames[0].atoms,state.settings.autoScale);
    loadStructure(name,frames,auto.bonds);clearDemoMarker();
    status(auto.warnings.join(' ')||'');
  }
  async function openFile(file) {
    if(!file)return;
    if(file.size>20*1024*1024)throw new Error('Use a file smaller than 20 MB.');
    const text=await file.text();
    if(file.name.toLowerCase().endsWith('.json')||text.trimStart().startsWith('{')) {
      let data;try{data=JSON.parse(text);}catch{throw new Error('The session file is not valid JSON.');}
      const session=C.validateSession(data);cancelCoordinateUpdate();Object.assign(state,session,{selection:[],history:[]});
      structureUI();draw({fit:true,view:session.view});clearDemoMarker();status('Session restored, including bonds, colors, and camera view.');
    } else importCoordinates(text,file.name.replace(/\.[^.]+$/,''),'angstrom');
  }
  function changeBonds(next,message) {
    state.history.push(C.clone(state.bonds));if(state.history.length>30)state.history.shift();
    state.bonds=next;draw();bondsUI();selectionUI();status(message);
  }
  function enteredPair() {
    if(!$('atom-a').value.trim()||!$('atom-b').value.trim())throw new Error('Choose two atoms or enter both indices.');
    return {a:Number($('atom-a').value)-state.settings.indexBase,b:Number($('atom-b').value)-state.settings.indexBase};
  }
  function exportDimensions(){const d=scene?.dimensions(Number($('export-size').value));if(d)$('export-dimensions').textContent=`${d.width} × ${d.height} px · keeps the canvas aspect ratio`;}

  document.querySelectorAll('[data-tab]').forEach(el=>{
    el.addEventListener('click',()=>showTab(el.dataset.tab));
    el.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const list=[...document.querySelectorAll('[data-tab]')],index=(list.indexOf(el)+(event.key==='ArrowRight'?1:2))%3;showTab(list[index].dataset.tab);list[index].focus();});
  });
  document.querySelectorAll('[data-example]').forEach(el=>el.addEventListener('click',safely(()=>loadExample(el.dataset.example))));
  document.querySelectorAll('[data-setting]').forEach(el=>el.addEventListener('input',()=>{const k=el.dataset.setting;state.settings[k]=Number(el.value);updateOutputs();if(k!=='autoScale')scheduleDraw(k==='aoStrength'||k==='aoRadius');}));
  $('ambient-occlusion').addEventListener('change',()=>{state.settings.ambientOcclusion=$('ambient-occlusion').checked;updateOutputs();scheduleDraw(true);});
  $('shading-preset').addEventListener('change',()=>{
    const preset=C.SHADING_PRESETS[$('shading-preset').value];if(!preset)return;
    Object.assign(state.settings,preset);updateOutputs();scheduleDraw(true);status('Surface shading updated.');
  });
  document.querySelectorAll('[data-color]').forEach(el=>{
    const update=()=>{state.settings[el.dataset.color]=el.value;scheduleDraw();};
    el.addEventListener('input',update);el.addEventListener('change',update);
  });
  $('orthographic').addEventListener('change',()=>{state.settings.orthographic=$('orthographic').checked;updateOutputs();draw();});
  $('toggle-labels').addEventListener('click',()=>{state.settings.labels=!state.settings.labels;updateOutputs();scene?.setSelection(state.selection);});
  $('reset-style').addEventListener('click',()=>{const {indexBase,autoScale,exportSize,transparent}=state.settings;state.settings={...C.clone(C.DEFAULTS),indexBase,autoScale,exportSize,transparent};updateOutputs();palette();draw();status('Figure style reset.');});
  $('index-base').addEventListener('change',()=>{state.settings.indexBase=Number($('index-base').value);selectionUI();bondsUI();scene?.setSelection(state.selection);$('bond-spec').value='';status(`Atom numbering now starts at ${state.settings.indexBase}.`);});
  $('coordinates').addEventListener('input',queueCoordinates);
  $('coordinates').addEventListener('compositionend',queueCoordinates);
  $('units').addEventListener('change',applyLiveCoordinates);
  $('open-file').addEventListener('click',()=>$('file-input').click());
  $('file-input').addEventListener('change',safely(async()=>{const file=$('file-input').files[0];$('file-input').value='';await openFile(file);}));
  $('frame-slider').addEventListener('input',safely(()=>{state.frameIndex=Number($('frame-slider').value);$('frame-value').textContent=`${state.frameIndex+1} / ${state.frames.length}`;selectionUI();draw();status(`Frame ${state.frameIndex+1}: ${state.frames[state.frameIndex].comment||'trajectory'} · fixed bonds`);}));
  $('clear-selection').addEventListener('click',clearSelection);
  window.MoleculeInteraction.bindSelectionReset($('viewer'),clearSelection);
  $('edit-selected').addEventListener('click',()=>showTab('bonds'));
  $('measure-atoms').addEventListener('click',safely(()=>{state.selection=C.parseSelection($('measure-indices').value,atoms(),state.settings.indexBase);selectionUI();scene?.setSelection(state.selection);status($('selection-distance').textContent);}));
  $('apply-bond').addEventListener('click',safely(()=>{const pair=enteredPair(),type=$('bond-type').value;const bond=C.validateBond({...pair,order:type==='d'?1:Number(type),dashed:type==='d'},atoms());state.selection=[bond.a,bond.b];changeBonds(C.mergeBonds(state.bonds,[bond],atoms()),'Bond updated. Coordinates are unchanged.');}));
  $('remove-bond').addEventListener('click',safely(()=>{const pair=C.validateBond(enteredPair(),atoms()),k=C.key(pair.a,pair.b),next=state.bonds.filter(b=>C.key(b.a,b.b)!==k);if(next.length===state.bonds.length)throw new Error('There is no bond between those atoms.');state.selection=[pair.a,pair.b];changeBonds(next,'Bond removed.');}));
  $('apply-batch').addEventListener('click',safely(()=>{const add=C.parseBondText($('bond-spec').value,atoms(),state.settings.indexBase);if(!add.length)throw new Error('Enter at least one bond.');changeBonds(C.mergeBonds(state.bonds,add,atoms()),`${add.length} bond definitions applied.`);}));
  $('undo-bonds').addEventListener('click',()=>{if(!state.history.length)return;state.bonds=state.history.pop();draw();bondsUI();selectionUI();status('Bond edit undone.');});
  $('clear-bonds').addEventListener('click',()=>changeBonds([],'Bonds cleared. Use Undo edit to restore them.'));
  $('auto-bonds').addEventListener('click',safely(()=>{const result=C.inferBonds(atoms(),state.settings.autoScale);changeBonds(result.bonds,result.warnings.join(' ')||'Distance-based single bonds generated. Review TS and coordination bonds.');}));
  $('fit-view').addEventListener('click',()=>scene?.fit());$('reset-view').addEventListener('click',()=>scene?.reset());
  document.querySelectorAll('[data-view]').forEach(el=>el.addEventListener('click',()=>scene?.preset(el.dataset.view)));
  document.addEventListener('keydown',event=>{if(event.key.toLowerCase()==='f'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)&&!$('export-dialog').open){event.preventDefault();scene?.fit();}});
  $('save-session').addEventListener('click',safely(()=>{const data=C.validateSession({format:'molecule-studio-session-v1',name:state.name,frames:state.frames,frameIndex:state.frameIndex,bonds:state.bonds,settings:state.settings,view:scene?.getView()||null});download(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),filename(state.name,'.json'));status('Session saved. Open the JSON file to restore this view.');}));
  $('save-xyz').addEventListener('click',()=>{download(new Blob([state.frames.map(C.toXYZ).join('')],{type:'text/plain'}),filename(state.name,'.xyz'));status(`XYZ saved in ångström (${state.frames.length} frame${state.frames.length>1?'s':''}).`);});
  $('open-export').addEventListener('click',()=>{if(!scene)return;$('export-name').value=filename(state.name,'.png');$('export-status').textContent='';exportDimensions();$('export-dialog').showModal();});
  $('export-size').addEventListener('change',()=>{state.settings.exportSize=Number($('export-size').value);exportDimensions();});
  $('transparent-export').addEventListener('change',()=>state.settings.transparent=$('transparent-export').checked);
  $('download-png').addEventListener('click',async()=>{
    const button=$('download-png');button.disabled=true;button.textContent='Rendering…';$('export-status').textContent='Preparing a full-resolution image…';
    try {await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const result=await scene.exportPNG(Number($('export-size').value),$('transparent-export').checked);download(result.blob,filename($('export-name').value,'.png'));$('export-status').textContent=`Saved ${result.width} × ${result.height} px PNG.`;status('PNG exported.');}
    catch(error){$('export-status').textContent=error.message;status(error.message,true);}
    finally{button.disabled=false;button.textContent='Download PNG';}
  });
  let dragDepth=0;
  document.addEventListener('dragenter',event=>{if(event.dataTransfer?.types.includes('Files')){event.preventDefault();dragDepth++;$('drop-overlay').hidden=false;}});
  document.addEventListener('dragover',event=>{if(event.dataTransfer?.types.includes('Files'))event.preventDefault();});
  document.addEventListener('dragleave',()=>{dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)$('drop-overlay').hidden=true;});
  document.addEventListener('drop',safely(async event=>{event.preventDefault();dragDepth=0;$('drop-overlay').hidden=true;if(event.dataTransfer.files.length>1)throw new Error('Open one file at a time. Multi-frame XYZ files are supported.');await openFile(event.dataTransfer.files[0]);}));
  structureUI();showTab('structure');status('');
})();

