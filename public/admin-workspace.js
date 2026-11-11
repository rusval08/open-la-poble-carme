(function(){
 'use strict';if(!document.body.classList.contains('admin-body'))return;
 let observer;
 function initialize(){
  const main=document.querySelector('.admin-layout'),gate=document.querySelector('.broadcast-gate-panel'),production=document.querySelector('#productionPanel'),operations=document.querySelector('.operations-panel'),backups=document.querySelector('.championship-backups');
  if(!main||main.dataset.workspace==='ready')return true;
  if(!gate||!production?.querySelector('.production-grid')||!operations||!backups)return false;
  main.dataset.workspace='ready';observer?.disconnect();
  const originals=[...main.children],nav=document.createElement('nav');nav.className='admin-workspace-nav';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Apartats d’administració');
  const labels=[['home','Inici'],['tv','TV i càmeres'],['event','Campionat'],['settings','Còpies i ajustos']],panes=new Map(),buttons=new Map();
  for(const[key,label]of labels){
   const button=document.createElement('button');button.type='button';button.id='admin-tab-'+key;button.textContent=label;button.setAttribute('role','tab');button.setAttribute('aria-controls','admin-'+key);nav.append(button);buttons.set(key,button);
   const pane=document.createElement('section');pane.id='admin-'+key;pane.className='admin-workspace-pane';pane.setAttribute('role','tabpanel');pane.setAttribute('aria-labelledby',button.id);panes.set(key,pane);
  }
  main.prepend(nav);for(const pane of panes.values())main.append(pane);
  const home=panes.get('home'),tv=panes.get('tv'),event=panes.get('event'),settings=panes.get('settings');
  const intro=document.createElement('div');intro.className='admin-workspace-heading';intro.innerHTML='<div><h2>Accés ràpid</h2><p>Les accions principals del campionat, a un clic.</p></div>';home.append(intro);
  const shortcuts=document.createElement('nav');shortcuts.className='admin-shortcuts';shortcuts.setAttribute('aria-label','Accions habituals');
  shortcuts.innerHTML='<a class="admin-shortcut" href="/control"><strong>Puntuar taules</strong><span>Marcador i següent partit</span></a><a class="admin-shortcut" href="/quadrant-control"><strong>Quadrant</strong><span>Enfrontaments i passos directes</span></a><a class="admin-shortcut" href="/jugadors"><strong>Jugadors</strong><span>Afegir i revisar els noms</span></a><a class="admin-shortcut" href="#championshipBackups"><strong>Còpia de seguretat</strong><span>Guardar o recuperar el campionat</span></a>';home.append(shortcuts,gate);const readiness=document.querySelector('.operations-overview');if(readiness)home.append(readiness);
  const tvIntro=document.createElement('div');tvIntro.className='admin-workspace-heading';tvIntro.innerHTML='<div><h2>TV i càmeres</h2><p>Canviar d’apartat no atura les càmeres ni l’emissió.</p></div><nav class="admin-tv-shortcuts" aria-label="Accessos de vídeo"><a href="/tv-directe.html?preview=admin" target="_blank" rel="noopener">Previsualització privada ↗</a><a href="/tv-directe.html?preview=admin&amp;marcador=1" target="_blank" rel="noopener">Vista del marcador ↗</a><a href="/gravacions.html">Gravacions i descàrregues</a><a href="#admin-home">Obrir o tancar el públic</a></nav>';tv.append(tvIntro);
  const eventIntro=document.createElement('div');eventIntro.className='admin-workspace-heading';eventIntro.innerHTML='<div><h2>Campionat i pantalles</h2><p>Control dels partits i accessos a les pantalles públiques.</p></div>';event.append(eventIntro);
  function group(parent,label,node,open=false){if(!node)return;const details=document.createElement('details');details.className='admin-workspace-details';details.open=open;const summary=document.createElement('summary');summary.textContent=label;details.append(summary,node);parent.append(details);return details}
  group(settings,'Còpies de seguretat',backups,true);
  const advanced=document.querySelector('.operations-advanced');if(advanced){advanced.open=true;group(settings,'Patrocinadors i presentació',advanced)}
  group(settings,'Emissor amb retrocés',document.querySelector('.dvr-admin'));
  const readinessDetails=group(home,'Comprovacions i estat del sistema',operations);operations.id='systemReadiness';
  for(const node of originals){
   if(node===gate||node===operations||node===readiness)continue;
   if(node.contains(production)){tv.append(node);continue}
   const title=node.querySelector('h2')?.textContent.trim();
   if(title==='Nom del campionat'){group(settings,'Nom del campionat',node);continue}
   if(title==='Sessió'){group(settings,'Sessió d’administrador',node);continue}
   if(title==='Resum ràpid'){home.insertBefore(node,home.querySelector('.admin-workspace-details'));continue}
   event.append(node);
  }
  function activate(key,writeHash=false){
   if(!panes.has(key))key='home';for(const[id,pane]of panes){pane.hidden=id!==key;const button=buttons.get(id);button.setAttribute('aria-selected',String(id===key));button.tabIndex=id===key?0:-1}
   if(writeHash)history.replaceState(null,'','#admin-'+key);
  }
  function reveal(target,scroll=false){const pane=target?.closest('.admin-workspace-pane');if(!pane)return;activate(pane.id.replace('admin-',''));for(let parent=target.parentElement;parent&&parent!==pane;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;if(scroll)requestAnimationFrame(()=>target.scrollIntoView({block:'start',behavior:'auto'}))}
  for(const[key,button]of buttons)button.addEventListener('click',()=>activate(key,true));
  nav.addEventListener('keydown',e=>{const keys=labels.map(x=>x[0]),index=keys.findIndex(k=>buttons.get(k)===document.activeElement);if(index<0)return;let next;if(e.key==='ArrowRight')next=(index+1)%keys.length;else if(e.key==='ArrowLeft')next=(index+keys.length-1)%keys.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=keys.length-1;else return;e.preventDefault();activate(keys[next],true);buttons.get(keys[next]).focus()});
  document.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(!a)return;const u=new URL(a.href,location.href);if(u.origin!==location.origin||u.pathname!==location.pathname||!u.hash)return;const target=document.getElementById(decodeURIComponent(u.hash.slice(1)));if(target)reveal(target,true)});
  function fromHash(){let id;try{id=decodeURIComponent(location.hash.slice(1))}catch{return}const target=document.getElementById(id);if(target)reveal(target);else activate('home')}
  addEventListener('hashchange',fromHash);activate('home');fromHash();return true;
 }
 if(!initialize()){observer=new MutationObserver(()=>initialize());observer.observe(document.body,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),15000)}
})();

