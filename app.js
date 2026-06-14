/* =====================================================
   BOLÃO DA COPA — app.js
   Armazenamento: localStorage (sem backend necessário)
   ===================================================== */

// ─── CONSTANTES ───────────────────────────────────────
const ADMIN_SENHA = 'admin123';  // Altere aqui para mudar a senha
const PONTOS = { EXATO: 10, VENCEDOR: 4, EMPATE: 3, ERRO: 0 };
const PRAZO_MINUTOS = 30; // minutos antes do jogo para fechar palpites

// ─── CORES DOS AVATARES (ciclo) ───────────────────────
const AVATAR_COLORS = [
  { bg: 'rgba(245,197,24,0.18)', fg: '#f5c518' },
  { bg: 'rgba(61,156,240,0.18)', fg: '#3d9cf0' },
  { bg: 'rgba(46,204,113,0.18)', fg: '#2ecc71' },
  { bg: 'rgba(231,76,60,0.18)',  fg: '#e74c3c' },
  { bg: 'rgba(155,89,182,0.18)', fg: '#9b59b6' },
  { bg: 'rgba(52,152,219,0.18)', fg: '#3498db' },
  { bg: 'rgba(230,126,34,0.18)', fg: '#e67e22' },
  { bg: 'rgba(26,188,156,0.18)', fg: '#1abc9c' },
];

// ─── ESTADO GLOBAL ────────────────────────────────────
let state = {
  jogos: [],          // Array de objetos jogo
  participantes: {},  // { nome: { palpites: { jogoId: {a, b} }, pts, ... } }
  usuarioAtual: null, // Nome do usuário logado
  adminLogado: false,
};

// ─── DADOS INICIAIS DE EXEMPLO ────────────────────────
const JOGOS_EXEMPLO = [
  {
    id: 'j1',
    timeA: { nome: 'Brasil',    flag: '🇧🇷' },
    timeB: { nome: 'Argentina', flag: '🇦🇷' },
    data: new Date(Date.now() - 3 * 3600000).toISOString(), // 3h atrás
    grupo: 'Grupo A · Fase de Grupos',
    estadio: 'Estádio Lusail',
    resultado: { a: 2, b: 1 }, // resultado definido = encerrado
  },
  {
    id: 'j2',
    timeA: { nome: 'França',   flag: '🇫🇷' },
    timeB: { nome: 'Marrocos', flag: '🇲🇦' },
    data: new Date(Date.now() - 1 * 3600000).toISOString(),
    grupo: 'Grupo B · Fase de Grupos',
    estadio: 'Estádio 974',
    resultado: { a: 3, b: 0 },
  },
  {
    id: 'j3',
    timeA: { nome: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
    timeB: { nome: 'Portugal',   flag: '🇵🇹' },
    data: new Date(Date.now() + 2 * 3600000).toISOString(), // 2h depois
    grupo: 'Grupo C · Fase de Grupos',
    estadio: 'Al Rayyan',
    resultado: null,
  },
  {
    id: 'j4',
    timeA: { nome: 'Holanda', flag: '🇳🇱' },
    timeB: { nome: 'EUA',     flag: '🇺🇸' },
    data: new Date(Date.now() + 26 * 3600000).toISOString(), // amanhã
    grupo: 'Grupo D · Fase de Grupos',
    estadio: 'Ahmed bin Ali',
    resultado: null,
  },
  {
    id: 'j5',
    timeA: { nome: 'Espanha',  flag: '🇪🇸' },
    timeB: { nome: 'Alemanha', flag: '🇩🇪' },
    data: new Date(Date.now() + 50 * 3600000).toISOString(),
    grupo: 'Grupo E · Fase de Grupos',
    estadio: 'Al Bayt',
    resultado: null,
  },
];

// ─── PERSISTÊNCIA ─────────────────────────────────────
function salvarState() {
  localStorage.setItem('bolao_state', JSON.stringify(state));
}

function carregarState() {
  const raw = localStorage.getItem('bolao_state');
  if (raw) {
    try {
      const s = JSON.parse(raw);
      state.jogos         = s.jogos         || JOGOS_EXEMPLO;
      state.participantes = s.participantes || {};
      state.usuarioAtual  = s.usuarioAtual  || null;
      state.adminLogado   = false; // nunca persiste sessão admin
    } catch (e) {
      state.jogos = JOGOS_EXEMPLO;
    }
  } else {
    state.jogos = JOGOS_EXEMPLO;
  }
}

// ─── NAVEGAÇÃO ────────────────────────────────────────
function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const sec = document.getElementById('sec-' + id);
  if (sec) sec.classList.add('active');
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    const id = this.dataset.section;
    this.classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => { if (b !== this) b.classList.remove('active'); });
    showSection(id);
    if (id === 'jogos')         renderJogos();
    if (id === 'bolao')         renderBolao();
    if (id === 'classificacao') renderClassificacao();
    if (id === 'admin')         renderAdmin();
  });
});

// ─── TOAST ────────────────────────────────────────────
function toast(msg, tipo = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (tipo === 'erro' ? ' error' : '');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ─── HELPERS ──────────────────────────────────────────
function formatData(iso) {
  const d = new Date(iso);
  const hoje = new Date();
  const amanha = new Date(); amanha.setDate(amanha.getDate() + 1);
  const hh = d.getHours().toString().padStart(2,'0');
  const mm = d.getMinutes().toString().padStart(2,'0');
  const hora = `${hh}h${mm}`;
  if (d.toDateString() === hoje.toDateString())  return `Hoje, ${hora}`;
  if (d.toDateString() === amanha.toDateString()) return `Amanhã, ${hora}`;
  return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }) + `, ${hora}`;
}

function palpiteAberto(jogo) {
  if (jogo.resultado !== null) return false;
  const limite = new Date(jogo.data).getTime() - PRAZO_MINUTOS * 60 * 1000;
  return Date.now() < limite;
}

function jogoStatus(jogo) {
  if (jogo.resultado !== null) return 'encerrado';
  const inicio = new Date(jogo.data).getTime();
  const agora  = Date.now();
  if (agora >= inicio) return 'ao_vivo';
  const limite = inicio - PRAZO_MINUTOS * 60 * 1000;
  if (agora >= limite) return 'fechado'; // palpite fechado mas jogo não começou
  return 'aberto';
}

function avatarColor(nome) {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function iniciais(nome) {
  return nome.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase();
}

// ─── PONTUAÇÃO ────────────────────────────────────────
function calcularPontos(palpite, resultado) {
  if (!resultado || palpite.a === '' || palpite.b === '') return null;
  const pa = parseInt(palpite.a), pb = parseInt(palpite.b);
  const ra = resultado.a,         rb = resultado.b;

  if (pa === ra && pb === rb)                           return { pts: PONTOS.EXATO,    tipo: 'exato' };
  if (ra === rb && pa === pb)                           return { pts: PONTOS.EMPATE,   tipo: 'empate' };
  if ((pa > pb && ra > rb) || (pa < pb && ra < rb))    return { pts: PONTOS.VENCEDOR, tipo: 'vencedor' };
  return { pts: PONTOS.ERRO, tipo: 'erro' };
}

function calcularTotalParticipante(nome) {
  const p = state.participantes[nome];
  if (!p) return { pts: 0, exatos: 0, vencedores: 0 };
  let pts = 0, exatos = 0, vencedores = 0;
  state.jogos.forEach(jogo => {
    const pal = p.palpites?.[jogo.id];
    if (!pal) return;
    const r = calcularPontos(pal, jogo.resultado);
    if (!r) return;
    pts += r.pts;
    if (r.tipo === 'exato')    exatos++;
    if (r.tipo === 'vencedor') vencedores++;
  });
  return { pts, exatos, vencedores };
}

function ranking() {
  return Object.keys(state.participantes)
    .map(nome => ({ nome, ...calcularTotalParticipante(nome) }))
    .sort((a, b) => b.pts - a.pts || b.exatos - a.exatos || b.vencedores - a.vencedores);
}

function posicaoUsuario(nome) {
  const r = ranking();
  const idx = r.findIndex(p => p.nome === nome);
  return idx === -1 ? '—' : `${idx + 1}º`;
}

// ─── RENDER: JOGOS ────────────────────────────────────
function renderJogos() {
  const el = document.getElementById('jogos-list');
  const agora = Date.now();

  const aoVivo     = state.jogos.filter(j => jogoStatus(j) === 'ao_vivo');
  const encerrados = state.jogos.filter(j => jogoStatus(j) === 'encerrado');
  const proximos   = state.jogos.filter(j => ['aberto','fechado'].includes(jogoStatus(j)));

  let html = '';

  if (aoVivo.length) {
    html += `<div class="group-label">🔴 Ao vivo</div>`;
    aoVivo.forEach(j => { html += cardJogo(j, 'ao_vivo'); });
  }
  if (encerrados.length) {
    html += `<div class="group-label">✅ Encerrados</div>`;
    encerrados.forEach(j => { html += cardJogo(j, 'encerrado'); });
  }
  if (proximos.length) {
    html += `<div class="group-label">🕒 Próximos jogos</div>`;
    proximos.forEach(j => { html += cardJogo(j, jogoStatus(j)); });
  }
  if (!state.jogos.length) {
    html = `<div class="empty-state"><div class="icon">⚽</div><p>Nenhum jogo cadastrado ainda.<br>O admin pode adicionar jogos na aba Admin.</p></div>`;
  }

  el.innerHTML = html;
}

function cardJogo(j, status) {
  const badgeMap = {
    ao_vivo:   `<span class="badge badge-live">● Ao vivo</span>`,
    encerrado: `<span class="badge badge-done">✓ Encerrado</span>`,
    aberto:    `<span class="badge badge-soon">${formatData(j.data)}</span>`,
    fechado:   `<span class="badge badge-soon">${formatData(j.data)}</span>`,
  };
  const scoreA = j.resultado !== null ? `<div class="score-num played">${j.resultado.a}</div>` : `<div class="score-num">—</div>`;
  const scoreB = j.resultado !== null ? `<div class="score-num played">${j.resultado.b}</div>` : `<div class="score-num">—</div>`;

  return `
    <div class="match-card">
      <div class="match-meta">
        <span>${j.grupo} · ${j.estadio}</span>
        ${badgeMap[status] || ''}
      </div>
      <div class="match-body">
        <div class="team">
          <span class="team-flag">${j.timeA.flag}</span>
          <span class="team-name">${j.timeA.nome}</span>
        </div>
        <div class="score-box">
          ${scoreA}
          <span class="score-sep">×</span>
          ${scoreB}
        </div>
        <div class="team">
          <span class="team-flag">${j.timeB.flag}</span>
          <span class="team-name">${j.timeB.nome}</span>
        </div>
      </div>
    </div>`;
}

// ─── BOLÃO / LOGIN ────────────────────────────────────
function entrarBolao() {
  const nome = document.getElementById('user-name-input').value.trim();
  if (!nome) { toast('Digite seu nome!', 'erro'); return; }
  state.usuarioAtual = nome;
  if (!state.participantes[nome]) {
    state.participantes[nome] = { palpites: {} };
  }
  salvarState();
  renderBolao();
}

function sairBolao() {
  state.usuarioAtual = null;
  salvarState();
  renderBolao();
}

function renderBolao() {
  const loginBox  = document.getElementById('login-box');
  const painel    = document.getElementById('bolao-painel');

  if (!state.usuarioAtual) {
    loginBox.style.display = '';
    painel.style.display   = 'none';
    document.getElementById('user-name-input').value = '';
    return;
  }

  loginBox.style.display = 'none';
  painel.style.display   = '';

  const nome = state.usuarioAtual;
  const { pts } = calcularTotalParticipante(nome);
  const pos  = posicaoUsuario(nome);

  document.getElementById('nome-usuario').textContent = nome;
  document.getElementById('stat-pts').textContent     = pts;
  document.getElementById('stat-pos').textContent     = pos;

  const p = state.participantes[nome];
  const abertos   = state.jogos.filter(j => palpiteAberto(j));
  const fechados  = state.jogos.filter(j => !palpiteAberto(j));

  const totalPalpites = Object.keys(p.palpites || {}).length;
  document.getElementById('palpites-count').textContent =
    `${totalPalpites} de ${state.jogos.length} palpites enviados`;

  // ── Jogos abertos para palpite
  let htmlAbertos = '';
  if (abertos.length) {
    htmlAbertos += `<div class="palpite-section-title"><i class="ti ti-pencil" aria-hidden="true"></i> Palpitar agora</div>`;
    abertos.forEach(j => {
      const pal = p.palpites?.[j.id] || { a: '', b: '' };
      const limite = new Date(new Date(j.data).getTime() - PRAZO_MINUTOS * 60 * 1000);
      htmlAbertos += `
        <div class="palpite-card">
          <div class="palpite-match-info">
            <span class="palpite-flag">${j.timeA.flag}</span>
            <span class="palpite-team">${j.timeA.nome}</span>
            <span class="palpite-vs">vs</span>
            <span class="palpite-team">${j.timeB.nome}</span>
            <span class="palpite-flag">${j.timeB.flag}</span>
          </div>
          <div class="palpite-inputs">
            <input class="palpite-input" type="number" min="0" max="20" placeholder="0"
              value="${pal.a}" id="pal-${j.id}-a">
            <span class="palpite-sep">×</span>
            <input class="palpite-input" type="number" min="0" max="20" placeholder="0"
              value="${pal.b}" id="pal-${j.id}-b">
          </div>
          <p class="palpite-deadline"><i class="ti ti-clock" aria-hidden="true"></i> Fecha às ${limite.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} do dia ${limite.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}</p>
        </div>`;
    });
    htmlAbertos += `<button class="btn-primary full" onclick="salvarPalpites()"><i class="ti ti-check" aria-hidden="true"></i> Salvar palpites</button>`;
  }

  // ── Histórico
  let htmlFechados = '';
  if (fechados.length) {
    htmlFechados += `<div class="palpite-section-title" style="margin-top:2rem"><i class="ti ti-history" aria-hidden="true"></i> Histórico de palpites</div>`;
    fechados.forEach(j => {
      const pal = p.palpites?.[j.id];
      if (!pal && j.resultado === null) {
        // sem palpite, sem resultado — não mostrar
        return;
      }

      const r    = pal ? calcularPontos(pal, j.resultado) : null;
      const vals = pal || { a: '?', b: '?' };

      let badgeHtml = '';
      let classA = '', classB = '';

      if (j.resultado === null) {
        badgeHtml = `<span class="pts-badge pts-pend">Aguardando resultado</span>`;
      } else if (!pal) {
        badgeHtml = `<span class="pts-badge pts-erro">Sem palpite</span>`;
      } else {
        if (r.tipo === 'exato')    { classA = classB = 'correct'; badgeHtml = `<span class="pts-badge pts-exato">+${r.pts} pts · Placar exato! 🎯</span>`; }
        if (r.tipo === 'vencedor') { classA = classB = 'partial'; badgeHtml = `<span class="pts-badge pts-certo">+${r.pts} pts · Vencedor certo ✅</span>`; }
        if (r.tipo === 'empate')   { classA = classB = 'partial'; badgeHtml = `<span class="pts-badge pts-empate">+${r.pts} pts · Empate certo 🤝</span>`; }
        if (r.tipo === 'erro')     { classA = classB = 'wrong';   badgeHtml = `<span class="pts-badge pts-erro">+0 pts · Errou ❌</span>`; }
      }

      const resHtml = j.resultado !== null
        ? `<div style="font-size:.75rem; color:var(--muted); text-align:center; margin-top:.4rem">Resultado: ${j.resultado.a}×${j.resultado.b}</div>`
        : '';

      htmlFechados += `
        <div class="palpite-card">
          <div class="palpite-match-info">
            <span class="palpite-flag">${j.timeA.flag}</span>
            <span class="palpite-team">${j.timeA.nome}</span>
            <span class="palpite-vs">vs</span>
            <span class="palpite-team">${j.timeB.nome}</span>
            <span class="palpite-flag">${j.timeB.flag}</span>
            <span class="palpite-pts-badge">${badgeHtml}</span>
          </div>
          <div class="palpite-inputs">
            <input class="palpite-input ${classA}" value="${vals.a}" disabled>
            <span class="palpite-sep">×</span>
            <input class="palpite-input ${classB}" value="${vals.b}" disabled>
          </div>
          ${resHtml}
        </div>`;
    });
  }

  if (!abertos.length && !fechados.length) {
    htmlAbertos = `<div class="empty-state"><div class="icon">⚽</div><p>Nenhum jogo disponível para palpitar ainda.</p></div>`;
  }

  document.getElementById('palpites-abertos').innerHTML  = htmlAbertos;
  document.getElementById('palpites-fechados').innerHTML = htmlFechados;
}

function salvarPalpites() {
  const nome = state.usuarioAtual;
  if (!nome) return;

  const abertos = state.jogos.filter(j => palpiteAberto(j));
  let salvos = 0;

  abertos.forEach(j => {
    const inputA = document.getElementById(`pal-${j.id}-a`);
    const inputB = document.getElementById(`pal-${j.id}-b`);
    if (!inputA || !inputB) return;
    const va = inputA.value.trim(), vb = inputB.value.trim();
    if (va === '' || vb === '') return;
    const a = Math.max(0, Math.min(20, parseInt(va)));
    const b = Math.max(0, Math.min(20, parseInt(vb)));
    state.participantes[nome].palpites[j.id] = { a, b };
    salvos++;
  });

  salvarState();
  toast(salvos > 0 ? `✅ ${salvos} palpite${salvos>1?'s':''} salvo${salvos>1?'s':''}!` : 'Nenhum palpite preenchido!', salvos > 0 ? 'ok' : 'erro');
  if (salvos > 0) renderBolao();
}

// ─── CLASSIFICAÇÃO ────────────────────────────────────
function renderClassificacao() {
  const tbody = document.getElementById('rank-body');
  const r = ranking();

  if (!r.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--muted)">Nenhum participante ainda</td></tr>`;
    return;
  }

  const medalhas = ['🥇','🥈','🥉'];
  const atual = state.usuarioAtual;

  tbody.innerHTML = r.map((p, i) => {
    const cor = avatarColor(p.nome);
    const ini = iniciais(p.nome);
    const pos = medalhas[i] || `<span class="rank-pos">${i+1}º</span>`;
    const isMe = p.nome === atual;
    const totalJogos = state.jogos.filter(j => j.resultado !== null).length;
    return `
      <tr class="${isMe ? 'me' : ''}">
        <td>${pos}</td>
        <td>
          <span class="rank-avatar" style="background:${cor.bg}; color:${cor.fg}">${ini}</span>
          <span class="rank-name">${p.nome}${isMe ? ' <span style="font-size:.72rem;color:var(--muted)">(você)</span>' : ''}</span>
        </td>
        <td class="rank-sub">${p.exatos}</td>
        <td class="rank-sub">${state.participantes[p.nome]?.palpites ? Object.keys(state.participantes[p.nome].palpites).length : 0}/${state.jogos.length}</td>
        <td><span class="rank-pts">${p.pts}</span></td>
      </tr>`;
  }).join('');
}

// ─── ADMIN ────────────────────────────────────────────
function entrarAdmin() {
  const senha = document.getElementById('admin-pass-input').value;
  if (senha !== ADMIN_SENHA) { toast('Senha incorreta!', 'erro'); return; }
  state.adminLogado = true;
  document.getElementById('admin-lock').style.display  = 'none';
  document.getElementById('admin-painel').style.display = '';
  renderAdminJogos();
  renderAdminParticipantes();
}

function sairAdmin() {
  state.adminLogado = false;
  document.getElementById('admin-lock').style.display   = '';
  document.getElementById('admin-painel').style.display  = 'none';
  document.getElementById('admin-pass-input').value = '';
}

function renderAdmin() {
  if (!state.adminLogado) {
    document.getElementById('admin-lock').style.display   = '';
    document.getElementById('admin-painel').style.display  = 'none';
  } else {
    renderAdminJogos();
    renderAdminParticipantes();
  }
}

function adicionarJogo() {
  const flagA  = document.getElementById('a-flag').value.trim();
  const nomeA  = document.getElementById('a-name').value.trim();
  const flagB  = document.getElementById('b-flag').value.trim();
  const nomeB  = document.getElementById('b-name').value.trim();
  const data   = document.getElementById('jogo-data').value;
  const grupo  = document.getElementById('jogo-grupo').value.trim() || 'Grupo · Fase';
  const estadio = document.getElementById('jogo-estadio').value.trim() || 'Estádio';

  if (!nomeA || !nomeB || !data) {
    toast('Preencha times e data!', 'erro');
    return;
  }

  const novoJogo = {
    id: 'j' + Date.now(),
    timeA: { nome: nomeA, flag: flagA || '⚽' },
    timeB: { nome: nomeB, flag: flagB || '⚽' },
    data: new Date(data).toISOString(),
    grupo, estadio,
    resultado: null,
  };

  state.jogos.push(novoJogo);
  salvarState();
  toast('✅ Jogo adicionado!');

  // Limpar campos
  ['a-flag','a-name','b-flag','b-name','jogo-data','jogo-grupo','jogo-estadio'].forEach(id => {
    document.getElementById(id).value = '';
  });

  renderAdminJogos();
}

function renderAdminJogos() {
  const el = document.getElementById('admin-jogos-list');
  if (!state.jogos.length) {
    el.innerHTML = '<p class="muted small">Nenhum jogo cadastrado.</p>';
    return;
  }

  el.innerHTML = state.jogos.map(j => {
    const temResultado = j.resultado !== null;
    const valA = temResultado ? j.resultado.a : '';
    const valB = temResultado ? j.resultado.b : '';
    return `
      <div class="admin-jogo-item">
        <div class="admin-jogo-teams">${j.timeA.flag} ${j.timeA.nome} × ${j.timeB.nome} ${j.timeB.flag}</div>
        <div style="font-size:.75rem; color:var(--muted); margin-bottom:.5rem">${j.grupo} · ${formatData(j.data)}</div>
        <div class="admin-resultado-row">
          <span class="small">Resultado:</span>
          <input type="number" min="0" max="20" placeholder="0" value="${valA}" id="res-${j.id}-a" style="width:3.5rem; text-align:center">
          <span class="small">×</span>
          <input type="number" min="0" max="20" placeholder="0" value="${valB}" id="res-${j.id}-b" style="width:3.5rem; text-align:center">
          <button class="btn-success" onclick="salvarResultado('${j.id}')"><i class="ti ti-check" aria-hidden="true"></i> Confirmar</button>
          ${temResultado ? `<button class="btn-danger" onclick="limparResultado('${j.id}')">Limpar</button>` : ''}
          <button class="btn-danger" onclick="removerJogo('${j.id}')" style="margin-left:auto"><i class="ti ti-trash" aria-hidden="true"></i></button>
        </div>
      </div>`;
  }).join('');
}

function salvarResultado(jogoId) {
  const a = parseInt(document.getElementById(`res-${jogoId}-a`).value);
  const b = parseInt(document.getElementById(`res-${jogoId}-b`).value);

  if (isNaN(a) || isNaN(b)) { toast('Digite um resultado válido!', 'erro'); return; }

  const jogo = state.jogos.find(j => j.id === jogoId);
  if (jogo) {
    jogo.resultado = { a: Math.max(0,a), b: Math.max(0,b) };
    salvarState();
    toast(`✅ Resultado ${a}×${b} salvo!`);
    renderAdminJogos();
  }
}

function limparResultado(jogoId) {
  const jogo = state.jogos.find(j => j.id === jogoId);
  if (jogo) {
    jogo.resultado = null;
    salvarState();
    toast('Resultado removido');
    renderAdminJogos();
  }
}

function removerJogo(jogoId) {
  if (!confirm('Remover este jogo? Os palpites deste jogo também serão perdidos.')) return;
  state.jogos = state.jogos.filter(j => j.id !== jogoId);
  // Remove palpites deste jogo
  Object.values(state.participantes).forEach(p => {
    delete p.palpites?.[jogoId];
  });
  salvarState();
  toast('Jogo removido');
  renderAdminJogos();
  renderJogos();
}

function renderAdminParticipantes() {
  const el = document.getElementById('admin-participantes');
  const nomes = Object.keys(state.participantes);

  if (!nomes.length) {
    el.innerHTML = '<p class="muted small">Nenhum participante ainda.</p>';
    return;
  }

  el.innerHTML = nomes.map(nome => {
    const { pts } = calcularTotalParticipante(nome);
    const totalPal = Object.keys(state.participantes[nome].palpites || {}).length;
    return `
      <div class="participante-item">
        <span>${nome} <span class="muted small">(${totalPal} palpites · ${pts} pts)</span></span>
        <button class="btn-danger" onclick="removerParticipante('${nome.replace(/'/g,"\\'")}')">
          <i class="ti ti-trash" aria-hidden="true"></i> Remover
        </button>
      </div>`;
  }).join('');
}

function removerParticipante(nome) {
  if (!confirm(`Remover "${nome}" e todos os seus palpites?`)) return;
  delete state.participantes[nome];
  if (state.usuarioAtual === nome) state.usuarioAtual = null;
  salvarState();
  toast('Participante removido');
  renderAdminParticipantes();
}

// ─── INICIALIZAÇÃO ────────────────────────────────────
(function init() {
  carregarState();
  renderJogos();

  // Se já tinha usuário logado, renderiza o bolão
  if (state.usuarioAtual) renderBolao();
})();
