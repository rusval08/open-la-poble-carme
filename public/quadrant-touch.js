(function(){
 'use strict';const board=document.querySelector('#bracketCurrent');if(!board)return;
 let scale=1,pinch=null,gestureScale=null,frame;
 const clamp=n=>Math.max(.05,Math.min(3,n));
 function paper(){return board.querySelector('.paper-bracket')}
 function apply(){const p=paper();if(p)p.style.zoom=String(scale)}
 function zoom(next,x,y){const old=scale;scale=clamp(next);const r=board.getBoundingClientRect(),px=x-r.left,py=y-r.top;const left=(board.scrollLeft+px)/old,top=(board.scrollTop+py)/old;apply();board.scrollLeft=left*scale-px;board.scrollTop=top*scale-py}
 function distance(t){return Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY)}
 board.addEventListener('touchstart',e=>{if(e.touches.length===2){e.preventDefault();pinch={distance:distance(e.touches),scale}}},{passive:false});
 board.addEventListener('touchmove',e=>{if(e.touches.length!==2||!pinch)return;e.preventDefault();const x=(e.touches[0].clientX+e.touches[1].clientX)/2,y=(e.touches[0].clientY+e.touches[1].clientY)/2;if(pinch.distance>0)zoom(pinch.scale*distance(e.touches)/pinch.distance,x,y)},{passive:false});
 for(const name of['touchend','touchcancel'])board.addEventListener(name,()=>{pinch=null},{passive:true});
 board.addEventListener('gesturestart',e=>{e.preventDefault();gestureScale=scale},{passive:false});
 board.addEventListener('gesturechange',e=>{e.preventDefault();if(!pinch&&gestureScale!==null){const r=board.getBoundingClientRect();zoom(gestureScale*e.scale,Number.isFinite(e.clientX)?e.clientX:r.left+r.width/2,Number.isFinite(e.clientY)?e.clientY:r.top+r.height/2)}},{passive:false});
 board.addEventListener('gestureend',()=>{gestureScale=null});
 board.addEventListener('wheel',e=>{if(!e.ctrlKey)return;e.preventDefault();zoom(scale*Math.exp(-e.deltaY*.005),e.clientX,e.clientY)},{passive:false});
 new MutationObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(apply)}).observe(board,{childList:true});apply();
})();
