/* ============================================================
   MAPEAMENTO URBANO INTELIGENTE — SMTT Cacequi
   App single-file, PWA offline-first, sem APIs externas pagas.
   ============================================================ */

/* ---------- DADOS BASE / REGRAS ---------- */
const CATS = {
  "Pavimentação": ["Buraco","Afundamento","Trinca","Calçamento solto","Desgaste do asfalto","Erosão","Meio-fio danificado"],
  "Drenagem": ["Bueiro entupido","Boca de lobo danificada","Acúmulo de água","Falta de drenagem","Tubulação obstruída"],
  "Tubulação": ["Vazamento","Rompimento","Tubulação exposta","Necessidade de substituição","Necessidade de ampliação"],
  "Sinalização": ["Placa danificada","Placa ausente","Faixa apagada","Quebra-molas sem sinalização","Semáforo com defeito"],
  "Acessibilidade": ["Calçada danificada","Falta de rampa","Piso tátil ausente","Obstáculo em passeio público"],
  "Iluminação": ["Lâmpada queimada","Poste danificado","Falta de iluminação"],
  "Arborização": ["Galhos obstruindo via","Árvore com risco de queda","Necessidade de poda"],
  "Outros": ["Outro (descrever)"]
};

// motor de classificação por regras: subcategoria -> {urgencia, secretaria, servico}
const RULES = {
  "Buraco":{u:"Alta",sec:"SMTT / Obras",serv:"Tapa-buraco"},
  "Afundamento":{u:"Alta",sec:"Obras",serv:"Recapeamento localizado"},
  "Trinca":{u:"Média",sec:"Obras",serv:"Selagem de trincas"},
  "Calçamento solto":{u:"Média",sec:"Obras",serv:"Reassentamento de paralelepípedos"},
  "Desgaste do asfalto":{u:"Baixa",sec:"Obras",serv:"Recapeamento programado"},
  "Erosão":{u:"Alta",sec:"Obras / Drenagem",serv:"Contenção de erosão"},
  "Meio-fio danificado":{u:"Média",sec:"Obras",serv:"Reconstrução de meio-fio"},

  "Bueiro entupido":{u:"Alta",sec:"Saneamento",serv:"Desobstrução de bueiro"},
  "Boca de lobo danificada":{u:"Alta",sec:"Saneamento",serv:"Reparo estrutural"},
  "Acúmulo de água":{u:"Alta",sec:"Saneamento",serv:"Drenagem emergencial"},
  "Falta de drenagem":{u:"Média",sec:"Saneamento / Obras",serv:"Projeto de drenagem"},
  "Tubulação obstruída":{u:"Alta",sec:"Saneamento",serv:"Desobstrução de tubulação"},

  "Vazamento":{u:"Alta",sec:"Saneamento / Concessionária",serv:"Reparo de vazamento"},
  "Rompimento":{u:"Emergencial",sec:"Saneamento",serv:"Reparo emergencial"},
  "Tubulação exposta":{u:"Alta",sec:"Saneamento",serv:"Cobertura e reparo"},
  "Necessidade de substituição":{u:"Média",sec:"Saneamento",serv:"Substituição programada"},
  "Necessidade de ampliação":{u:"Baixa",sec:"Saneamento",serv:"Projeto de ampliação"},

  "Placa danificada":{u:"Média",sec:"SMTT",serv:"Substituição de placa"},
  "Placa ausente":{u:"Média",sec:"SMTT",serv:"Instalação de placa"},
  "Faixa apagada":{u:"Média",sec:"SMTT",serv:"Repintura de faixa"},
  "Quebra-molas sem sinalização":{u:"Alta",sec:"SMTT",serv:"Sinalização de quebra-molas"},
  "Semáforo com defeito":{u:"Emergencial",sec:"SMTT",serv:"Manutenção de semáforo"},

  "Calçada danificada":{u:"Média",sec:"Obras",serv:"Reparo de calçada"},
  "Falta de rampa":{u:"Média",sec:"Obras",serv:"Instalação de rampa de acessibilidade"},
  "Piso tátil ausente":{u:"Média",sec:"Obras",serv:"Instalação de piso tátil"},
  "Obstáculo em passeio público":{u:"Alta",sec:"Fiscalização",serv:"Remoção de obstáculo"},

  "Lâmpada queimada":{u:"Alta",sec:"Iluminação Pública",serv:"Troca de lâmpada"},
  "Poste danificado":{u:"Alta",sec:"Iluminação Pública",serv:"Reparo/substituição de poste"},
  "Falta de iluminação":{u:"Média",sec:"Iluminação Pública",serv:"Instalação de novo ponto"},

  "Galhos obstruindo via":{u:"Alta",sec:"Meio Ambiente",serv:"Poda de galhos"},
  "Árvore com risco de queda":{u:"Emergencial",sec:"Meio Ambiente / Defesa Civil",serv:"Poda ou remoção emergencial"},
  "Necessidade de poda":{u:"Baixa",sec:"Meio Ambiente",serv:"Poda programada"},

  "Outro (descrever)":{u:"Baixa",sec:"A definir",serv:"Avaliação técnica"}
};

const PRAZOS = {"Baixa":"30 dias","Média":"15 dias","Alta":"7 dias","Emergencial":"24 horas"};
const URG_ORDER = ["Emergencial","Alta","Média","Baixa"];
const ICV_WEIGHTS = {"Pavimentação":40,"Drenagem":25,"Sinalização":20,"Acessibilidade":15};
const URG_PENALTY = {"Emergencial":0.28,"Alta":0.16,"Média":0.08,"Baixa":0.03};
const CENTER = [-29.876, -54.822]; // Cacequi, RS

/* ---------- STORAGE ---------- */
const DB = {
  get(key, fallback){ try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }catch(e){ return fallback; } },
  set(key, val){ try{ localStorage.setItem(key, JSON.stringify(val)); return true; }catch(e){ alert("Armazenamento cheio ou indisponível. Tente remover fotos antigas."); return false; } }
};
function getVistorias(){ return DB.get("mui_vistorias", []); }
function saveVistorias(v){ return DB.set("mui_vistorias", v); }
function getOS(){ return DB.get("mui_os", []); }
function saveOS(v){ return DB.set("mui_os", v); }
function getServidor(){ return DB.get("mui_servidor", ""); }
function setServidor(n){ DB.set("mui_servidor", n); }

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function fmtDate(iso){ const d = new Date(iso); return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}); }
function badgeClass(u){ return {"Baixa":"badge-baixa","Média":"badge-media","Alta":"badge-alta","Emergencial":"badge-emergencial"}[u] || "badge-status"; }
function markerColor(v){
  if(v.status === "Concluído") return "#22C55E";
  if(v.urgencia === "Emergencial") return "#EF4444";
  if(v.urgencia === "Alta") return "#F97316";
  return "#EAB308";
}

/* ---------- ESTADO ---------- */
let STATE = { tab:"vistoria", editingPhotos: [], gps:null, mapInstance:null, mapMarkers:[] };

/* ---------- NAVEGAÇÃO ---------- */
const TAB_TITLES = { vistoria:"Vistoria", mapa:"Mapa Interativo", dashboard:"Painel Gerencial", icv:"Índice de Conservação Viária", os:"Ordens de Serviço", relatorios:"Relatórios" };

function setTab(tab){
  STATE.tab = tab;
  document.getElementById("pagetitle").textContent = TAB_TITLES[tab];
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active", b.dataset.tab===tab));
  document.getElementById("fabNew").style.display = tab==="vistoria" ? "flex" : "none";
  render();
}
document.querySelectorAll(".nav-btn").forEach(b=> b.addEventListener("click", ()=> setTab(b.dataset.tab)) );
document.getElementById("fabNew").addEventListener("click", ()=>{ STATE.editingPhotos=[]; STATE.gps=null; renderVistoriaForm(true); });

function render(){
  const c = document.getElementById("content");
  c.innerHTML = "";
  if(STATE.tab==="vistoria") renderVistoriaHome();
  else if(STATE.tab==="mapa") renderMapa();
  else if(STATE.tab==="dashboard") renderDashboard();
  else if(STATE.tab==="icv") renderICV();
  else if(STATE.tab==="os") renderOSView();
  else if(STATE.tab==="relatorios") renderRelatorios();
}

/* ============================================================
   MÓDULO 1 — VISTORIA EM CAMPO
   ============================================================ */
function renderVistoriaHome(){
  const c = document.getElementById("content");
  const list = getVistorias().slice().reverse();
  const card = el("div");

  const servidor = getServidor();
  const idCard = el("div","card");
  idCard.innerHTML = `<div class="section-title">Servidor responsável</div>
    <input id="inpServidorTop" placeholder="Seu nome" value="${escapeHtml(servidor)}">`;
  idCard.querySelector("#inpServidorTop").addEventListener("change", e=> setServidor(e.target.value));
  card.appendChild(idCard);

  const startCard = el("div","card");
  startCard.innerHTML = `<div class="row">
      <button class="btn btn-primary" id="btnNovaVistoria">➕ Nova vistoria</button>
      <button class="btn btn-outline" id="btnLevantamento">🚩 Modo levantamento</button>
    </div>
    <div class="hint">O modo levantamento mantém o formulário aberto para fotografar rua por rua sem sair da tela, útil para o "Levantamento Completo da Cidade".</div>`;
  startCard.querySelector("#btnNovaVistoria").addEventListener("click", ()=>{ STATE.editingPhotos=[]; STATE.gps=null; renderVistoriaForm(false); });
  startCard.querySelector("#btnLevantamento").addEventListener("click", ()=>{ STATE.editingPhotos=[]; STATE.gps=null; renderVistoriaForm(true); });
  card.appendChild(startCard);

  const listCard = el("div","card");
  listCard.innerHTML = `<div class="section-title">Ocorrências registradas (${list.length})</div>`;
  if(list.length===0){
    listCard.innerHTML += `<div class="empty"><div class="big">📭</div>Nenhuma vistoria ainda.<br>Toque em "Nova vistoria" para começar.</div>`;
  } else {
    list.slice(0,50).forEach(v=>{
      const li = el("div","list-item");
      li.innerHTML = `<div class="li-top">
          <div>
            <div class="li-title">${escapeHtml(v.rua)}${v.numero? ", "+escapeHtml(v.numero):""}</div>
            <div class="li-sub">${escapeHtml(v.bairro)} · ${escapeHtml(v.subcategoria)}</div>
          </div>
          <span class="badge ${badgeClass(v.urgencia)}">${v.urgencia}</span>
        </div>
        <div class="li-sub">${fmtDate(v.timestamp)} · ${escapeHtml(v.servidor||"—")} · <b>${v.status}</b></div>
        ${v.fotos && v.fotos.length ? `<div class="thumbs">${v.fotos.slice(0,4).map(f=>`<img class="thumb" src="${f}">`).join("")}</div>` : ""}
        <div class="row" style="margin-top:8px;">
          <button class="btn btn-outline btn-sm" data-act="ver" data-id="${v.id}">Ver detalhes</button>
          <button class="btn btn-outline btn-sm" data-act="os" data-id="${v.id}">Gerar OS</button>
          <button class="btn btn-outline btn-sm" data-act="concluir" data-id="${v.id}">${v.status==="Concluído"?"Reabrir":"Concluir"}</button>
        </div>`;
      listCard.appendChild(li);
    });
    listCard.addEventListener("click", (e)=>{
      const btn = e.target.closest("button[data-act]");
      if(!btn) return;
      const id = btn.dataset.id;
      const arr = getVistorias();
      const idx = arr.findIndex(x=>x.id===id);
      if(idx<0) return;
      if(btn.dataset.act==="ver") renderVistoriaDetail(arr[idx]);
      if(btn.dataset.act==="concluir"){ arr[idx].status = arr[idx].status==="Concluído" ? "Pendente" : "Concluído"; saveVistorias(arr); render(); }
      if(btn.dataset.act==="os"){ gerarOSDeVistoria(arr[idx]); setTab("os"); }
    });
  }
  card.appendChild(listCard);
  c.appendChild(card);
}

function renderVistoriaDetail(v){
  const c = document.getElementById("content");
  c.innerHTML = "";
  const card = el("div","card");
  card.innerHTML = `
    <button class="btn btn-outline btn-sm" id="btnBack" style="width:auto;margin-bottom:12px;">← Voltar</button>
    <h3>${escapeHtml(v.categoria)} · ${escapeHtml(v.subcategoria)}</h3>
    <span class="badge ${badgeClass(v.urgencia)}">${v.urgencia} · prazo ${PRAZOS[v.urgencia]}</span>
    <div class="kv"><span>Data</span><b>${fmtDate(v.timestamp)}</b></div>
    <div class="kv"><span>Servidor</span><b>${escapeHtml(v.servidor||"—")}</b></div>
    <div class="kv"><span>Bairro</span><b>${escapeHtml(v.bairro)}</b></div>
    <div class="kv"><span>Rua</span><b>${escapeHtml(v.rua)} ${escapeHtml(v.numero||"")}</b></div>
    <div class="kv"><span>Coordenadas GPS</span><b>${v.lat? v.lat.toFixed(5)+", "+v.lng.toFixed(5) : "não capturado"}</b></div>
    <div class="kv"><span>Secretaria responsável</span><b>${escapeHtml(v.secretaria)}</b></div>
    <div class="kv"><span>Serviço sugerido</span><b>${escapeHtml(v.servico)}</b></div>
    <div class="kv"><span>Status</span><b>${v.status}</b></div>
    ${v.observacoes? `<label>Observações</label><div>${escapeHtml(v.observacoes)}</div>`:""}
    ${v.fotos && v.fotos.length? `<label>Fotos</label><div class="thumbs">${v.fotos.map(f=>`<img class="thumb" style="width:90px;height:90px;" src="${f}">`).join("")}</div>`:""}
  `;
  card.querySelector("#btnBack").addEventListener("click", ()=> render());
  c.appendChild(card);
}

function renderVistoriaForm(levantamentoMode){
  const c = document.getElementById("content");
  c.innerHTML = "";
  const wrap = el("div");

  const form = el("div","card");
  form.innerHTML = `
    <button class="btn btn-outline btn-sm" id="btnCancelar" style="width:auto;margin-bottom:12px;">← Voltar</button>
    <div class="section-title">Localização</div>
    <button class="btn btn-dark" id="btnGPS" type="button">📍 Capturar GPS</button>
    <div id="gpsResult" class="hint"></div>
    <label>Bairro</label><input id="fBairro" placeholder="Ex: Centro">
    <label>Rua</label><input id="fRua" placeholder="Ex: Rua XV de Novembro">
    <label>Número aproximado</label><input id="fNumero" placeholder="Ex: 450 (opcional)">

    <div class="section-title" style="margin-top:18px;">Categoria da ocorrência</div>
    <div class="chip-group" id="chipsCat"></div>
    <div id="chipsSub" style="margin-top:10px;"></div>

    <div id="suggestBox"></div>

    <label>Fotos</label>
    <input type="file" id="fFotos" accept="image/*" capture="environment">
    <div class="thumbs" id="fotosPreview"></div>

    <label>Vídeo curto (opcional)</label>
    <input type="file" id="fVideo" accept="video/*" capture="environment">
    <div id="videoName" class="hint"></div>

    <label>Observações técnicas</label>
    <textarea id="fObs" placeholder="Detalhes adicionais sobre a ocorrência..."></textarea>

    <button class="btn btn-primary" id="btnSalvar" style="margin-top:16px;">💾 Salvar vistoria</button>
    ${levantamentoMode ? `<div class="hint">Modo levantamento ativo: após salvar, o formulário reabre automaticamente para a próxima rua.</div>`:""}
  `;
  wrap.appendChild(form);
  c.appendChild(wrap);

  let selCat = null, selSub = null;

  document.getElementById("btnCancelar").addEventListener("click", ()=>{
    STATE.editingPhotos.forEach(item=> URL.revokeObjectURL(item.url));
    STATE.editingPhotos = [];
    render();
  });

  function tentarGPS(){
    const res = document.getElementById("gpsResult");
    if(!navigator.geolocation){ res.innerHTML = "Geolocalização não suportada neste dispositivo."; return; }
    res.innerHTML = "Obtendo localização...";
    navigator.geolocation.getCurrentPosition(pos=>{
      STATE.gps = {lat:pos.coords.latitude, lng:pos.coords.longitude};
      res.innerHTML = `✅ ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
    }, err=>{
      if(err.code === err.PERMISSION_DENIED){
        res.innerHTML = `⚠️ Permissão de localização negada.
          <div class="hint" style="margin-top:6px;">
            Toque no ícone de cadeado 🔒 ao lado do endereço no navegador → <b>Permissões</b> → <b>Localização</b> → <b>Permitir</b>. Depois toque em "Tentar novamente".<br>
            No Android também pode liberar em: Configurações → Apps → Chrome → Permissões → Localização.
          </div>
          <button class="btn btn-outline btn-sm" id="btnGPSRetry" type="button" style="margin-top:8px;width:auto;">🔄 Tentar novamente</button>
          <div class="hint" style="margin-top:6px;">Você também pode continuar sem GPS — a vistoria será salva, mas não aparecerá no módulo Mapa.</div>`;
        document.getElementById("btnGPSRetry").addEventListener("click", tentarGPS);
      } else {
        res.innerHTML = "Não foi possível obter o GPS: " + err.message + `<div class="hint" style="margin-top:4px;">Verifique se o GPS do aparelho está ligado e tente novamente.</div>`;
      }
    }, {enableHighAccuracy:true, timeout:10000});
  }
  document.getElementById("btnGPS").addEventListener("click", tentarGPS);

  const chipsCat = document.getElementById("chipsCat");
  Object.keys(CATS).forEach(cat=>{
    const chip = el("button","chip"); chip.type="button"; chip.textContent = cat;
    chip.addEventListener("click", ()=>{
      selCat = cat; selSub = null;
      chipsCat.querySelectorAll(".chip").forEach(x=>x.classList.remove("active"));
      chip.classList.add("active");
      renderSubchips(cat);
      document.getElementById("suggestBox").innerHTML = "";
    });
    chipsCat.appendChild(chip);
  });

  function renderSubchips(cat){
    const box = document.getElementById("chipsSub");
    box.innerHTML = `<label>Subcategoria</label><div class="chip-group" id="chipsSub2"></div>`;
    const g = document.getElementById("chipsSub2");
    CATS[cat].forEach(sub=>{
      const chip = el("button","chip"); chip.type="button"; chip.textContent = sub;
      chip.addEventListener("click", ()=>{
        selSub = sub;
        g.querySelectorAll(".chip").forEach(x=>x.classList.remove("active"));
        chip.classList.add("active");
        const rule = RULES[sub] || {u:"Baixa",sec:"A definir",serv:"Avaliação técnica"};
        document.getElementById("suggestBox").innerHTML = `
          <div class="suggest-box">
            <b>🤖 Assistente interno sugere:</b>
            <div class="kv"><span>Categoria</span><b>${cat}</b></div>
            <div class="kv"><span>Urgência</span><b>${rule.u} (prazo ${PRAZOS[rule.u]})</b></div>
            <div class="kv"><span>Secretaria responsável</span><b>${rule.sec}</b></div>
            <div class="kv"><span>Serviço necessário</span><b>${rule.serv}</b></div>
          </div>`;
      });
      g.appendChild(chip);
    });
  }

  const MAX_FOTOS = 8;
  document.getElementById("fFotos").addEventListener("change", async (e)=>{
    const file = e.target.files[0];
    e.target.value = "";
    if(!file) return;
    if(STATE.editingPhotos.length >= MAX_FOTOS){
      alert(`Limite de ${MAX_FOTOS} fotos por vistoria atingido. Remova alguma foto ou finalize e crie uma nova vistoria para o restante.`);
      return;
    }
    const preview = document.getElementById("fotosPreview");
    const status = el("div","hint"); status.id="fotosStatus";
    preview.parentNode.insertBefore(status, preview);
    status.textContent = "Processando foto...";
    try{
      const blob = await compressImageToBlob(file);
      STATE.editingPhotos.push({ blob, url: URL.createObjectURL(blob) });
    }catch(err){
      console.error("Erro ao processar foto:", err);
      alert("Não foi possível processar essa foto. Tente novamente.");
    }
    status.remove();
    renderFotosPreview();
  });
  function renderFotosPreview(){
    const box = document.getElementById("fotosPreview");
    box.innerHTML = "";
    STATE.editingPhotos.forEach((item, i)=>{
      const d = el("div","thumb-x");
      d.innerHTML = `<img class="thumb" src="${item.url}"><button data-i="${i}">×</button>`;
      d.querySelector("button").addEventListener("click", ()=>{
        URL.revokeObjectURL(item.url);
        STATE.editingPhotos.splice(i,1);
        renderFotosPreview();
      });
      box.appendChild(d);
    });
    const countHint = el("div","hint");
    countHint.textContent = `${STATE.editingPhotos.length} de ${MAX_FOTOS} fotos`;
    box.parentNode.insertBefore(countHint, box.nextSibling);
  }

  let videoData = null;
  document.getElementById("fVideo").addEventListener("change", (e)=>{
    const f = e.target.files[0];
    if(f){ videoData = f.name; document.getElementById("videoName").textContent = "🎥 " + f.name + " anexado (vídeos não são convertidos para reduzir o uso de armazenamento local)."; }
  });

  function limparFotosEmEdicao(){
    STATE.editingPhotos.forEach(item=> URL.revokeObjectURL(item.url));
    STATE.editingPhotos = [];
  }

  document.getElementById("btnSalvar").addEventListener("click", async ()=>{
    const bairro = document.getElementById("fBairro").value.trim();
    const rua = document.getElementById("fRua").value.trim();
    if(!rua || !bairro){ alert("Informe ao menos o bairro e a rua."); return; }
    if(!selCat || !selSub){ alert("Selecione categoria e subcategoria."); return; }
    const btnSalvar = document.getElementById("btnSalvar");
    btnSalvar.disabled = true;
    btnSalvar.textContent = "Salvando...";
    const rule = RULES[selSub] || {u:"Baixa",sec:"A definir",serv:"Avaliação técnica"};
    let fotosBase64 = [];
    try{
      fotosBase64 = await Promise.all(STATE.editingPhotos.map(item=> blobToDataURL(item.blob)));
    }catch(err){
      alert("Erro ao preparar as fotos para salvar. Tente novamente.");
      btnSalvar.disabled = false; btnSalvar.textContent = "💾 Salvar vistoria";
      return;
    }
    const rec = {
      id: uid(),
      timestamp: new Date().toISOString(),
      servidor: getServidor(),
      bairro, rua,
      numero: document.getElementById("fNumero").value.trim(),
      lat: STATE.gps ? STATE.gps.lat : null,
      lng: STATE.gps ? STATE.gps.lng : null,
      categoria: selCat, subcategoria: selSub,
      urgencia: rule.u, secretaria: rule.sec, servico: rule.serv,
      prazo: PRAZOS[rule.u],
      observacoes: document.getElementById("fObs").value.trim(),
      fotos: fotosBase64,
      video: videoData,
      status: "Pendente",
      modo: levantamentoMode ? "levantamento" : "avulsa"
    };
    const arr = getVistorias(); arr.push(rec);
    if(!saveVistorias(arr)){ btnSalvar.disabled = false; btnSalvar.textContent = "💾 Salvar vistoria"; return; }
    limparFotosEmEdicao();
    if(levantamentoMode){
      STATE.gps = null;
      renderVistoriaForm(true);
    } else {
      setTab("vistoria");
    }
  });
}

function blobToDataURL(blob){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ()=> resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Comprime evitando carregar a foto original inteira como texto base64 na memória
// (fotos de câmeras atuais podem ter 10-15MB, o que travava o Chrome em aparelhos
// com menos RAM). createImageBitmap decodifica direto do arquivo binário, e o
// resultado fica como Blob (mais leve para pré-visualização via object URL) —
// só vira texto base64 no momento de salvar a vistoria.
async function compressImageToBlob(file){
  const maxW = 780;
  try{
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxW / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.6));
    if(blob) return blob;
    throw new Error("toBlob falhou");
  }catch(e){
    // fallback para navegadores sem createImageBitmap (mais lento, mas funcional)
    return new Promise((resolve, reject)=>{
      const reader = new FileReader();
      reader.onload = (ev)=>{
        const img = new Image();
        img.onload = ()=>{
          const scale = Math.min(1, maxW / img.width);
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(b=> b ? resolve(b) : reject(new Error("toBlob falhou")), "image/jpeg", 0.6);
        };
        img.onerror = ()=> reject(new Error("Não foi possível decodificar a imagem."));
        img.src = ev.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

function el(tag, cls){ const e = document.createElement(tag); if(cls) e.className = cls; return e; }
function escapeHtml(s){ return (s||"").toString().replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m])); }

/* ============================================================
   MÓDULO — MAPA INTERATIVO (Google Maps)
   ============================================================ */
const GOOGLE_MAPS_API_KEY = "AIzaSyA2Ad_NSKZc49YYX-GZ1NPbGzXKJ5NTPr4";
let _gmapsLoadPromise = null;
let _gmapsAuthError = null;
window.gm_authFailure = function(){
  _gmapsAuthError = "O Google recusou a chave de API (erro de autenticação). Causas mais comuns: faturamento não ativado no projeto do Google Cloud, a API 'Maps JavaScript API' não está habilitada para essa chave, ou a restrição de domínio (HTTP referrer) não inclui este site.";
  const box = document.getElementById("mapa-el");
  if(box){
    box.style.display = "flex";
    box.innerHTML = `<div class="empty" style="width:100%;"><div class="big">⚠️</div>${escapeHtml(_gmapsAuthError)}</div>`;
  }
};
function loadGoogleMaps(){
  if(window.google && window.google.maps) return Promise.resolve();
  if(_gmapsLoadPromise) return _gmapsLoadPromise;
  _gmapsLoadPromise = new Promise((resolve, reject)=>{
    window.__onGMapsReady = ()=>{
      setTimeout(()=>{
        if(_gmapsAuthError) reject(new Error(_gmapsAuthError));
        else resolve();
      }, 150);
    };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=__onGMapsReady&loading=async&v=weekly`;
    s.async = true;
    s.onerror = ()=> reject(new Error("Falha ao carregar o Google Maps. Verifique a conexão com a internet."));
    document.head.appendChild(s);
  });
  return _gmapsLoadPromise;
}

async function renderMapa(){
  const c = document.getElementById("content");
  const card = el("div","card");
  card.style.padding = "12px 8px 14px";
  card.innerHTML = `<div class="section-title" style="padding:0 6px;">Ocorrências no mapa</div><div id="mapa-el" style="display:flex;align-items:center;justify-content:center;color:var(--texto-suave);">Carregando mapa...</div>
    <div class="hint" style="margin-top:8px;padding:0 6px;">🟢 Resolvido &nbsp; 🟡 Aguardando &nbsp; 🟠 Alta prioridade &nbsp; 🔴 Emergencial</div>`;
  c.appendChild(card);

  const vistorias = getVistorias().filter(v=> v.lat && v.lng);

  try{
    await Promise.race([
      loadGoogleMaps(),
      new Promise((_,reject)=> setTimeout(()=> reject(new Error("O Google Maps demorou demais para responder. Verifique sua conexão com a internet e tente novamente.")), 12000))
    ]);
  }catch(e){
    document.getElementById("mapa-el").innerHTML = `<div class="empty" style="width:100%;"><div class="big">⚠️</div>${escapeHtml(e.message)}</div>`;
    return;
  }
  if(STATE.tab !== "mapa") return; // usuário já saiu da aba enquanto carregava

  const mapaEl = document.getElementById("mapa-el");
  if(!mapaEl) return;
  mapaEl.style.display = "";
  mapaEl.innerHTML = "";

  let map;
  try{
    map = new google.maps.Map(mapaEl, {
      center: { lat: CENTER[0], lng: CENTER[1] },
      zoom: 15,
      mapTypeControl: false,
      streetViewControl: true,
      fullscreenControl: true
    });
  }catch(e){
    mapaEl.style.display = "flex";
    mapaEl.innerHTML = `<div class="empty" style="width:100%;"><div class="big">⚠️</div>Erro ao inicializar o mapa: ${escapeHtml(e.message)}</div>`;
    return;
  }

  if(vistorias.length===0){
    const info = el("div","empty");
    info.innerHTML = `<div class="big">🗺️</div>Nenhuma ocorrência com GPS registrada ainda.`;
    card.appendChild(info);
    return;
  }

  const infoWindow = new google.maps.InfoWindow();
  const bounds = new google.maps.LatLngBounds();

  vistorias.forEach(v=>{
    const color = markerColor(v);
    const pos = { lat: v.lat, lng: v.lng };
    bounds.extend(pos);
    const marker = new google.maps.Marker({
      position: pos,
      map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: color,
        fillOpacity: 0.95,
        strokeColor: "#fff",
        strokeWeight: 2
      },
      title: v.rua
    });
    marker.addListener("click", ()=>{
      infoWindow.setContent(`
        <div style="font-size:13px;max-width:220px;">
          <b>${escapeHtml(v.rua)}${v.numero? ", "+escapeHtml(v.numero):""}</b><br>
          ${escapeHtml(v.bairro)}<br>
          ${fmtDate(v.timestamp)}<br>
          ${escapeHtml(v.categoria)} · ${escapeHtml(v.subcategoria)}<br>
          Status: <b>${v.status}</b><br>
          ${v.fotos && v.fotos[0] ? `<img src="${v.fotos[0]}" style="width:100%;border-radius:6px;margin-top:6px;">` : ""}
        </div>
      `);
      infoWindow.open(map, marker);
    });
  });

  if(vistorias.length > 1) map.fitBounds(bounds, 40);
}

/* ============================================================
   MÓDULO — DASHBOARD GERENCIAL
   ============================================================ */
function renderDashboard(){
  const c = document.getElementById("content");
  const vistorias = getVistorias();
  const ruas = new Set(vistorias.map(v=> v.bairro+"|"+v.rua));
  const concluidas = vistorias.filter(v=>v.status==="Concluído");
  const pendentes = vistorias.filter(v=>v.status!=="Concluído");
  const pct = vistorias.length ? Math.round(concluidas.length/vistorias.length*100) : 0;

  let tempoMedioDias = "—";
  if(concluidas.length){
    const soma = concluidas.reduce((s,v)=> s + (new Date() - new Date(v.timestamp)), 0);
    tempoMedioDias = Math.round(soma / concluidas.length / 86400000) + " d (aprox.)";
  }

  const stats = el("div","stat-grid");
  stats.innerHTML = `
    <div class="stat-card"><div class="num">${ruas.size}</div><div class="lbl">Ruas vistoriadas</div></div>
    <div class="stat-card"><div class="num">${vistorias.length}</div><div class="lbl">Ocorrências registradas</div></div>
    <div class="stat-card"><div class="num">${pendentes.length}</div><div class="lbl">Serviços pendentes</div></div>
    <div class="stat-card"><div class="num">${concluidas.length}</div><div class="lbl">Serviços concluídos</div></div>
    <div class="stat-card"><div class="num">${pct}%</div><div class="lbl">Percentual de resolução</div></div>
    <div class="stat-card"><div class="num" style="font-size:16px;">${tempoMedioDias}</div><div class="lbl">Tempo médio (concluídas)</div></div>
  `;
  c.appendChild(stats);

  const planoCard = el("div","card");
  planoCard.style.marginTop="14px";
  planoCard.innerHTML = `<div class="section-title">Plano automático de recuperação</div>
    <div class="hint">Analisa as ocorrências pendentes, agrupa por bairro e tipo de serviço, e sugere cronograma, equipes e materiais.</div>
    <button class="btn btn-dark" id="btnPlano" style="margin-top:10px;">🗂️ Gerar Plano de Recuperação</button>`;
  planoCard.querySelector("#btnPlano").addEventListener("click", gerarPlanoRecuperacao);
  c.appendChild(planoCard);

  if(vistorias.length===0){
    const empty = el("div","card");
    empty.innerHTML = `<div class="empty"><div class="big">📊</div>Registre vistorias para ver os gráficos aqui.</div>`;
    c.appendChild(empty);
    return;
  }

  const chartsCard = el("div","card");
  chartsCard.style.marginTop="14px";
  chartsCard.innerHTML = `<div class="section-title">Ocorrências por categoria</div><canvas id="chCat" height="180"></canvas>`;
  c.appendChild(chartsCard);

  const chartsCard2 = el("div","card");
  chartsCard2.innerHTML = `<div class="section-title">Status das ocorrências</div><canvas id="chStatus" height="180"></canvas>`;
  c.appendChild(chartsCard2);

  const chartsCard3 = el("div","card");
  chartsCard3.innerHTML = `<div class="section-title">Ocorrências por bairro</div><canvas id="chBairro" height="200"></canvas>`;
  c.appendChild(chartsCard3);

  const chartsCard4 = el("div","card");
  chartsCard4.innerHTML = `<div class="section-title">Linha temporal (últimos 14 dias)</div><canvas id="chTempo" height="180"></canvas>`;
  c.appendChild(chartsCard4);

  // por categoria
  const byCat = {};
  vistorias.forEach(v=> byCat[v.categoria] = (byCat[v.categoria]||0)+1);
  new Chart(document.getElementById("chCat"), { type:"bar", data:{ labels:Object.keys(byCat), datasets:[{ data:Object.values(byCat), backgroundColor:"#FF7A00", borderRadius:6 }]}, options:{ plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true, ticks:{precision:0}}} }});

  // status
  const byStatus = {};
  vistorias.forEach(v=> byStatus[v.status] = (byStatus[v.status]||0)+1);
  new Chart(document.getElementById("chStatus"), { type:"pie", data:{ labels:Object.keys(byStatus), datasets:[{ data:Object.values(byStatus), backgroundColor:["#22C55E","#EAB308","#F97316","#EF4444","#2B6CB0"] }]}});

  // bairro
  const byBairro = {};
  vistorias.forEach(v=> byBairro[v.bairro] = (byBairro[v.bairro]||0)+1);
  new Chart(document.getElementById("chBairro"), { type:"bar", data:{ labels:Object.keys(byBairro), datasets:[{ data:Object.values(byBairro), backgroundColor:"#2B6CB0", borderRadius:6 }]}, options:{ indexAxis:"y", plugins:{legend:{display:false}}, scales:{x:{beginAtZero:true, ticks:{precision:0}}} }});

  // linha temporal 14 dias
  const days = [];
  for(let i=13;i>=0;i--){ const d = new Date(); d.setDate(d.getDate()-i); days.push(d.toISOString().slice(0,10)); }
  const counts = days.map(day=> vistorias.filter(v=> v.timestamp.slice(0,10)===day).length );
  new Chart(document.getElementById("chTempo"), { type:"line", data:{ labels:days.map(d=>d.slice(5)), datasets:[{ data:counts, borderColor:"#FF7A00", backgroundColor:"rgba(255,122,0,0.15)", fill:true, tension:0.3 }]}, options:{ plugins:{legend:{display:false}} }});
}

function gerarPlanoRecuperacao(){
  const pendentes = getVistorias().filter(v=> v.status!=="Concluído");
  if(pendentes.length===0){ alert("Não há ocorrências pendentes para gerar um plano."); return; }

  // agrupar por bairro > tipo de serviço
  const porBairro = {};
  pendentes.forEach(v=>{
    porBairro[v.bairro] = porBairro[v.bairro] || {};
    porBairro[v.bairro][v.servico] = porBairro[v.bairro][v.servico] || [];
    porBairro[v.bairro][v.servico].push(v);
  });

  const bairrosOrdenados = Object.keys(porBairro).sort((a,b)=>{
    const piorA = Math.min(...Object.values(porBairro[a]).flat().map(v=> URG_ORDER.indexOf(v.urgencia)));
    const piorB = Math.min(...Object.values(porBairro[b]).flat().map(v=> URG_ORDER.indexOf(v.urgencia)));
    return piorA - piorB;
  });

  const c = document.getElementById("content");
  c.innerHTML = "";
  const card = el("div","card");
  let html = `<button class="btn btn-outline btn-sm noprint" id="btnVoltarPlano" style="width:auto;margin-bottom:10px;">← Voltar</button>
    <button class="btn btn-dark noprint" id="btnImprimirPlano" style="width:auto;margin-bottom:14px;margin-left:8px;">🖨️ Imprimir / Salvar PDF</button>
    <h2>Plano de Recuperação — SMTT Cacequi</h2>
    <div class="hint">Gerado em ${fmtDate(new Date().toISOString())} · ${pendentes.length} ocorrências pendentes analisadas</div>`;

  bairrosOrdenados.forEach((bairro, i)=>{
    const servicos = porBairro[bairro];
    const totalBairro = Object.values(servicos).flat().length;
    html += `<h3 style="margin-top:20px;">${i+1}. ${escapeHtml(bairro)} <span class="hint">(${totalBairro} ocorrências)</span></h3>`;
    Object.keys(servicos).forEach(serv=>{
      const items = servicos[serv];
      const equipes = Math.max(1, Math.ceil(items.length/5));
      const maquinas = Math.max(1, Math.ceil(items.length/10));
      const piorUrg = URG_ORDER[Math.min(...items.map(v=>URG_ORDER.indexOf(v.urgencia)))];
      html += `<div class="kv"><span>${escapeHtml(serv)} (${items.length}x) — prioridade ${piorUrg}</span><b>${equipes} equipe(s) · ${maquinas} máquina(s)</b></div>`;
    });
  });

  html += `<h3 style="margin-top:20px;">Cronograma sugerido</h3><table class="rep"><tr><th>Ordem</th><th>Bairro</th><th>Ocorrências</th><th>Prazo</th></tr>`;
  bairrosOrdenados.forEach((bairro,i)=>{
    const total = Object.values(porBairro[bairro]).flat().length;
    const piorUrg = URG_ORDER[Math.min(...Object.values(porBairro[bairro]).flat().map(v=>URG_ORDER.indexOf(v.urgencia)))];
    html += `<tr><td>${i+1}º</td><td>${escapeHtml(bairro)}</td><td>${total}</td><td>${PRAZOS[piorUrg]}</td></tr>`;
  });
  html += `</table>`;

  card.innerHTML = html;
  c.appendChild(card);
  document.getElementById("btnVoltarPlano").addEventListener("click", ()=> setTab("dashboard"));
  document.getElementById("btnImprimirPlano").addEventListener("click", ()=> window.print());
}

/* ============================================================
   MÓDULO — ICV (ÍNDICE DE CONSERVAÇÃO VIÁRIA)
   ============================================================ */
function calcularICV(){
  const vistorias = getVistorias();
  const ruas = {};
  vistorias.forEach(v=>{
    const key = v.bairro + " · " + v.rua;
    ruas[key] = ruas[key] || { bairro:v.bairro, rua:v.rua, ocorrencias:[] };
    ruas[key].ocorrencias.push(v);
  });
  const resultado = Object.values(ruas).map(r=>{
    let score = 100;
    Object.keys(ICV_WEIGHTS).forEach(cat=>{
      const max = ICV_WEIGHTS[cat];
      const pendentesCat = r.ocorrencias.filter(v=> v.categoria===cat && v.status!=="Concluído");
      let perda = 0;
      pendentesCat.forEach(v=> perda += max * (URG_PENALTY[v.urgencia]||0.05));
      score -= Math.min(max, perda);
    });
    score = Math.max(0, Math.round(score));
    let classe = "Excelente", cor = "#22C55E";
    if(score<30){classe="Crítica";cor="#EF4444";}
    else if(score<50){classe="Ruim";cor="#F97316";}
    else if(score<70){classe="Regular";cor="#EAB308";}
    else if(score<90){classe="Boa";cor="#2B6CB0";}
    return { ...r, score, classe, cor };
  }).sort((a,b)=> a.score - b.score);
  return resultado;
}

function renderICV(){
  const c = document.getElementById("content");
  const dados = calcularICV();
  const info = el("div","card");
  info.innerHTML = `<div class="section-title">Ranking de ruas (piores primeiro)</div>
    <div class="hint">Índice 0–100 calculado a partir de ocorrências pendentes: Pavimentação (40 pts), Drenagem (25 pts), Sinalização (20 pts), Acessibilidade (15 pts).</div>`;
  c.appendChild(info);

  if(dados.length===0){
    const empty = el("div","card");
    empty.innerHTML = `<div class="empty"><div class="big">🛣️</div>Nenhuma rua vistoriada ainda.</div>`;
    c.appendChild(empty);
    return;
  }

  const listCard = el("div","card");
  dados.forEach(r=>{
    const item = el("div","list-item");
    item.innerHTML = `<div style="display:flex;align-items:center;gap:12px;">
        <div class="icv-ring" style="background:${r.cor};">${r.score}</div>
        <div style="flex:1;">
          <div class="li-title">${escapeHtml(r.rua)}</div>
          <div class="li-sub">${escapeHtml(r.bairro)} · ${r.ocorrencias.length} ocorrência(s)</div>
        </div>
        <span class="badge" style="background:${r.cor}22;color:${r.cor};">${r.classe}</span>
      </div>`;
    listCard.appendChild(item);
  });
  c.appendChild(listCard);
}

/* ============================================================
   MÓDULO — ORDENS DE SERVIÇO
   ============================================================ */
function gerarOSDeVistoria(v){
  const arr = getOS();
  const numero = "OS-" + String(arr.length+1).padStart(4,"0");
  arr.push({
    numero, vistoriaId: v.id,
    data: new Date().toISOString(),
    local: v.bairro + " - " + v.rua + (v.numero? ", "+v.numero:""),
    servico: v.servico,
    responsavel: v.secretaria,
    equipe: "",
    prazo: v.prazo,
    status: "Pendente"
  });
  saveOS(arr);
}

function renderOSView(){
  const c = document.getElementById("content");
  const filterCard = el("div");
  const bar = el("div","filter-bar");
  bar.innerHTML = `<select id="fltStatus">
      <option value="">Todos os status</option>
      <option>Pendente</option><option>Em execução</option><option>Concluído</option><option>Cancelado</option>
    </select>`;
  filterCard.appendChild(bar);
  c.appendChild(filterCard);

  const listCard = el("div","card");
  c.appendChild(listCard);

  function draw(){
    const filtro = document.getElementById("fltStatus").value;
    let list = getOS().slice().reverse();
    if(filtro) list = list.filter(o=>o.status===filtro);
    listCard.innerHTML = `<div class="section-title">Ordens de serviço (${list.length})</div>`;
    if(list.length===0){
      listCard.innerHTML += `<div class="empty"><div class="big">🔧</div>Nenhuma OS encontrada. Gere uma a partir de uma vistoria.</div>`;
      return;
    }
    list.forEach(o=>{
      const item = el("div","list-item");
      item.innerHTML = `<div class="li-top">
          <div><div class="li-title">${o.numero}</div><div class="li-sub">${escapeHtml(o.local)}</div></div>
          <span class="tag-cat">${o.prazo}</span>
        </div>
        <div class="li-sub">${escapeHtml(o.servico)} · Resp.: ${escapeHtml(o.responsavel)}</div>
        <label style="margin-top:8px;">Status</label>
        <select data-numero="${o.numero}" class="selStatus">
          <option ${o.status==="Pendente"?"selected":""}>Pendente</option>
          <option ${o.status==="Em execução"?"selected":""}>Em execução</option>
          <option ${o.status==="Concluído"?"selected":""}>Concluído</option>
          <option ${o.status==="Cancelado"?"selected":""}>Cancelado</option>
        </select>`;
      listCard.appendChild(item);
    });
    listCard.querySelectorAll(".selStatus").forEach(sel=>{
      sel.addEventListener("change", ()=>{
        const arr = getOS();
        const idx = arr.findIndex(o=>o.numero===sel.dataset.numero);
        if(idx>=0){ arr[idx].status = sel.value; saveOS(arr); }
      });
    });
  }
  document.getElementById("fltStatus").addEventListener("change", draw);
  draw();
}

/* ============================================================
   MÓDULO — RELATÓRIOS
   ============================================================ */
function renderRelatorios(){
  const c = document.getElementById("content");
  const vistorias = getVistorias();
  const bairros = [...new Set(vistorias.map(v=>v.bairro))];

  const card = el("div","card");
  card.innerHTML = `<div class="section-title">Filtrar e exportar</div>
    <label>Bairro</label>
    <select id="fBairro"><option value="">Todos</option>${bairros.map(b=>`<option>${escapeHtml(b)}</option>`).join("")}</select>
    <label>Categoria</label>
    <select id="fCategoria"><option value="">Todas</option>${Object.keys(CATS).map(cCat=>`<option>${cCat}</option>`).join("")}</select>
    <label>Prioridade</label>
    <select id="fPrioridade"><option value="">Todas</option><option>Baixa</option><option>Média</option><option>Alta</option><option>Emergencial</option></select>
    <div class="row">
      <div><label>De</label><input type="date" id="fDe"></div>
      <div><label>Até</label><input type="date" id="fAte"></div>
    </div>
    <button class="btn btn-primary" id="btnFiltrar" style="margin-top:14px;">🔍 Aplicar filtros</button>
    <button class="btn btn-outline" id="btnCSV" style="margin-top:10px;">⬇️ Exportar CSV (Excel)</button>
    <div class="hint">O CSV abre diretamente no Excel/LibreOffice e pode ser filtrado por bairro, rua, período, categoria, equipe e prioridade.</div>`;
  c.appendChild(card);

  const resultCard = el("div","card");
  c.appendChild(resultCard);

  function filtrar(){
    const bairro = document.getElementById("fBairro").value;
    const categoria = document.getElementById("fCategoria").value;
    const prioridade = document.getElementById("fPrioridade").value;
    const de = document.getElementById("fDe").value;
    const ate = document.getElementById("fAte").value;
    return vistorias.filter(v=>{
      if(bairro && v.bairro!==bairro) return false;
      if(categoria && v.categoria!==categoria) return false;
      if(prioridade && v.urgencia!==prioridade) return false;
      const dia = v.timestamp.slice(0,10);
      if(de && dia<de) return false;
      if(ate && dia>ate) return false;
      return true;
    });
  }

  function draw(){
    const res = filtrar();
    resultCard.innerHTML = `<div class="section-title">Resultado (${res.length})</div>`;
    if(res.length===0){ resultCard.innerHTML += `<div class="empty">Nenhum registro para os filtros selecionados.</div>`; return; }
    let table = `<table class="rep"><tr><th>Data</th><th>Bairro</th><th>Rua</th><th>Categoria</th><th>Urgência</th><th>Status</th></tr>`;
    res.slice(0,200).forEach(v=>{
      table += `<tr><td>${fmtDate(v.timestamp)}</td><td>${escapeHtml(v.bairro)}</td><td>${escapeHtml(v.rua)}</td><td>${escapeHtml(v.subcategoria)}</td><td>${v.urgencia}</td><td>${v.status}</td></tr>`;
    });
    table += `</table>`;
    resultCard.innerHTML += table;
  }
  document.getElementById("btnFiltrar").addEventListener("click", draw);
  document.getElementById("btnCSV").addEventListener("click", ()=>{
    const res = filtrar();
    const headers = ["Data","Servidor","Bairro","Rua","Numero","Latitude","Longitude","Categoria","Subcategoria","Urgencia","Prazo","Secretaria","Servico","Status","Observacoes"];
    const rows = res.map(v=> [fmtDate(v.timestamp), v.servidor, v.bairro, v.rua, v.numero, v.lat, v.lng, v.categoria, v.subcategoria, v.urgencia, v.prazo, v.secretaria, v.servico, v.status, (v.observacoes||"").replace(/\n/g," ")]);
    let csv = headers.join(";") + "\n" + rows.map(r=> r.map(x=> `"${(x==null?"":x).toString().replace(/"/g,'""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF"+csv], {type:"text/csv;charset=utf-8;"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "relatorio_mapeamento_urbano_" + new Date().toISOString().slice(0,10) + ".csv";
    a.click();
  });
  draw();
}

/* ---------- INIT ---------- */
if("serviceWorker" in navigator){
  window.addEventListener("load", ()=>{
    navigator.serviceWorker.register("sw.js").catch(()=>{ document.getElementById("syncdot").classList.add("off"); });
  });
}
setTab("vistoria");
