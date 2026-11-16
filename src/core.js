
/* Mol3DViewer — data parsing and molecular drawing intent. MIT license. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MoleculeCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SYMBOLS = 'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(' ');
  const ELEMENTS = new Set(SYMBOLS);
  const COVALENT = Object.fromEntries('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba W Re Os Ir Pt Au Hg Pb Bi'.split(' ').map((s,i)=>[s,[.31,.28,1.28,.96,.84,.76,.71,.66,.57,.58,1.66,1.41,1.21,1.11,1.07,1.05,1.02,1.06,2.03,1.76,1.70,1.60,1.53,1.39,1.39,1.32,1.26,1.24,1.32,1.22,1.22,1.20,1.19,1.20,1.20,1.16,2.20,1.95,1.90,1.75,1.64,1.54,1.46,1.42,1.39,1.45,1.44,1.42,1.39,1.39,1.38,1.39,1.40,2.44,2.15,1.62,1.51,1.44,1.41,1.36,1.36,1.32,1.46,1.48][i]]));
  const COLORS = {H:'#eeeeea',C:'#35454e',N:'#2868c8',O:'#df4148',F:'#69b98b',P:'#dfa04e',S:'#d8bb4d',Cl:'#51a67a',Br:'#a65e4d',I:'#8864a5',Si:'#bba994',B:'#d0a08a',Se:'#cda45e',Fe:'#ba7d54',Co:'#a28db7',Ni:'#71a28a',Cu:'#b77c52',Zn:'#93a5bc',Pd:'#a2adbe',Pt:'#adb4bf',Rh:'#98b5c1',Ru:'#8a9eb7',Ag:'#b3bcc6',Au:'#d8b354'};
  const RADII = {H:.175,C:.265,N:.25,O:.25,F:.235,P:.295,S:.295,Se:.315,Cl:.285,Br:.305,I:.335,Pd:.335};
  const MAX_ATOMS = 5000, MAX_FRAMES = 500, MAX_BONDS = 20000;
  const DEFAULTS = Object.freeze({atomScale:1,bondRadius:.045,dashRadius:.027,dashLength:.15,dashGap:.11,bondColor:'#9ba3a8',dashColor:'#677f88',background:'#ffffff',labels:false,orthographic:true,indexBase:0,autoScale:1.2,elementColors:{},transparent:true,exportSize:2400,ambientOcclusion:true,aoStrength:.45,aoRadius:1.2});
  const SHADING_PRESETS = Object.freeze({basic:{ambientOcclusion:false,aoStrength:.45,aoRadius:1.2},soft:{ambientOcclusion:true,aoStrength:.45,aoRadius:1.2},strong:{ambientOcclusion:true,aoStrength:.9,aoRadius:2}});
  const clone = v => JSON.parse(JSON.stringify(v));
  const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
  const key = (a,b) => a<b ? `${a}-${b}` : `${b}-${a}`;
  const vector = (a,b) => [a.x-b.x,a.y-b.y,a.z-b.z];
  const dot = (a,b) => a.reduce((sum,x,i)=>sum+x*b[i],0);
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  function angle(a,b,c) {
    const u=vector(a,b),v=vector(c,b);
    if(Math.hypot(...u)<1e-12||Math.hypot(...v)<1e-12)return null;
    return Math.atan2(Math.hypot(...cross(u,v)),dot(u,v))*180/Math.PI;
  }
  function dihedral(a,b,c,d) {
    const ab=vector(a,b),bc=vector(c,b),cd=vector(d,c),n=Math.hypot(...bc);
    if(n<1e-12)return null;
    const axis=bc.map(x=>x/n);
    const v=ab.map((x,i)=>x-dot(ab,axis)*axis[i]),w=cd.map((x,i)=>x-dot(cd,axis)*axis[i]);
    if(Math.hypot(...v)<1e-10*Math.max(1,Math.hypot(...ab))||Math.hypot(...w)<1e-10*Math.max(1,Math.hypot(...cd)))return null;
    const degrees=Math.atan2(dot(cross(axis,v),w),dot(v,w))*180/Math.PI;
    return Math.abs(degrees)<1e-12?0:degrees;
  }
  function measure(atoms,selection) {
    if(!Array.isArray(selection)||selection.length<2||selection.length>4||new Set(selection).size!==selection.length||selection.some(i=>!Number.isInteger(i)||i<0||i>=atoms.length))throw new Error('Select 2–4 different, valid atom indices in order.');
    const points=selection.map(i=>atoms[i]);
    return selection.length===2?{kind:'Distance',value:distance(...points),unit:'Å'}:selection.length===3?{kind:'Bond angle',value:angle(...points),unit:'°'}:{kind:'Dihedral',value:dihedral(...points),unit:'°'};
  }
  function selectAtom(selection,index) {
    return selection.includes(index)?selection.filter(i=>i!==index):selection.length>=4?[index]:[...selection,index];
  }
  function parseSelection(text,atoms,indexBase=0) {
    const parts=String(text).trim().split(/[\s,;]+/);
    if(!parts.every(p=>/^\d+$/.test(p)))throw new Error('Enter 2–4 atom indices, separated by commas.');
    const indices=parts.map(p=>Number(p)-indexBase);measure(atoms,indices);return indices;
  }
  const color = x => typeof x==='string' && /^#[0-9a-fA-F]{6}$/.test(x);
  function number(token,description) {
    const text = String(token).replace(/[dD]/g,'e');
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) throw new Error(`${description}: invalid number “${token}”.`);
    const n = Number(text);
    if (!Number.isFinite(n) || Math.abs(n)>1e7) throw new Error(`${description}: coordinate is outside the supported range.`);
    return n;
  }
  function atomLine(line,lineNo,factor) {
    const fields = line.trim().split(/\s+/);
    if (fields.length<4) throw new Error(`Line ${lineNo}: expected element x y z.`);
    const elem = fields[0][0].toUpperCase()+fields[0].slice(1).toLowerCase();
    if (!ELEMENTS.has(elem)) throw new Error(`Line ${lineNo}: unknown element “${fields[0]}”.`);
    return {elem,x:number(fields[1],`Line ${lineNo}`)*factor,y:number(fields[2],`Line ${lineNo}`)*factor,z:number(fields[3],`Line ${lineNo}`)*factor};
  }
  function parseXYZ(text,units='angstrom') {
    if (typeof text!=='string' || !text.trim()) throw new Error('Paste coordinates or open an XYZ file first.');
    if (!['angstrom','bohr'].includes(units)) throw new Error('Unknown coordinate unit.');
    const factor = units==='bohr' ? .529177210903 : 1;
    const lines = text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').split('\n');
    let cursor = 0;
    while (cursor<lines.length && !lines[cursor].trim()) cursor++;
    const frames = [];
    if (/^\d+$/.test(lines[cursor].trim())) {
      while (cursor<lines.length) {
        while (cursor<lines.length && !lines[cursor].trim()) cursor++;
        if (cursor===lines.length) break;
        if (!/^\d+$/.test(lines[cursor].trim())) throw new Error(`Line ${cursor+1}: expected an XYZ atom count.`);
        const count = Number(lines[cursor]);
        if (count<1 || count>MAX_ATOMS) throw new Error(`Use 1–${MAX_ATOMS} atoms per frame.`);
        if (cursor+count+1>=lines.length) throw new Error(`Incomplete XYZ frame at line ${cursor+1}.`);
        const comment = lines[cursor+1], atoms = [];
        for (let i=0;i<count;i++) atoms.push(atomLine(lines[cursor+2+i],cursor+3+i,factor));
        frames.push({comment,atoms});
        if (frames.length>MAX_FRAMES) throw new Error(`Use at most ${MAX_FRAMES} frames.`);
        cursor += count+2;
      }
    } else {
      const atoms = [];
      for (let i=cursor;i<lines.length;i++) if (lines[i].trim()) atoms.push(atomLine(lines[i],i+1,factor));
      if (atoms.length>MAX_ATOMS) throw new Error(`Use at most ${MAX_ATOMS} atoms.`);
      frames.push({comment:'Imported coordinate rows',atoms});
    }
    const first = frames[0].atoms;
    for (const f of frames) if (f.atoms.length!==first.length || f.atoms.some((a,i)=>a.elem!==first[i].elem)) throw new Error('Trajectory frames must keep the same atom count and element order.');
    return frames;
  }
  function validateBond(b,atoms) {
    let {a,b:other,order=1,dashed=false} = b;
    if (!Number.isInteger(a)||!Number.isInteger(other)||a<0||other<0||a>=atoms.length||other>=atoms.length||a===other) throw new Error(`Choose two different atom indices from 0 to ${atoms.length-1}.`);
    if (![1,2,3].includes(order) || typeof dashed!=='boolean') throw new Error('Bond order must be 1, 2, or 3.');
    if (distance(atoms[a],atoms[other])<.001) throw new Error('A bond cannot connect atoms at the same position.');
    return {a:Math.min(a,other),b:Math.max(a,other),order:dashed?1:order,dashed};
  }
  function mergeBonds(existing,additions,atoms) {
    const map = new Map();
    for (const b of [...existing,...additions]) {const v=validateBond(b,atoms);map.set(key(v.a,v.b),v);}
    if (map.size>MAX_BONDS) throw new Error(`Use at most ${MAX_BONDS} bonds.`);
    return [...map.values()].sort((a,b)=>a.a-b.a||a.b-b.b);
  }
  function parseBondText(text,atoms,indexBase=0) {
    if (![0,1].includes(indexBase)) throw new Error('Invalid index base.');
    const result=[];
    for (const raw of text.split(/[,;\n]+/)) {
      if (!raw.trim()) continue;
      const m=raw.trim().match(/^(\d+)\s*-\s*(\d+)(?::\s*(1|2|3|d|dash))?$/i);
      if (!m) throw new Error(`Invalid bond “${raw.trim()}”. Use 0-1:2 or 1-2:d, separated by commas.`);
      result.push({a:Number(m[1])-indexBase,b:Number(m[2])-indexBase,order:/^d/i.test(m[3]||'')?1:Number(m[3]||1),dashed:/^d/i.test(m[3]||'')});
    }
    return mergeBonds([],result,atoms);
  }
  // Conservative drawing heuristics, not a chemical identity/charge solver.
  // Cutoffs (angstrom) are deliberately independent of connectivity tolerance.
  const ORGANIC_VALENCE = {H:1,B:3,C:4,N:3,O:2,F:1,Si:4,P:3,S:2,Cl:1,Br:1,I:1};
  const MULTIPLE_CUTOFFS = {'C-C':[1.43,1.25],'C-N':[1.36,1.20],'C-O':[1.30],
    'N-N':[1.30,1.14],'N-O':[1.25],'O-O':[1.25],'C-S':[1.65]};
  function inferOrganicOrders(atoms,bonds) {
    const warnings=[];
    if(atoms.some(a=>!(a.elem in ORGANIC_VALENCE))) {
      return {bonds,warnings:['Multiple-bond inference skipped: unsupported elements or metals. Review bonds manually.']};
    }
    const degree=atoms.map(()=>0);
    for(const b of bonds){degree[b.a]++;degree[b.b]++;}
    if(atoms.some((a,i)=>degree[i]>ORGANIC_VALENCE[a.elem])) {
      return {bonds,warnings:['Connectivity exceeds neutral valence limits; kept single bonds. Check units, charge, and distance tolerance.']};
    }
    const remaining=atoms.map((a,i)=>ORGANIC_VALENCE[a.elem]-degree[i]);
    const candidates=[];
    for(let i=0;i<bonds.length;i++) {
      const b=bonds[i],pair=[atoms[b.a].elem,atoms[b.b].elem].sort().join('-');
      const limits=MULTIPLE_CUTOFFS[pair],d=distance(atoms[b.a],atoms[b.b]);
      if(!limits||d>limits[0]||!remaining[b.a]||!remaining[b.b])continue;
      // Extremely compressed coordinates should not silently become triple bonds.
      if(d<.8){warnings.push('Unusually short bond: left single; review coordinates.');continue;}
      const extra=limits[1]&&d<=limits[1]?2:1;
      candidates.push({i,a:b.a,b:b.b,extra,score:1+(limits[0]-d)/limits[0]});
    }
    // At most one added bond order per atom unless a short triple-bond candidate
    // exists. This avoids assigning two doubles to every carbon in aromatic rings,
    // including structures whose hydrogens were omitted. Cumulenes need review.
    const capacity=remaining.map((n,i)=>Math.min(n,candidates.some(c=>(c.a===i||c.b===i)&&c.extra===2)?2:1));
    const adjacency=atoms.map(()=>[]);
    candidates.forEach((c,i)=>{adjacency[c.a].push(i);adjacency[c.b].push(i);});
    const seen=new Set();
    for(let seed=0;seed<candidates.length;seed++) {
      if(seen.has(seed))continue;
      const component=[],stack=[seed];seen.add(seed);
      while(stack.length){const index=stack.pop(),c=candidates[index];component.push(c);
        for(const atom of [c.a,c.b])for(const next of adjacency[atom])if(!seen.has(next)){seen.add(next);stack.push(next);}}
      component.sort((a,b)=>b.extra-a.extra||b.score-a.score||a.i-b.i);
      // Start with a valid greedy solution; bounded search improves competing
      // assignments (e.g. aromatic rings) without exponential UI stalls.
      const available=capacity.slice(),greedy=[];
      let bestScore=0;
      for(const c of component){const n=Math.min(c.extra,available[c.a],available[c.b]);greedy.push(n);available[c.a]-=n;available[c.b]-=n;bestScore+=n*c.score;}
      let best=greedy.slice(),visited=0,limited=false;
      if(component.length<=24) {
        const free=capacity.slice(),chosen=[],upper=Array(component.length+1).fill(0);
        for(let k=component.length-1;k>=0;k--)upper[k]=upper[k+1]+component[k].extra*component[k].score;
        function search(k,score){
          if(++visited>20000){limited=true;return;}
          if(score+upper[k]<=bestScore+1e-9)return;
          if(k===component.length){bestScore=score;best=chosen.slice();return;}
          const c=component[k],max=Math.min(c.extra,free[c.a],free[c.b]);
          for(let n=max;n>=0;n--){chosen[k]=n;free[c.a]-=n;free[c.b]-=n;search(k+1,score+n*c.score);free[c.a]+=n;free[c.b]+=n;if(limited)break;}
        }
        search(0,0);
      } else limited=true;
      if(limited)warnings.push('Complex conjugated region: bounded bond-order estimate; review manually.');
      component.forEach((c,i)=>{bonds[c.i]={...bonds[c.i],order:1+best[i]};});
    }
    return {bonds,warnings:[...new Set(warnings)]};
  }
  function inferBonds(atoms,scale=1.2) {
    if (!Number.isFinite(scale)||scale<.8||scale>1.6) throw new Error('Auto-bond tolerance must be 0.8–1.6.');
    const known=atoms.map((a,i)=>({a,i,r:COVALENT[a.elem]})).filter(v=>v.r);
    const missing=[...new Set(atoms.filter(a=>!COVALENT[a.elem]).map(a=>a.elem))];
    const bonds=[],cells=new Map(),cellSize=Math.max(1,...known.map(v=>v.r))*2*scale;
    for (const v of known) {
      const cell=[v.a.x,v.a.y,v.a.z].map(x=>Math.floor(x/cellSize));
      for (let dx=-1;dx<=1;dx++) for (let dy=-1;dy<=1;dy++) for (let dz=-1;dz<=1;dz++) {
        for (const w of cells.get(`${cell[0]+dx},${cell[1]+dy},${cell[2]+dz}`)||[]) {
          const d=distance(v.a,w.a);
          if (d>.35&&d<=scale*(v.r+w.r)) {
            bonds.push({a:w.i,b:v.i,order:1,dashed:false});
            if (bonds.length>MAX_BONDS) throw new Error('Too many inferred bonds. Check coordinate units or use a smaller structure.');
          }
        }
      }
      const c=cell.join(',');if (!cells.has(c)) cells.set(c,[]);cells.get(c).push(v);
    }
    const result=inferOrganicOrders(atoms,bonds);
    if(missing.length)result.warnings.unshift(`Auto-bonds skipped ${missing.join(', ')}; add their bonds manually.`);
    return result;
  }
  function validateSettings(input={}) {
    const out={...DEFAULTS,elementColors:{}};
    const ranges={atomScale:[.35,2],bondRadius:[.012,.15],dashRadius:[.008,.1],dashLength:[.04,.5],dashGap:[.025,.5],autoScale:[.8,1.6],aoStrength:[.05,1.5],aoRadius:[.1,5]};
    for (const [k,[lo,hi]] of Object.entries(ranges)) if (k in input) {if (!Number.isFinite(input[k])||input[k]<lo||input[k]>hi) throw new Error(`Invalid ${k}.`);out[k]=input[k];}
    for (const k of ['bondColor','dashColor','background']) if (k in input) {if (!color(input[k])) throw new Error(`Invalid ${k}.`);out[k]=input[k];}
    for (const k of ['labels','orthographic','transparent','ambientOcclusion']) if (k in input) {if (typeof input[k]!=='boolean') throw new Error(`Invalid ${k}.`);out[k]=input[k];}
    if ('indexBase' in input) {if (![0,1].includes(input.indexBase)) throw new Error('Invalid atom index base.');out.indexBase=input.indexBase;}
    if ('exportSize' in input) {if (![1200,2400,3600].includes(input.exportSize)) throw new Error('Invalid export resolution.');out.exportSize=input.exportSize;}
    if ('elementColors' in input) {
      if (!input.elementColors || typeof input.elementColors!=='object'||Array.isArray(input.elementColors)) throw new Error('Invalid element colors.');
      for (const [el,value] of Object.entries(input.elementColors)) {if (!ELEMENTS.has(el)||!color(value)) throw new Error('Invalid element color.');out.elementColors[el]=value;}
    }
    return out;
  }
  function validateSession(input) {
    if (!input||input.format!=='molecule-studio-session-v1') throw new Error('This is not a Mol3DViewer session.');
    if (!Array.isArray(input.frames)||input.frames.length<1||input.frames.length>MAX_FRAMES) throw new Error('Invalid session frames.');
    const frames=input.frames.map((f,k)=>{
      if (!Array.isArray(f.atoms)||f.atoms.length<1||f.atoms.length>MAX_ATOMS) throw new Error('Invalid atom count.');
      const atoms=f.atoms.map((a,i)=>{
        if (!a||!ELEMENTS.has(a.elem)||![a.x,a.y,a.z].every(x=>Number.isFinite(x)&&Math.abs(x)<1e7)) throw new Error(`Invalid atom ${i} in frame ${k}.`);
        return {elem:a.elem,x:a.x,y:a.y,z:a.z};
      });
      return {atoms,comment:String(f.comment||'').slice(0,1000)};
    });
    const first=frames[0].atoms;
    if (frames.some(f=>f.atoms.length!==first.length||f.atoms.some((a,i)=>a.elem!==first[i].elem))) throw new Error('Session frames have inconsistent atom ordering.');
    const frameIndex=input.frameIndex??0;
    if (!Number.isInteger(frameIndex)||frameIndex<0||frameIndex>=frames.length) throw new Error('Invalid selected frame.');
    if (!Array.isArray(input.bonds)||input.bonds.length>MAX_BONDS) throw new Error('Invalid bonds.');
    const bonds=mergeBonds([],input.bonds,frames[frameIndex].atoms), settings=validateSettings(input.settings);
    // Sessions saved before 1.2 used ordinary lighting without AO.
    if(!Object.prototype.hasOwnProperty.call(input.settings||{},'ambientOcclusion'))settings.ambientOcclusion=false;
    let view=null;
    if (input.view!=null) {
      if (!Array.isArray(input.view)||input.view.length!==8||!input.view.every(x=>Number.isFinite(x)&&Math.abs(x)<1e7)||Math.hypot(...input.view.slice(4))<1e-8) throw new Error('Invalid camera view.');
      view=input.view.slice();const q=Math.hypot(...view.slice(4));for(let i=4;i<8;i++)view[i]/=q;
    }
    return {format:input.format,name:String(input.name||'Structure').slice(0,160),frames,frameIndex,bonds,settings,view};
  }
  function toXYZ(frame) {
    return `${frame.atoms.length}\n${String(frame.comment||'Mol3DViewer; angstrom').replace(/[\r\n]/g,' ')}\n`+frame.atoms.map(a=>`${a.elem.padEnd(2)} ${a.x.toFixed(8)} ${a.y.toFixed(8)} ${a.z.toFixed(8)}`).join('\n')+'\n';
  }
  const TS_TEXT='9\nIllustrative TS-like geometry; not an optimized TS\nO -1.24 0.28 0\nC 0 0.28 0\nN 0.35 -1.40 0.04\nH 0.45 -2.10 0.02\nH -0.46 -1.80 0.05\nH 1.30 1.04 -0.15\nO 2.20 0.46 0.08\nH 2.90 0.92 0.08\nH 1.75 -0.80 0.08';
  const DEMOS={
    ts:{name:'TS illustration',text:TS_TEXT,bondText:'0-1:2,2-3,2-4,5-6,6-7,1-2:d,1-5:d,2-8:d,6-8:d'},
    water:{name:'Water',text:'3\nWater; example coordinates\nO 0 0 0\nH 0.9572 0 0\nH -0.239987 0.927297 0',bondText:'0-1,0-2'},
    palladium:{name:'Pd complex illustration',text:'11\nIllustrative square-planar Pd complex; not optimized\nPd 0 0 0\nP -2.3 0 0\nP 2.3 0 0\nCl 0 2.3 0\nCl 0 -2.3 0\nH -2.8 1.0 .85\nH -2.8 -1.0 .85\nH -2.8 0 -1.2\nH 2.8 1.0 .85\nH 2.8 -1.0 .85\nH 2.8 0 -1.2',bondText:'0-1,0-2,0-3,0-4,1-5,1-6,1-7,2-8,2-9,2-10'}
  };
  return {SYMBOLS,COVALENT,COLORS,RADII,DEFAULTS,SHADING_PRESETS,DEMOS,MAX_ATOMS,MAX_FRAMES,MAX_BONDS,clone,distance,key,angle,dihedral,measure,selectAtom,parseSelection,parseXYZ,validateBond,mergeBonds,parseBondText,inferBonds,validateSettings,validateSession,toXYZ};
});

