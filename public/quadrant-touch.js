(function(){
 'use strict';const board=document.querySelector('#bracketCurrent');if(!board)return;document.body.classList.add('quadrant-viewer');
 const toolbar=document.createElement('nav');toolbar.className='quadrant-viewer-toolbar';toolbar.setAttribute('aria-label','Vista del quadrant');toolbar.innerHTML='<a href="/resultats" aria-label="Tornar als resultats">← Inici</a><span class="quadrant-viewer-title">Quadrant en directe</span><span class="quadrant-viewer-hint" role="status">Arrossega per moure · Pinça o roda per ampliar · Doble toc per tornar a la mida inicial</span>';document.body.append(toolbar);
 let scale=1,minimumScale=1,atMinimum=true,canvas,paper,baseW=3180,baseH=1880,origin={x:0,y:0},frame,lastTap=null,moved=false,view={left:0,top:0};
 const pointers=new Map(),margin=16;
 function remember(){view={left:board.scrollLeft,top:board.scrollTop}}
 function updateMinimumScale() {
   minimumScale = Math.max(1, board.clientHeight) / baseH;
 }
 function limits(nextScale) {
   return Math.max(minimumScale, Math.min(Math.max(3, minimumScale), nextScale));
 }
 function apply(){if(!paper||!canvas)return;const width=baseW*scale,height=baseH*scale;origin={x:Math.max(margin,(board.clientWidth-width)/2),y:0};canvas.style.width=Math.max(board.clientWidth,width+margin*2)+'px';canvas.style.height=Math.max(board.clientHeight,Math.ceil(height))+'px';paper.style.transform='translate('+origin.x+'px,'+origin.y+'px) scale('+scale+')';}
 function resetZoom() {
   scale = minimumScale;
   atMinimum = true;
   apply();
   board.scrollTop = 0;
   remember();
 }
 function install() {
   const next = board.querySelector('.paper-bracket');
   if (!next) return;
   const firstRender = !paper;
   if (next !== paper) {
     paper = next;
     canvas = document.createElement('div');
     canvas.className = 'quadrant-canvas';
     canvas.style.overflow = 'hidden';
     board.append(canvas);
     canvas.append(paper);
     baseW = paper.offsetWidth || 3180;
     baseH = paper.scrollHeight || 1880;
   }
   const previousView = view;
   updateMinimumScale();
   scale = atMinimum ? minimumScale : limits(scale);
   atMinimum = scale === minimumScale;
   apply();
   board.scrollLeft = firstRender ? 0 : previousView.left;
   board.scrollTop = atMinimum ? 0 : previousView.top;
   remember();
 }
 function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(install)}
 function zoom(next,x,y,targetX=x,targetY=y){if(!paper)return;const r=board.getBoundingClientRect(),px=x-r.left,py=y-r.top,worldX=(board.scrollLeft+px-origin.x)/scale,worldY=(board.scrollTop+py-origin.y)/scale;scale=limits(next);atMinimum=scale===minimumScale;apply();board.scrollLeft=origin.x+worldX*scale-(targetX-r.left);board.scrollTop=origin.y+worldY*scale-(targetY-r.top);remember()}
 function gesture(){const a=[...pointers.values()];return a.length>=2?{x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2,d:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)}:null}
 board.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1)moved=false;else{moved=true;lastTap=null}board.setPointerCapture?.(e.pointerId);board.classList.add('is-dragging')});
 board.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;e.preventDefault();const previous=pointers.get(e.pointerId),before=gesture();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const after=gesture();if(Math.hypot(e.clientX-previous.x,e.clientY-previous.y)>2)moved=true;if(before&&after&&before.d>0)zoom(scale*after.d/before.d,before.x,before.y,after.x,after.y);else if(pointers.size===1){board.scrollLeft-=e.clientX-previous.x;board.scrollTop-=e.clientY-previous.y;remember()}});
 function end(e){if(!pointers.has(e.pointerId))return;const single=pointers.size===1;pointers.delete(e.pointerId);if(!pointers.size)board.classList.remove('is-dragging');if(e.type==='pointerup'&&single&&!moved){const now=Date.now();if(lastTap&&now-lastTap.at<350&&Math.hypot(e.clientX-lastTap.x,e.clientY-lastTap.y)<30){resetZoom();lastTap=null}else lastTap={at:now,x:e.clientX,y:e.clientY}}else lastTap=null}
 for(const event of['pointerup','pointercancel','lostpointercapture'])board.addEventListener(event,end);
 board.addEventListener('wheel',e=>{e.preventDefault();zoom(scale*Math.exp(-e.deltaY*(e.deltaMode===1?.04:.0025)),e.clientX,e.clientY)},{passive:false});
 board.addEventListener('keydown',e=>{const r=board.getBoundingClientRect();if(['+','=','-','0','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();if(e.key==='0')resetZoom();else if(['+','=','-'].includes(e.key))zoom(scale*(e.key==='-'?.8:1.25),r.left+r.width/2,r.top+r.height/2);else{board.scrollLeft+=e.key==='ArrowLeft'?-80:e.key==='ArrowRight'?80:0;board.scrollTop+=e.key==='ArrowUp'?-80:e.key==='ArrowDown'?80:0;remember()}}});
 board.addEventListener('scroll',()=>{if(paper?.isConnected&&paper.parentElement===canvas)remember()},{passive:true});
 board.setAttribute('aria-label','Quadrant complet en directe. Arrossega per moure en totes direccions, pinça o roda per ampliar i tornar a la mida inicial, o fes doble toc per restablir-la. Teclat: fletxes, més, menys i zero.');
 new MutationObserver(schedule).observe(board,{childList:true});new ResizeObserver(schedule).observe(board);addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);install();
})();
