const expandedScoreboards = new Set();

function scoreboardForMatch(m) {
  if (!m.table || !m.top || !m.bottom || m.winner) return null;
  return state.scoreboards?.find(board => String(board.id) === String(m.table) &&
    board.homeName === m.top && board.awayName === m.bottom);
}

function inlineScoreboard(m, attrs, key) {
  const board = scoreboardForMatch(m);
  if (!board) return "";
  const expanded = expandedScoreboards.has(key);
  const rows = ["home", "away"].map(side => {
    const name = board[side + "Name"];
    const score = board[side + "Score"];
    const disabled = busy || board.locked;
    return `<div class="inline-score-row"><span>${esc(name)}</span><strong>${esc(score)}</strong>
      <button type="button" data-action="point" data-side-key="${side}" data-step="-1" ${attrs} ${disabled || score <= 0 ? "disabled" : ""} aria-label="Resta un punt a ${esc(name)}">−</button>
      <button type="button" data-action="point" data-side-key="${side}" data-step="1" ${attrs} ${disabled ? "disabled" : ""} aria-label="Suma un punt a ${esc(name)}">+1</button></div>`;
  }).join("");
  return `<section class="inline-scoreboard"><button class="inline-score-toggle" type="button" data-action="toggle-score" ${attrs} aria-expanded="${expanded}">En joc · Taula ${board.id} · ${board.homeScore}–${board.awayScore}</button>
    ${expanded ? rows + (board.locked ? `<a href="/control?taula=${board.id}">Corregeix el marcador</a>` : "") : ""}</section>`;
}

const root = document.querySelector("#manualBracket"), saveButton = document.querySelector("#saveBracket"), randomButton = document.querySelector("#randomTables"); const rounds = [["r128","Últims 128",64,1],["r64","Últims 64",32,65],["r32","Últims 32",16,97],["r16","Vuitens",8,113],["qf","Quarts",4,121],["sf","Semifinals",2,125],["final","Final",1,127]]; let state = {settings:{},players:[],scoreboards:[],bracketManual:{}}, busy = false, correction = null; const drafts = new Map(), added = new Set(), addValue = "__add_player__", byeValue = "__bye__"; const notice = document.createElement("p"), dialog = document.createElement("dialog"); notice.setAttribute("role","status"); notice.style.cssText = "margin:12px 24px;min-height:24px"; root.before(notice); dialog.className = "bracket-edit-dialog"; document.body.append(dialog); document.head.insertAdjacentHTML("beforeend",'<style>.bracket-edit-dialog{box-sizing:border-box;width:460px;max-width:calc(100% - 24px);max-height:90dvh;overflow:auto;background:#112e41;color:#fff;border:1px solid #53768b;border-radius:8px;padding:24px}.bracket-edit-dialog::backdrop{background:rgba(0,0,0,.7)}.bracket-edit-dialog form,.bracket-edit-dialog label{display:grid;gap:10px}.bracket-edit-dialog h2{font-size:22px;margin:0}.bracket-edit-dialog input,.bracket-edit-dialog select{box-sizing:border-box;width:100%;min-height:44px;background:#fff;color:#172331;border:1px solid #7890a0;border-radius:4px;padding:8px;font-size:16px}.bracket-edit-dialog .dialog-actions{display:flex;flex-wrap:wrap;gap:8px}.bracket-edit-dialog [role=alert]{color:#ffb7b7;margin:0}.manual-match :disabled{opacity:.65}</style>'); function esc(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);} function match(round,index){return state.bracketManual?.[round]?.[index]||{top:"",bottom:"",table:"",winner:"",score:"",topManual:false,bottomManual:false};} function title(round,index){return round==="final"?"Final":round==="qf"?`Quart ${index+1}`:round==="sf"?`Semifinal ${index+1}`:`Partit ${rounds.find(r=>r[0]===round)[3]+index}`;} function names(){let roster=state.players;try{const cached=JSON.parse(localStorage.getItem("cpool-player-list-v1"));if(Array.isArray(cached)&&cached.every(p=>typeof p.name==="string"))roster=cached;}catch(_){}return [...new Set([...added,...roster.map(p=>typeof p==="string"?p:p.name)].map(n=>String(n||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ca"));} function playerOptions(value){const list=names();if(value&&!list.includes(value))list.unshift(value);return '<option value="">Selecciona un jugador</option>'+list.map(n=>`<option value="${esc(n)}" ${n===value?"selected":""}>${esc(n)}</option>`).join("")+`<option value="${byeValue}">Passar directe (sense contrincant)</option><option value="${addValue}">Afegir o esborrar jugadors...</option>`;} function winnerOptions(m,value){return [["","Sense guanyador"],[m.top,m.top],[m.bottom,m.bottom]].filter(([v],i)=>i===0||v).map(([v,label])=>`<option value="${esc(v)}" ${v===value?"selected":""}>${esc(label)}</option>`).join("");} function tableOptions(value){return '<option value="">Sense taula</option>'+[1,2,3,4,5,6].map(n=>`<option value="${n}" ${String(n)===String(value)?"selected":""}>Taula ${n}</option>`).join("");} function selectedPlayer(select,old){if(select.value!==addValue)return select.value;select.value=old||"";window.location.href="/jugadors";return null;} function render(){ if (compactQuadrant) { renderCompactQuadrant(); return; } if(!busy && root.contains(document.activeElement) && document.activeElement.matches("select[data-player-picker]"))return; const active=document.activeElement, focus=active?.dataset.side?{...active.dataset,start:active.selectionStart,end:active.selectionEnd}:null; document.querySelectorAll("[data-tournament-name]").forEach(e=>{e.textContent=state.settings?.tournamentName||"Open la Pobla";}); root.innerHTML=rounds.map(([round,label,count])=>`<section class="manual-round"><h2>${label}</h2><div class="manual-match-list">${Array.from({length:count},(_,index)=>{ const m=match(round,index),d=drafts.get(`${round}:${index}`)||m,locked=Boolean(m.winner),disabled=busy||locked?"disabled":"",attrs=`data-round="${round}" data-index="${index}"`; return `<article class="manual-match"><strong>${title(round,index)}</strong>${locked?`<p class="manual-result">Final: ${esc(m.score)} · Guanya ${esc(m.winner)}</p>`:""}${inlineScoreboard(m, attrs, round + ":" + index)}<label><span>Taula de joc</span><select ${attrs} data-side="table" ${disabled}>${tableOptions(m.table)}</select></label><button class="load-table-button play-match-button" data-action="load" ${attrs} type="button" ${disabled}>Marcar en joc</button>${["top","bottom"].map((side,i)=>`<label><span>Jugador ${i+1}</span><select ${attrs} data-side="${side}" data-player-picker ${disabled}>${playerOptions(m[side])}</select></label>`).join("")}${!locked && Boolean(m.top)!==Boolean(m.bottom)?`<button class="secondary-action" data-action="bye" ${attrs} type="button" ${busy?"disabled":""}>Passar directe</button>`:""}<div class="manual-result-editor"><label><span>Guanyador</span><select ${attrs} data-side="winner" ${disabled}>${winnerOptions(m,d.winner)}</select></label><label><span>Resultat final</span><input ${attrs} data-side="score" value="${esc(d.score||"")}" placeholder="Exemple: 5 - 3" ${disabled}></label><button class="${locked?"rectify-match-button":"primary-action"}" data-action="${locked?"rectify":"finish"}" ${attrs} type="button" ${busy?"disabled":""}>${locked?"Rectificar resultat":"Finalitzar partit"}</button></div></article>`; }).join("")}</div></section>`).join(""); saveButton.disabled=busy;randomButton.disabled=busy; if(focus&&!busy){const next=root.querySelector(`[data-round="${focus.round}"][data-index="${focus.index}"][data-side="${focus.side}"]`);next?.focus({preventScroll:true});if(next?.tagName==="INPUT"&&focus.start!==null)next.setSelectionRange(focus.start,focus.end);} } function load(next){state=next;for(const key of drafts.keys()){const [round,index]=key.split(":");if(match(round,Number(index)).winner)drafts.delete(key);}render();} async function request(url,body){const response=await fetch(url,body===undefined?{cache:"no-store"}:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||"No s'ha pogut guardar el canvi");return data;} async function perform(action){if(busy)return;busy=true;render();notice.textContent="Guardant...";try{await action();notice.textContent="Guardat en directe";}catch(error){notice.textContent=error.message;try{load(await request("/api/state"));}catch(_){}}finally{busy=false;render();}} async function saveMatch(round,index,patch,expected,confirmRectification){const data=await request("/api/bracket-match",{changes:[{round,index,patch,expected}],confirmRectification});if(!data.bracketManual)throw new Error("No s'ha pogut confirmar el canvi");load(data);} root.addEventListener("focusout",event=>{if(event.target.matches("select[data-player-picker]"))setTimeout(()=>render(),0);}); root.addEventListener("input",event=>{const input=event.target.closest('[data-side="score"]');if(!input||input.disabled)return;const key=`${input.dataset.round}:${input.dataset.index}`;drafts.set(key,{...(drafts.get(key)||match(input.dataset.round,Number(input.dataset.index))),score:input.value});}); root.addEventListener("change",event=>{ const input=event.target.closest("[data-side]");if(!input||input.disabled)return; const round=input.dataset.round,index=Number(input.dataset.index),side=input.dataset.side,expected=structuredClone(match(round,index)),key=`${round}:${index}`;if(expected.winner)return; if(side==="winner"||side==="score"){drafts.set(key,{...(drafts.get(key)||expected),[side]:input.value});return;} if(input.matches("[data-player-picker]")&&input.value===byeValue){const other=side==="top"?expected.bottom:expected.top;if(!other){input.value=expected[side]||"";notice.textContent="Selecciona primer el jugador que ha de passar directe";return;}drafts.delete(key);perform(()=>saveMatch(round,index,{[side]:"",[`${side}Manual`]:true,winner:other,score:"Passa directe",table:""},expected));return;} const value=input.matches("[data-player-picker]")?selectedPlayer(input,expected[side]):input.value;if(value===null)return;const patch={[side]:value};if(side==="top"||side==="bottom"){patch[`${side}Manual`]=true;drafts.delete(key);}perform(()=>saveMatch(round,index,patch,expected)); }); root.addEventListener("click",event=>{ const button=event.target.closest("[data-action]");if(!button||button.disabled||busy)return; const round=button.dataset.round,index=Number(button.dataset.index),expected=structuredClone(match(round,index)); if (button.dataset.action === "toggle-score") {
  const key = round + ":" + index;
  if (expandedScoreboards.has(key)) expandedScoreboards.delete(key);
  else expandedScoreboards.add(key);
  render();
  root.querySelector(`[data-action="toggle-score"][data-round="${round}"][data-index="${index}"]`)?.focus({preventScroll:true});
  return;
}
if (button.dataset.action === "point") {
  const board = scoreboardForMatch(expected);
  if (!board || board.locked) return;
  perform(async () => {
    await request(`/api/scoreboards/${board.id}`, {
      point: { round, index, side: button.dataset.sideKey, step: Number(button.dataset.step) }
    });
    load(await request("/api/state"));
  });
  return;
}
if(button.dataset.action==="rectify"){openCorrection(round,index,expected);return;}if(expected.winner)return; if(button.dataset.action==="bye"){if(Boolean(expected.top)===Boolean(expected.bottom)){notice.textContent="Cal un sol jugador i cap contrincant";return;}perform(()=>saveMatch(round,index,{winner:expected.top||expected.bottom,score:"Passa directe",table:""},expected));return;} if(button.dataset.action==="finish"){const d=drafts.get(`${round}:${index}`)||expected,scores=String(d.score||"").match(/^(\d+)\s*[-\u2013\u2014:]\s*(\d+)$/),winner=d.winner||(scores&&Number(scores[1])!==Number(scores[2])?Number(scores[1])>Number(scores[2])?expected.top:expected.bottom:"");if(!winner||!scores){notice.textContent="Indica el resultat final abans de finalitzar el partit";return;}perform(async()=>{await saveMatch(round,index,{winner,score:d.score},expected);drafts.delete(`${round}:${index}`);});return;} if(!expected.table){notice.textContent="Selecciona la taula de joc";return;}perform(async()=>{const next=await request("/api/bracket-load-match",{round,index,table:expected.table});expandedScoreboards.add(round + ":" + index);load(next);}); }); function openCorrection(round,index,m){ correction={round,index,expected:m}; dialog.innerHTML=`<form><h2>Rectificar ${title(round,index).toLowerCase()}</h2>${["top","bottom"].map((side,i)=>`<label><span>Jugador ${i+1}</span><select name="${side}" data-player-picker>${playerOptions(m[side])}</select></label>`).join("")}<label><span>Taula de joc</span><select name="table">${tableOptions(m.table)}</select></label><label><span>Guanyador</span><select name="winner">${winnerOptions(m,m.winner)}</select></label><label><span>Resultat final</span><input name="score" value="${esc(m.score)}" placeholder="Exemple: 5 - 3"></label><p role="alert"></p><div class="dialog-actions"><button class="primary-action" type="submit">Guardar rectificació</button><button class="secondary-action" type="button" data-cancel>Cancel·lar</button></div></form>`; dialog.showModal();dialog.querySelector('[name="pin"]').focus(); } dialog.addEventListener("click",event=>{if(event.target.closest("[data-cancel]"))dialog.close();}); dialog.addEventListener("close",()=>{dialog.innerHTML="";correction=null;}); dialog.addEventListener("change",event=>{const select=event.target.closest("[data-player-picker]");if(!select||!correction)return;const form=dialog.querySelector("form"),winner=form.elements.winner.value,old=select.dataset.previous||correction.expected[select.name],value=select.value===byeValue?"":selectedPlayer(select,old);if(value===null)return;select.value=value;select.dataset.previous=value;form.elements.winner.innerHTML=winnerOptions({top:form.elements.top.value,bottom:form.elements.bottom.value},winner===old?value:winner);}); dialog.addEventListener("submit",async event=>{ event.preventDefault();if(!correction)return;const form=event.target,details=correction,fields=form.elements,patch={top:fields.top.value,bottom:fields.bottom.value,table:fields.table.value,winner:fields.winner.value,score:fields.winner.value?fields.score.value:"",topManual:fields.top.value!==details.expected.top||details.expected.topManual,bottomManual:fields.bottom.value!==details.expected.bottom||details.expected.bottomManual},button=form.querySelector('[type="submit"]');button.disabled=true; try{await saveMatch(details.round,details.index,patch,details.expected,true);notice.textContent="Rectificació guardada i partit bloquejat";dialog.close();}catch(error){form.querySelector('[role="alert"]').textContent=error.message;button.disabled=false;} }); saveButton.addEventListener("click",()=>perform(async()=>{ for(const [key,draft] of [...drafts]){const [round,position]=key.split(":"),index=Number(position),expected=structuredClone(match(round,index));if(expected.winner)continue;if(draft.winner)await saveMatch(round,index,{winner:draft.winner,score:draft.score},expected);else await saveMatch(round,index,{score:draft.score},expected);drafts.delete(key);}load(await request("/api/state")); })); randomButton.addEventListener("click",()=>perform(async()=>{const data=await request("/api/bracket-random-tables",{});load(data.state);})); async function init(){load(await request("/api/state"));const events=new EventSource("/api/events");events.onmessage=event=>load(JSON.parse(event.data));events.onerror=()=>request("/api/state").then(load).catch(()=>{notice.textContent="Reconnectant...";});} const pageSize = 8;
const compactQuadrant = !new URLSearchParams(location.search).has("detall");
let matchPage = 0;
let showProgress = false;
let playerSlot;
const playerDialog = document.createElement("dialog");

function renderCompactQuadrant() {
  const [firstRound, label, total] = rounds[0];
  const first = matchPage * pageSize;
  const last = Math.min(first + pageSize, total);
  const pages = Math.ceil(total / pageSize);
  const cards = Array.from({length: last - first}, (_, offset) => {
    const index = first + offset;
    const m = match(firstRound, index);
    const slots = ["top", "bottom"].map((side, position) => {
      const name = m[side] || "+ Jugador";
      return `<button type="button" data-grid-slot="${side}" data-index="${index}" ${busy || m.winner ? "disabled" : ""} aria-label="${title(firstRound, index)}, jugador ${position + 1}: ${esc(name)}">${esc(name)}</button>`;
    }).join("");
    return `<article class="quadrant-grid-card"><h3>${title(firstRound, index)}</h3>${slots}${m.score ? `<small>${esc(m.score)}</small>` : ""}</article>`;
  }).join("");
  const progress = showProgress ? rounds.slice(1).map(([round, heading, count]) => {
    const matches = Array.from({length: count}, (_, index) => {
      const m = match(round, index);
      return `<li><strong>${title(round, index)}</strong><span>${esc(m.top || "Pendent de guanyador")} · ${esc(m.bottom || "Pendent de guanyador")}</span>${m.score ? `<small>${esc(m.score)}</small>` : ""}</li>`;
    }).join("");
    return `<section><h3>${heading}</h3><ul>${matches}</ul></section>`;
  }).join("") : "";
  root.innerHTML = `<section class="quadrant-grid-round">
    <header><h2>${label}</h2><p>Partits ${first + 1}–${last} de ${total}</p></header>
    <div class="quadrant-grid-cards">${cards}</div>
    <nav class="quadrant-grid-actions" aria-label="Pàgines dels Últims 128">
      <button type="button" data-grid-page="-1" aria-label="Pàgina anterior" ${busy || matchPage === 0 ? "disabled" : ""}>‹</button>
      <span>${matchPage + 1} de ${pages}</span>
      <button type="button" data-grid-page="1" aria-label="Pàgina següent" ${busy || matchPage + 1 === pages ? "disabled" : ""}>›</button>
      <button type="button" data-grid-next ${busy || !nextEmptySlot() ? "disabled" : ""}>Omple següent</button>
    </nav>
    <details class="quadrant-grid-progress" ${showProgress ? "open" : ""}>
      <summary>Seguiment fins a la final</summary><div>${progress}</div>
    </details>
  </section>`;
  root.querySelector(".quadrant-grid-progress").addEventListener("toggle", event => {
    if (showProgress === event.currentTarget.open) return;
    showProgress = event.currentTarget.open;
    renderCompactQuadrant();
    root.querySelector(".quadrant-grid-progress summary")?.focus({preventScroll: true});
  });
}

function nextEmptySlot(start = 0) {
  const [round, , count] = rounds[0];
  for (let offset = 0; offset < count * 2; offset++) {
    const slot = (start + offset) % (count * 2);
    const index = Math.floor(slot / 2);
    const side = slot % 2 ? "bottom" : "top";
    const m = match(round, index);
    if (!m.winner && !m[side]) return {index, side};
  }
  return null;
}

function openPlayerSlot(index, side, continueFilling = false) {
  const [round] = rounds[0];
  const expected = structuredClone(match(round, index));
  if (busy || expected.winner) return;
  playerSlot = {round, index, side, continueFilling, expected};
  playerDialog.querySelector("h2").textContent = `${title(round, index)} · Jugador ${side === "top" ? 1 : 2}`;
  const input = playerDialog.querySelector("input");
  input.value = "";
  playerDialog.querySelector("[data-clear-player]").hidden = !expected[side];
  renderPlayerChoices();
  if (!playerDialog.open) playerDialog.showModal();
  input.focus();
}

function renderPlayerChoices() {
  const normalize = value => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("ca");
  const filter = normalize(playerDialog.querySelector("input").value.trim());
  const otherSide = playerSlot.side === "top" ? "bottom" : "top";
  const candidates = names().filter(name => name !== playerSlot.expected[otherSide] && normalize(name).includes(filter));
  playerDialog.querySelector(".quadrant-player-choices").innerHTML = candidates.map(name =>
    `<button type="button" data-player-name="${esc(name)}">${esc(name)}</button>`).join("") || "<p>Cap jugador coincideix amb la cerca.</p>";
}

if (compactQuadrant) {
  document.body.classList.add("quadrant-compact");
  playerDialog.className = "quadrant-player-picker";
  playerDialog.setAttribute("aria-labelledby", "quadrantPickerTitle");
  playerDialog.innerHTML = `<div class="quadrant-picker-header"><h2 id="quadrantPickerTitle"></h2><button type="button" data-close-picker aria-label="Tanca">×</button></div>
    <label>Cerca jugador<input type="search" autocomplete="off"></label>
    <div class="quadrant-player-choices"></div>
    <button type="button" data-clear-player>Treu aquest jugador</button>`;
  document.body.append(playerDialog);
  playerDialog.querySelector("input").addEventListener("input", renderPlayerChoices);
  playerDialog.addEventListener("click", async event => {
    if (event.target.closest("[data-close-picker]")) {
      playerDialog.close();
      return;
    }
    const picked = event.target.closest("[data-player-name]");
    const clear = event.target.closest("[data-clear-player]");
    if ((!picked && !clear) || busy) return;
    const {round, index, side, expected, continueFilling} = playerSlot;
    const name = picked?.dataset.playerName ?? "";
    playerDialog.close();
    if (name === expected[side]) return;
    let saved = false;
    await perform(async () => {
      await saveMatch(round, index, {[side]: name, [side + "Manual"]: true}, expected);
      drafts.delete(round + ":" + index);
      saved = true;
    });
    if (!saved || !name) return;
    const next = continueFilling ? nextEmptySlot(index * 2 + (side === "top" ? 1 : 2)) :
      side === "top" && !match(round, index).bottom ? {index, side: "bottom"} : null;
    if (next) {
      matchPage = Math.floor(next.index / pageSize);
      renderCompactQuadrant();
      openPlayerSlot(next.index, next.side, continueFilling);
    }
  });
  root.addEventListener("click", event => {
    const slot = event.target.closest("[data-grid-slot]");
    const page = event.target.closest("[data-grid-page]");
    if (busy) return;
    if (slot) {
      openPlayerSlot(Number(slot.dataset.index), slot.dataset.gridSlot);
    } else if (page) {
      matchPage += Number(page.dataset.gridPage);
      renderCompactQuadrant();
      root.querySelector(`[data-grid-page="${page.dataset.gridPage}"]:not(:disabled)`)?.focus({preventScroll: true});
    } else if (event.target.closest("[data-grid-next]")) {
      const next = nextEmptySlot();
      if (!next) return;
      matchPage = Math.floor(next.index / pageSize);
      renderCompactQuadrant();
      openPlayerSlot(next.index, next.side, true);
    }
  });
}

init().catch(error=>{notice.textContent=error.message;});
