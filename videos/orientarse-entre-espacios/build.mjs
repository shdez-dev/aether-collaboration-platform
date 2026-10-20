import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(dir, '../..');
const require = createRequire(path.join(repo, 'apps/web/package.json'));
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const icons = require('lucide-react');
const icon = (name, size = 24) => renderToStaticMarkup(React.createElement(icons[name], { size, strokeWidth: 1.7, 'aria-hidden': true }));
await fs.mkdir(path.join(dir, 'assets'), { recursive: true });
await fs.copyFile(path.join(repo, 'apps/web/public/brand/logo-claro.svg'), path.join(dir, 'assets/logo.svg'));
async function download(url, name) {
  const dest = path.join(dir, 'assets', name);
  try { await fs.access(dest); return; } catch {}
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Asset ${name}: ${response.status}`);
  await fs.writeFile(dest, Buffer.from(await response.arrayBuffer()));
}
let fontFaces = '';
for (const font of ['Sora', 'Manrope']) {
  for (const weight of [400, 600, 700]) {
    const response = await fetch(`https://fonts.googleapis.com/css2?family=${font}:wght@${weight}&display=swap`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const css = await response.text();
    const urls = [...css.matchAll(/url\((https:[^)]+)\)/g)].map(match => match[1]);
    if (!urls.length) throw new Error(`Cannot resolve ${font}`);
    const ext = urls.at(-1).endsWith('.ttf') ? 'ttf' : 'woff2';
    const filename = `${font.toLowerCase()}-${weight}.${ext}`;
    await download(urls.at(-1), filename);
    fontFaces += `@font-face{font-family:${font};src:url('assets/${filename}') format('${ext==='ttf'?'truetype':'woff2'}');font-weight:${weight};font-display:block}\n`;
  }
}
await download('https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js', 'gsap.min.js');

const beats = [
  { start: 0, end: 5, label: 'PRIMEROS PASOS', title: 'Orientarse entre espacios', body: 'Encuentra tu contexto y cambia de espacio sin perderte.', note: 'Un recorrido breve por el menú lateral.' },
  { start: 5, end: 13, label: '01 / RECONOCE TU CONTEXTO', title: 'Mira dónde estás', body: 'El selector muestra tu espacio activo. Debajo aparece la organización a la que pertenece.', note: 'La etiqueta indica si es Personal, Equipo o Institucional.' },
  { start: 13, end: 25, label: '02 / ELIGE UN ESPACIO', title: 'Abre el selector', body: 'Haz clic en el nombre del espacio. Elige otro de la lista para cambiar tu contexto de trabajo.', note: '«Espacio actual» identifica el que estás usando.' },
  { start: 25, end: 32, label: '02 / CAMBIO COMPLETADO', title: 'Ya estás en otro espacio', body: 'Comprueba el nuevo nombre. Los proyectos del menú corresponden ahora al espacio seleccionado.', note: 'En este ejemplo: de Diseño a Operaciones.' },
  { start: 32, end: 45, label: '03 / CAMBIA DE ORGANIZACIÓN', title: '¿Buscas otro contexto?', body: 'Abre de nuevo el selector y pulsa el nombre de la organización para ver tus otras organizaciones.', note: 'Elige una a la que tengas acceso.' },
  { start: 45, end: 51, label: '03 / CONTEXTO PERSONAL', title: 'Tu espacio personal', body: 'También puedes volver a tu contexto personal. Revisa siempre el nombre antes de continuar.', note: 'Tus proyectos personales aparecen en el menú.' },
  { start: 51, end: 58, label: 'LISTO PARA CONTINUAR', title: 'Cada trabajo, en su espacio', body: 'Mira el nombre. Elige tu espacio. Continúa tu trabajo.', note: 'Puedes repetir este recorrido cuando lo necesites.' },
];
const captions = beats.map((b, i) => {
  const timestamp = n => `00:${String(Math.floor(n / 60)).padStart(2,'0')}:${String(n % 60).padStart(2,'0')}.000`;
  return `${i+1}\n${timestamp(b.start)} --> ${timestamp(b.end)}\n${b.title}. ${b.body}\n`;
}).join('\n');
await fs.writeFile(path.join(dir, 'tutorial.es.vtt'), `WEBVTT\n\n${captions}`);

const nav = [['House','Inicio'],['CalendarDays','Calendario'],['Bell','Notificaciones'],['FileText','Documentos'],['ContactRound','Contactos']];
const instructions = beats.map((b, i) => `<section id="beat-${i}" class="clip instruction" data-start="${b.start}" data-duration="${b.end-b.start}" data-track-index="2"><div class="instruction-inner" id="copy-${i}"><div class="eyebrow">${b.label}</div><h1>${b.title}</h1><p class="description">${b.body}</p><div class="hint">${icon(i===6 ? 'CheckCheck' : 'Lightbulb',24)}<p>${b.note}</p></div></div></section>`).join('');
const html = `<!doctype html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=1920,height=1080"><title>AETHER — Orientarse entre espacios</title>
<script src="assets/gsap.min.js"></script>
<style>
${fontFaces}
*{box-sizing:border-box}html,body{margin:0;width:1920px;height:1080px;background:#191523;color:#f2edf8;font-family:Manrope,sans-serif}#root{position:relative;width:100%;height:100%;overflow:hidden;--bg:#191523;--surface:#241e30;--panel:#2d263b;--border:#4a3c5c;--muted:#c2b7d3;--accent:#ad86dc}svg{flex-shrink:0}p,h1,h2,h3{margin:0}button{font:inherit;color:inherit}header.brandline{position:absolute;top:45px;left:64px;right:64px;display:flex;align-items:center;justify-content:space-between;height:48px}.brand{display:flex;align-items:center;gap:17px;font-family:Sora,sans-serif;font-size:21px;font-weight:600;letter-spacing:4px}.brand img{width:42px;height:42px;object-fit:contain}.series{font-size:19px;color:#c2b7d3;letter-spacing:2px}.toprule{position:absolute;top:115px;left:64px;right:64px;height:1px;background:#403449}.instruction{position:absolute;left:64px;top:215px;width:508px;height:620px}.instruction-inner{width:100%;height:100%;display:flex;flex-direction:column;align-items:flex-start}.eyebrow{font-size:19px;line-height:1.5;letter-spacing:1.6px;font-weight:700;color:#c6a2ef;margin-bottom:25px}h1{font-family:Sora,sans-serif;font-size:53px;line-height:1.16;letter-spacing:-2px;font-weight:700;max-width:504px}.description{font-size:29px;line-height:1.55;color:#d2c8de;margin-top:28px;max-width:488px}.hint{display:flex;align-items:flex-start;gap:13px;margin-top:auto;border-top:1px solid #46374f;padding-top:22px;color:#c2b7d3;font-size:21px;line-height:1.5;width:480px}.hint svg{color:#c6a2ef;margin-top:4px}.example{position:absolute;left:64px;top:872px;display:flex;align-items:center;gap:10px;color:#c2b7d3;font-size:19px}.example-dot{width:7px;height:7px;border-radius:50%;background:#ad86dc}
.app{position:absolute;left:624px;top:153px;width:1232px;height:768px;display:flex;border:1px solid #4a3c5c;border-radius:20px;overflow:hidden;background:#191523;box-shadow:0 20px 60px #0e0a1660}.sidebar{position:relative;width:326px;flex-shrink:0;background:#241e30;padding:27px 18px;display:flex;flex-direction:column;border-right:1px solid #403449}.appbrand{display:flex;align-items:center;gap:14px;font-family:Sora,sans-serif;font-size:19px;font-weight:700;letter-spacing:2px;margin:0 8px 25px}.appbrand img{width:37px;height:37px}.appbrand .collapse{margin-left:auto;color:#c2b7d3}.trigger{height:77px;border:1px solid #453651;border-radius:11px;background:#2b2236;display:flex;align-items:center;gap:11px;padding:11px;position:relative;flex-shrink:0}.workspace-icon{display:flex;align-items:center;justify-content:center;width:39px;height:39px;border-radius:10px;color:#7cdbba;background:#244039;border:1px solid #396859}.trigger-copy{display:grid;gap:4px;min-width:0;flex:1}.trigger-copy strong{font-size:19px;line-height:1.3;font-weight:700}.trigger-copy small{color:#c2b7d3;font-size:16px;line-height:1.3}.mode{font-size:13px;color:#e4caff;border:1px solid #534065;border-radius:7px;padding:4px 5px}.trigger svg.chev{width:18px;color:#c2b7d3}.create{margin:23px 0 18px;display:flex;gap:13px;align-items:center;background:#7452a6;padding:11px 14px;border-radius:9px;font-size:20px;font-weight:700}.nav{display:flex;gap:13px;align-items:center;font-size:20px;color:#ded4e9;padding:12px 13px;border-radius:8px}.nav.active{background:#382a48;color:#e6cfff}.nav svg{width:21px}.projects-label{font-size:15px;letter-spacing:1.7px;color:#c2b7d3;margin:25px 12px 9px;display:flex;align-items:center;justify-content:space-between}.project-link{font-size:18px;color:#d2c8de;display:flex;gap:11px;align-items:center;padding:9px 13px}.project-dot{width:7px;height:7px;border-radius:50%;background:#ad86dc}.sidebottom{margin-top:auto}.helplink{border-top:1px solid #453651;padding-top:16px;margin-top:10px}.user{display:flex;align-items:center;gap:12px;padding:12px 9px;margin-top:7px;font-size:17px;font-weight:600}.avatar{height:30px;width:30px;border-radius:50%;background:#ad86dc;color:#191523;display:grid;place-items:center;font-size:13px}.user svg{margin-left:auto;color:#c2b7d3}.main{position:relative;flex:1;padding:43px 37px;min-width:0}.breadcrumb{font-size:17px;color:#c2b7d3;display:flex;gap:12px;align-items:center}.main h2{font:600 33px/1.25 Sora,sans-serif;margin-top:24px;letter-spacing:-1px}.main .sub{color:#c2b7d3;font-size:20px;margin-top:12px;line-height:1.5}.workspace-banner{display:flex;align-items:center;gap:16px;padding:23px;margin-top:29px;border:1px solid #493958;border-radius:13px;background:#282033}.workspace-banner .workspace-icon{height:49px;width:49px}.banner-copy{display:grid;gap:6px}.banner-copy strong{font-size:22px}.banner-copy span{font-size:17px;color:#c2b7d3}.section-heading{font-family:Sora,sans-serif;font-size:21px;display:flex;align-items:center;gap:11px;margin:36px 0 20px}.count{display:grid;place-items:center;min-width:27px;height:27px;background:#392b49;border-radius:7px;color:#d8b7f9;font-size:16px}.project-card{padding:22px 23px;border:1px solid #43334f;border-radius:12px;background:#241e30;margin-bottom:15px;display:flex;align-items:center;gap:16px}.project-card .project-symbol{height:44px;width:44px;border-radius:11px;background:#3a2c4b;color:#cfacf1;display:grid;place-items:center}.project-card strong{display:block;font-size:21px;font-weight:700}.project-card p{font-size:17px;color:#c2b7d3;margin-top:6px}.project-card>svg{margin-left:auto;color:#c2b7d3}.dim{position:absolute;inset:0;background:#191523;opacity:0;pointer-events:none}
.popover{position:absolute;left:340px;top:78px;width:465px;border:1px solid #635078;border-radius:17px;background:#2d263b;box-shadow:0 18px 45px #0c081ba8;overflow:hidden;opacity:0;z-index:6}.panel-header{padding:21px;border-bottom:1px solid #4b3d59;background:#332940}.panel-top{display:flex;justify-content:space-between;align-items:center;font-size:19px;font-weight:700}.panel-top span{color:#d1b0f4;font-size:16px;display:flex;align-items:center;gap:6px}.organization-picker{display:flex;align-items:center;gap:13px;padding:13px;border:1px solid #79608f;border-radius:10px;background:#2a2236;margin-top:14px;font-size:21px;font-weight:700}.organization-picker>svg:last-child{margin-left:auto}.organization-symbol{width:37px;height:37px;display:grid;place-items:center;background:#463356;border-radius:8px;color:#d8b8f6}.panel-content{padding:0 17px 17px}.panel-title{display:flex;align-items:center;gap:8px;padding:21px 5px 16px;font-size:17px;font-weight:700}.panel-title .count{font-size:15px;width:25px;height:25px}.option{display:flex;align-items:center;gap:12px;padding:13px;border:1px solid #4b3b59;border-radius:11px;background:#30263d;min-height:72px;margin-bottom:8px}.option.selected{border-color:#b18add;background:#453055}.option-icon{height:38px;width:38px;border-radius:10px;background:#27443c;border:1px solid #446e60;color:#7cdbba;display:grid;place-items:center}.option-icon.purple{background:#443054;color:#d5b3f5;border-color:#6b4e7d}.option-copy{display:grid;gap:5px;flex:1}.option-copy strong{font-size:20px;font-weight:700}.option-copy small{font-size:16px;color:#d2c4df}.option>svg{color:#cfacf1}.new-space{display:flex;align-items:center;gap:10px;padding:13px;border:1px solid #67507c;border-radius:10px;background:#3b2c49;color:#ddc1f8;font-size:18px;margin-top:13px}.panel-footer{border-top:1px solid #4b3d59;display:flex;align-items:center;justify-content:space-between;padding:16px;font-size:15px;color:#d2c4df}.panel-footer span{display:flex;gap:8px;align-items:center}.org-list{position:absolute;inset:0;background:#2d263b;opacity:0}.org-list .panel-header{font-size:21px;font-weight:700;padding:24px 21px}.back{display:flex;align-items:center;gap:7px;color:#d4b6f2;font-size:17px;padding:21px 5px 15px}.focus-ring{position:absolute;border:3px solid #c4a0ec;border-radius:14px;pointer-events:none;opacity:0;z-index:8}.focus-trigger{left:14px;top:85px;width:298px;height:85px}.focus-org{left:357px;top:138px;width:432px;height:72px}.focus-projects{left:13px;top:485px;width:299px;height:116px}.confirm{position:absolute;bottom:34px;left:363px;right:34px;background:#254136;border:1px solid #55876f;border-radius:11px;padding:17px 20px;display:flex;align-items:center;gap:12px;font-size:20px;color:#baf0da;opacity:0;z-index:8}.cursor{position:absolute;left:-10px;top:-6px;width:49px;height:49px;z-index:12;opacity:0;transform-origin:10px 6px;filter:drop-shadow(0 2px 3px #0008)}.cursor svg{width:100%;height:100%}.rings{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:11}.rings circle{fill:none;stroke:#dfc4fa;stroke-width:3;opacity:0}.progress{position:absolute;left:64px;right:64px;bottom:47px;display:grid;grid-template-columns:repeat(4,1fr);gap:20px}.progress-item{font-size:18px;color:#c2b7d3}.progress-track{height:3px;background:#493a56;margin-bottom:13px;overflow:hidden}.progress-fill{height:100%;width:100%;background:#c6a2ef;transform-origin:left center}.progress-label{display:flex;gap:11px}.progress-number{color:#d9b8f8;font-variant-numeric:tabular-nums}.app-caption{position:absolute;top:936px;left:624px;right:64px;display:flex;justify-content:space-between;color:#c2b7d3;font-size:17px}.fine{color:#c2b7d3}
.sidebar{padding-top:22px;padding-bottom:22px}.nav{padding-top:9px;padding-bottom:9px}.projects-label{margin-top:18px}.appbrand{margin-bottom:20px}.focus-trigger{top:75px}.focus-projects{top:500px;height:104px}.workspace-panel{width:100%;height:100%}
</style></head><body><div id="root" data-composition-id="main" data-width="1920" data-height="1080" data-duration="58" data-fps="30">
<header class="brandline"><div class="brand"><img src="assets/logo.svg" alt="">AETHER</div><div class="series">GUÍA DE LA PLATAFORMA / 01</div></header><div class="toprule"></div>
${instructions}
<div class="example"><span class="example-dot"></span>Demostración con datos de ejemplo</div>
<section id="app" class="app" aria-label="Demostración del selector de AETHER">
<aside class="sidebar"><div class="appbrand"><img src="assets/logo.svg" alt="">AETHER<span class="collapse">${icon('PanelLeftClose',22)}</span></div>
<div id="trigger" class="trigger"><div class="workspace-icon" id="trigger-icon">${icon('UsersRound',23)}</div><div class="trigger-copy"><strong id="active-space">Diseño</strong><small id="active-org">Estudio Norte</small></div><span class="mode" id="active-mode">Equipo</span>${icon('ChevronDown',18).replace('class="','class="chev ')}</div>
<div class="create">${icon('Plus',23)}Crear</div>
${nav.map(([i,l],n)=>`<div class="nav ${n===0?'active':''}">${icon(i,23)}${l}</div>`).join('')}
<div class="projects-label">PROYECTOS ${icon('Plus',17)}</div><div id="side-projects"><div class="project-link"><i class="project-dot"></i><span id="side-project-a">Identidad visual</span></div><div class="project-link"><i class="project-dot"></i><span id="side-project-b">Sitio web</span></div></div>
<div class="sidebottom"><div class="nav helplink">${icon('CircleHelp',22)}Ayuda</div><div class="user"><span class="avatar">AM</span>Alex Moreno${icon('Settings',20)}</div></div></aside>
<main id="main-area" class="main"><div class="breadcrumb"><span id="breadcrumb-org">Estudio Norte</span>${icon('ChevronRight',17)}<span id="breadcrumb-space">Diseño</span></div><h2>Tu espacio de trabajo</h2><p class="sub">Un lugar para organizar tus proyectos.</p><div class="workspace-banner"><span class="workspace-icon">${icon('FolderKanban',28)}</span><div class="banner-copy"><strong id="banner-name">Diseño</strong><span id="banner-sub">Espacio de equipo</span></div></div><div class="section-heading">Proyectos<span class="count">2</span></div><div id="cards"><div class="project-card"><span class="project-symbol">${icon('FolderKanban',25)}</span><div><strong id="project-a">Identidad visual</strong><p>En curso</p></div>${icon('ChevronRight',23)}</div><div class="project-card"><span class="project-symbol">${icon('FolderKanban',25)}</span><div><strong id="project-b">Sitio web</strong><p>En curso</p></div>${icon('ChevronRight',23)}</div></div><div id="dim" class="dim"></div></main>
<div id="popover" class="popover" data-layout-allow-occlusion><div class="panel-header"><div class="panel-top">Organización<span>${icon('UserPlus',18)}Miembros</span></div><div id="organization-picker" class="organization-picker"><span class="organization-symbol">${icon('Building2',22)}</span>Estudio Norte${icon('ChevronDown',20)}</div></div><div class="panel-content"><div class="panel-title">Espacios de esta organización<span class="count">2</span></div><div id="option-design" class="option selected"><span class="option-icon">${icon('UsersRound',23)}</span><div class="option-copy"><strong>Diseño</strong><small id="design-status">Espacio actual</small></div><span id="design-check">${icon('Check',21)}</span></div><div id="option-operations" class="option"><span class="option-icon purple">${icon('BriefcaseBusiness',23)}</span><div class="option-copy"><strong>Operaciones</strong><small id="operations-status"></small></div><span id="operations-check">${icon('ArrowRight',21)}</span></div><div class="new-space">${icon('Plus',21)}Nuevo espacio</div></div><div class="panel-footer"><span>${icon('Settings2',18)}Configurar espacio</span><span>${icon('RefreshCw',18)}Actualizar</span></div>
<div id="org-list" class="org-list"><div class="panel-header">Elegir organización</div><div class="panel-content"><div class="back">${icon('ArrowLeft',19)}Volver</div><div class="option selected"><span class="organization-symbol">${icon('Building2',24)}</span><div class="option-copy"><strong>Estudio Norte</strong><small>Organización actual</small></div>${icon('Check',22)}</div><div id="personal-option" class="option"><span class="organization-symbol">${icon('Building2',24)}</span><div class="option-copy"><strong>Personal</strong><small>1 espacio</small></div>${icon('ArrowRight',22)}</div><div class="new-space">${icon('Plus',21)}Nueva organización</div></div></div></div>
<div id="focus-trigger" class="focus-ring focus-trigger"></div><div id="focus-org" class="focus-ring focus-org"></div><div id="focus-projects" class="focus-ring focus-projects"></div><div id="confirm" class="confirm">${icon('Check',23)}<span id="confirm-text">Ahora estás en Operaciones</span></div>
</section>
<div class="app-caption"><span>Menú lateral / Selector de espacios</span><span>Vista ampliada para este recorrido</span></div>
<div class="cursor" id="cursor" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 3 L5 19 L9 15 L12 22 L15 20.5 L11.5 14 L18 14 Z" fill="#f5effb" stroke="#191523" stroke-width="1.4" stroke-linejoin="round"/></svg></div>
<svg class="rings" aria-hidden="true">${[0,1,2,3,4].map(i=>`<circle id="ring-${i}-a" r="12"/><circle id="ring-${i}-b" r="12"/>`).join('')}</svg>
<footer class="progress">${['Reconoce tu contexto','Elige un espacio','Cambia de organización','Continúa tu trabajo'].map((label,i)=>`<div class="progress-item"><div class="progress-track"><div id="progress-${i}" class="progress-fill"></div></div><div class="progress-label"><span class="progress-number">0${i+1}</span>${label}</div></div>`).join('')}</footer>
</div><script>
document.fonts.ready.then(()=>{
const tl=gsap.timeline({paused:true});
const beats=${JSON.stringify(beats)};
beats.forEach((b,i)=>{tl.fromTo('#copy-'+i,{opacity:0,y:16},{opacity:1,y:0,duration:.45,ease:'power2.out'},b.start+.12);if(i<beats.length-1)tl.to('#copy-'+i,{opacity:0,y:-8,duration:.2,ease:'power1.in'},b.end-.25);});
tl.fromTo('#app',{opacity:0},{opacity:1,duration:.8,ease:'power3.out',immediateRender:false},.12);
function show(sel,start,end){tl.fromTo(sel,{opacity:0},{opacity:1,duration:.3,ease:'power2.out',immediateRender:false},start);tl.to(sel,{opacity:0,duration:.25,ease:'power1.in'},end);}
show('#focus-trigger',5.7,12.6);
// Click choreography adapted from the installed press-ripple primitive.
function click(i,x,y,t,target){
  const rect=document.querySelector(target).getBoundingClientRect();
  x=rect.right-29;y=rect.top+rect.height/2;
  const cursor=document.querySelector('#cursor');
  tl.to(cursor,{x,y,opacity:1,duration:.85,ease:'power3.out'},t-1.1);
  tl.to([cursor,target],{scale:.97,duration:.12,ease:'power1.in'},t);
  tl.to([cursor,target],{scale:1,duration:.34,ease:'back.out(1.5)'},t+.12);
  ['a','b'].forEach((suffix,j)=>{const ring=document.querySelector('#ring-'+i+'-'+suffix);ring.setAttribute('cx',x);ring.setAttribute('cy',y);tl.fromTo(ring,{attr:{r:10},opacity:j?.5:1},{attr:{r:47},opacity:0,duration:.48,ease:'power2.out',immediateRender:false},t+.12+j*.07);});
}
tl.set('#cursor',{x:1600,y:800,opacity:0},0);
click(0,898,283,14.8,'#trigger');
tl.fromTo('#popover',{opacity:0,x:-8},{opacity:1,x:0,duration:.3,ease:'power2.out',immediateRender:false},15.05);
tl.to('#dim',{opacity:.72,duration:.3},15.05);
tl.to('#cursor',{x:1450,y:690,duration:.65,ease:'power2.inOut'},16);
click(1,1335,485,22.9,'#option-operations');
tl.to('#popover',{opacity:0,duration:.22},23.1);tl.to('#dim',{opacity:0,duration:.3},23.1);
tl.to('#cursor',{x:1650,y:730,opacity:0,duration:.7,ease:'power2.inOut'},24);
show('#focus-trigger',25.2,28.1);show('#focus-projects',28.3,31.5);show('#confirm',25,31.3);
click(2,898,283,33.1,'#trigger');
tl.fromTo('#popover',{opacity:0,x:-8},{opacity:1,x:0,duration:.3,ease:'power2.out',immediateRender:false},33.3);tl.to('#dim',{opacity:.72,duration:.3},33.3);
show('#focus-org',34,37.5);
click(3,1336,325,37.7,'#organization-picker');
tl.to('#org-list',{opacity:1,duration:.25},37.9);
tl.to('#workspace-panel',{opacity:0,duration:.2},37.9);
tl.to('#cursor',{x:1504,y:650,duration:.7,ease:'power2.inOut'},38.6);
click(4,1335,475,43.8,'#personal-option');
tl.to('#popover',{opacity:0,duration:.22},44);tl.to('#dim',{opacity:0,duration:.3},44);
tl.to('#cursor',{x:1650,y:730,opacity:0,duration:.7,ease:'power2.inOut'},44.5);
show('#focus-trigger',45.2,49.7);show('#confirm',45.2,50.6);
[[0,13],[13,32],[32,51],[51,58]].forEach(([a,b],i)=>tl.fromTo('#progress-'+i,{scaleX:0},{scaleX:1,duration:b-a,ease:'none'},a));
const contexts=[{space:'Diseño',org:'Estudio Norte',mode:'Equipo',a:'Identidad visual',b:'Sitio web',sub:'Espacio de equipo'},{space:'Operaciones',org:'Estudio Norte',mode:'Equipo',a:'Atención al cliente',b:'Mejora de procesos',sub:'Espacio de equipo'},{space:'Mi espacio',org:'Personal',mode:'Personal',a:'Plan de aprendizaje',b:'Ideas personales',sub:'Espacio personal'}];
const state={time:0};let last=-1;
tl.to(state,{time:58,duration:58,ease:'none',onUpdate:()=>{const index=state.time>=44.12?2:state.time>=23.18?1:0;if(index===last)return;last=index;const c=contexts[index];[['active-space',c.space],['active-org',c.org],['active-mode',c.mode],['breadcrumb-org',c.org],['breadcrumb-space',c.space],['banner-name',c.space],['banner-sub',c.sub],['side-project-a',c.a],['side-project-b',c.b],['project-a',c.a],['project-b',c.b],['confirm-text',index===2?'Ahora estás en tu espacio personal':'Ahora estás en Operaciones']].forEach(([id,value])=>document.getElementById(id).textContent=value);document.getElementById('option-design').classList.toggle('selected',index===0);document.getElementById('option-operations').classList.toggle('selected',index!==0);document.getElementById('design-status').textContent=index===0?'Espacio actual':'';document.getElementById('operations-status').textContent=index===0?'':'Espacio actual';document.getElementById('design-check').style.opacity=index===0?'1':'0';document.getElementById('operations-check').style.opacity=index===0?'0':'1';}},0);
window.__timelines=window.__timelines||{};window.__timelines.main=tl;
});
</script></body></html>`;
// The dropdown intentionally covers the demonstrated dashboard content.
// Scope audit annotations to those background text blocks, not the whole scene.
let output=html.replace('<div id="popover" class="popover" data-layout-allow-occlusion>','<div id="popover" class="popover" data-layout-allow-occlusion><div id="workspace-panel" class="workspace-panel">').replace('<div id="org-list" class="org-list">','</div><div id="org-list" class="org-list">');
output=output.replace(/(<main id="main-area"[\s\S]*?<\/main>)/, main=>main.replace(/<(span|h2|p|strong)(\s[^>]*)?>/g,(tag)=>tag.slice(0,-1)+' data-layout-allow-occlusion data-layout-allow-overlap>').replace('<div class="section-heading">','<div class="section-heading" data-layout-allow-occlusion data-layout-allow-overlap>'));
await fs.writeFile(path.join(dir, 'index.html'), output);
await fs.writeFile(path.join(dir, 'index.motion.json'), JSON.stringify({ duration:58, assertions:[{kind:'appearsBy',selector:'#app',bySec:1.2},{kind:'staysInFrame',selector:'#app'},{kind:'staysInFrame',selector:'#popover'},{kind:'staysInFrame',selector:'#cursor'}] },null,2));
console.log('Built 58-second AETHER tutorial; local assets and WebVTT ready.');
