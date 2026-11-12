(function(root){
 'use strict';
 function create({getStream,connect,status=()=>{},changed=()=>{},online=()=>navigator.onLine!==false,setTimer=setTimeout,clearTimer=clearTimeout}){
  let wanted=false,epoch=0,connection=null,pending=null,timer=null,failures=0;
  const notify=()=>changed({wanted,connected:!!connection,retrying:wanted&&!connection});
  function cancelTimer(){if(timer!==null)clearTimer(timer);timer=null}
  function schedule(){if(!wanted||timer!==null)return;const delay=Math.min(15000,2000*Math.pow(2,Math.min(failures++,3)));timer=setTimer(()=>{timer=null;attempt(epoch)},delay)}
  function stop(message='Emissió aturada per l’administrador'){
   wanted=false;epoch++;cancelTimer();const old=connection,waiting=pending;connection=null;pending=null;
   if(old){old.onClose=null;old.close()}if(waiting&&waiting!==old){waiting.onClose=null;waiting.close()}
   status(message);notify();
  }
  async function attempt(version){
   if(!wanted||version!==epoch||pending||connection)return;
   if(!online()){status('Sense internet · Es reprendrà automàticament quan torni la connexió');schedule();return}
   const stream=getStream();
   if(!stream?.getVideoTracks().some(t=>t.readyState==='live')){status('Esperant càmera USB · Torna a connectar-la per reprendre el directe');schedule();return}
   // A sentinel also prevents two connection factories racing before either resolves.
   const sentinel={close(){}};pending=sentinel;let candidate;
   try{
    status(failures?'Reprenent el directe automàticament…':'Connectant el directe…');
    candidate=await connect(stream,text=>{if(wanted&&version===epoch)status(text)});
    if(!wanted||version!==epoch){candidate?.close();return}
    pending=candidate;candidate.onClose=()=>{
     if(!wanted||version!==epoch||candidate!==connection&&candidate!==pending)return;
     if(connection===candidate)connection=null;if(pending===candidate)pending=null;
     status('Connexió interrompuda · Reconnexió automàtica activada');notify();schedule();
    };
    await candidate.start();
    if(!wanted||version!==epoch){candidate.onClose=null;candidate.close();return}
    if(candidate.closed)throw Error('La connexió de vídeo s’ha interromput.');
    connection=candidate;pending=null;failures=0;notify();
   }catch(error){
    if(candidate){candidate.onClose=null;candidate.close()}
    if(version!==epoch||!wanted)return;
    pending=null;connection=null;
    if(error.status===401||error.status===403){stop('Sessió o permís no vàlid · Torna a entrar a Administració abans de reprendre');return}
    status((error.message||'No es pot enviar el vídeo')+' · Tornarem a intentar-ho automàticament');notify();schedule();
   }finally{if(pending===sentinel)pending=null}
  }
  return {
   start(){if(wanted)return;wanted=true;epoch++;failures=0;notify();attempt(epoch)},
   stop,
   retry(){if(!wanted||connection||pending)return;cancelTimer();attempt(epoch)},
   get wanted(){return wanted}
  };
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={create};else root.CPoolPublisherRecovery={create};
})(typeof window!=='undefined'?window:globalThis);
