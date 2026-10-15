/* =====================================================
   AVALIA.SERV — app.js  v4
   Arquitetura modular em namespace:
     DB          → persistência (localStorage)
     State       → estado global da aplicação
     Utils       → utilitários puros (sem DOM)
     Phone       → DDI / WhatsApp
     UI          → helpers de DOM genéricos
     Theme       → alternância de tema
     Modals      → abertura / fechamento de modais
     Auth        → login / cadastro / recuperação de senha
     Sidebar     → barra lateral
     Views       → roteamento de visão por tipo de usuário
     Sections    → navegação entre seções internas
     ProfCards   → cards de profissional
     ProfModal   → modal de perfil do profissional (cliente)
     ClientModal → modal de perfil do cliente (profissional)
     Favorites   → favoritos
     Requests    → solicitações
     Chat        → chat interno
     Profile     → modal de editar perfil
     Photo       → upload / remoção de foto
     Support     → modal de suporte
     Donation    → modal de doação
     FAB         → botão flutuante
     Boot        → DOMContentLoaded
   ===================================================== */

'use strict';

// ═══════════════════════════════════════════════════════
//  DB — Camada de persistência (localStorage)
// ═══════════════════════════════════════════════════════
const DB = (() => {
    const read  = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
    const write = (key, val)      => localStorage.setItem(key, JSON.stringify(val));

    const getUsers    = ()       => read('av_db_users', []);
    const saveUsers   = list     => write('av_db_users', list);
    const findUser    = email    => getUsers().find(u => u.email === email) ?? null;
    const upsertUser  = user     => { const l = getUsers(), i = l.findIndex(x => x.email === user.email); i !== -1 ? l[i] = user : l.push(user); saveUsers(l); };
    const deleteUser  = email    => saveUsers(getUsers().filter(u => u.email !== email));

    const getProfessionals   = ()    => read('av_db_professionals', []);
    const saveProfessionals  = list  => write('av_db_professionals', list);
    const upsertProfessional = prof  => { const l = getProfessionals(), i = l.findIndex(x => x.userEmail === prof.userEmail); i !== -1 ? l[i] = prof : l.push(prof); saveProfessionals(l); };
    const deleteProfessional = email => saveProfessionals(getProfessionals().filter(p => p.userEmail !== email));

    const getRequests   = ()  => read('av_db_requests', []);
    const saveRequests  = l   => write('av_db_requests', l);
    const upsertRequest = req => { const l = getRequests(), i = l.findIndex(x => x.id === req.id); i !== -1 ? l[i] = req : l.push(req); saveRequests(l); };

    const getMessages  = roomId        => read('av_chat_' + roomId, []);
    const saveMessages = (roomId, ms)  => write('av_chat_' + roomId, ms);
    const addMessage   = (roomId, msg) => { const ms = getMessages(roomId); ms.push(msg); saveMessages(roomId, ms); };

    const _tokens   = ()                     => read('av_pwd_tokens', {});
    const saveToken = (email, token, expiry) => { const t = _tokens(); t[email] = { token, expiry }; write('av_pwd_tokens', t); };
    const getToken  = email                  => _tokens()[email] ?? null;
    const clearToken = email                 => { const t = _tokens(); delete t[email]; write('av_pwd_tokens', t); };

    const getSession   = () => read('av_session', null);
    const saveSession  = u  => write('av_session', u);
    const clearSession = () => localStorage.removeItem('av_session');

    const getFavorites  = ()   => read('av_favorites', []);
    const saveFavorites = list => write('av_favorites', list);

    return {
        getUsers, saveUsers, findUser, upsertUser, deleteUser,
        getProfessionals, saveProfessionals, upsertProfessional, deleteProfessional,
        getRequests, saveRequests, upsertRequest,
        getMessages, saveMessages, addMessage,
        saveToken, getToken, clearToken,
        getSession, saveSession, clearSession,
        getFavorites, saveFavorites,
    };
})();

// ═══════════════════════════════════════════════════════
//  STATE — Estado global da aplicação
// ═══════════════════════════════════════════════════════
const State = (() => {
    let _currentUser    = null;
    let _favorites      = DB.getFavorites();
    let _activeChatRoom = null;
    let _chatPollTimer  = null;

    return {
        get currentUser()    { return _currentUser; },
        set currentUser(v)   { _currentUser = v; },
        get favorites()      { return _favorites; },
        set favorites(v)     { _favorites = v; },
        get activeChatRoom() { return _activeChatRoom; },
        set activeChatRoom(v){ _activeChatRoom = v; },
        get chatPollTimer()  { return _chatPollTimer; },
        set chatPollTimer(v) { _chatPollTimer = v; },
    };
})();

// ═══════════════════════════════════════════════════════
//  DADOS DEMO
// ═══════════════════════════════════════════════════════
const DEMO_PROFESSIONALS = [
    { id:'demo-1', userEmail:null, name:'João Silva', specialty:'Eletricista', category:'Manutenção',
      function:'Instalações Elétricas', status:'online', photo:'', gender:'Masculino',
      phone:'(11) 9 9999-9999', whatsapp:'5511999999999', location:'São Paulo, SP',
      experience:'8 anos', availability:'Tempo Integral', hourlyRate:90, minValue:200,
      serviceRadius:'50km', transport:'Carro Próprio', insurance:'Sim', register:'CREA 123456',
      languages:['Português'], instagram:'@joaoeletrica', serviceType:'Presencial',
      paymentMethods:['PIX','Dinheiro','Cartão Crédito'],
      formations:['Curso Técnico SENAI','Especialização em Instalações Residenciais'],
      documents:['Carteira de Eletricista','NR10'], portfolio:[],
      description:'Especialista em instalações elétricas residenciais e comerciais com 8 anos de experiência.',
      reviews:[
          { user:'Maria Santos', text:'Excelente trabalho! Muito profissional.', date:'2024-03-10', rating:5 },
          { user:'Pedro Alves',  text:'Resolveu rapidinho. Recomendo!',          date:'2024-02-20', rating:5 },
          { user:'Ana Lima',     text:'Bom serviço, atrasou um pouco.',          date:'2024-01-15', rating:4 },
      ] },
    { id:'demo-2', userEmail:null, name:'Ana Costa', specialty:'Encanadora', category:'Manutenção',
      function:'Reparos Hidráulicos', status:'online', photo:'', gender:'Feminino',
      phone:'(21) 9 8888-8888', whatsapp:'5521988888888', location:'Rio de Janeiro, RJ',
      experience:'10 anos', availability:'24/7', hourlyRate:85, minValue:180,
      serviceRadius:'30km', transport:'Carro Próprio', insurance:'Sim', register:'CREA 654321',
      languages:['Português','Espanhol'], instagram:'@anacosta_hidraulica', serviceType:'Presencial',
      paymentMethods:['PIX','Dinheiro'],
      formations:['Curso de Encanamento SENAI','Treinamento em Emergências'],
      documents:['Registro Profissional de Encanador'], portfolio:[],
      description:'Especialista em emergências e manutenção hidráulica. Atendimento 24h.',
      reviews:[
          { user:'Carlos Mendes', text:'Atendeu emergência às 2h! Salvou meu apartamento.', date:'2024-03-05', rating:5 },
          { user:'Fernanda Lima', text:'Muito atenciosa e eficiente.',                      date:'2024-02-10', rating:5 },
      ] },
    { id:'demo-3', userEmail:null, name:'Carlos Mendes', specialty:'Pintor', category:'Construção',
      function:'Pintura Interna e Externa', status:'offline', photo:'', gender:'Masculino',
      phone:'(31) 9 7777-7777', whatsapp:'5531977777777', location:'Belo Horizonte, MG',
      experience:'12 anos', availability:'Horário Comercial', hourlyRate:75, minValue:400,
      serviceRadius:'20km', transport:'Carro Próprio', insurance:'Em andamento', register:'',
      languages:['Português'], instagram:'@carlos_pinturas', serviceType:'Presencial',
      paymentMethods:['PIX','Dinheiro','Transferência'],
      formations:['Curso de Pintura Decorativa','Especialização em Tintas Ecológicas'],
      documents:['Alvará de Pintor','Certificado de Qualidade ABNT'], portfolio:[],
      description:'Pintura interna e externa com materiais de primeira linha.',
      reviews:[
          { user:'Laura Ferreira', text:'Resultado impecável! A casa ficou linda.',  date:'2024-01-30', rating:5 },
          { user:'Roberto Nunes',  text:'Ótimo trabalho, prazo demorou um pouco.',   date:'2023-12-15', rating:4 },
      ] },
    { id:'demo-4', userEmail:null, name:'Beatriz Souza', specialty:'Dev Full Stack', category:'Tecnologia',
      function:'Desenvolvimento Web', status:'online', photo:'', gender:'Feminino',
      phone:'(11) 9 6666-6666', whatsapp:'5511966666666', location:'São Paulo, SP',
      experience:'5 anos', availability:'Sob Demanda', hourlyRate:150, minValue:1500,
      serviceRadius:'Remoto', transport:'Trabalho Remoto', insurance:'Não', register:'',
      languages:['Português','Inglês','Espanhol'], instagram:'@bia.tech',
      website:'https://beatrizsouza.dev', serviceType:'Online / Remoto',
      paymentMethods:['PIX','Transferência','Boleto'],
      formations:['Bacharelado CC - USP','MBA em Gestão de TI'],
      documents:['Certificação AWS','Certificação Google Cloud'], portfolio:[],
      description:'Desenvolvedora Full Stack com foco em React, Node.js e soluções cloud.',
      reviews:[
          { user:'Startup XYZ', text:'Entregou antes do prazo com qualidade excepcional.', date:'2024-03-12', rating:5 },
          { user:'Empresa ABC', text:'Profissional incrível, comunicação perfeita.',       date:'2024-02-28', rating:5 },
      ] },
    { id:'demo-5', userEmail:null, name:'Rafael Gomes', specialty:'Personal Trainer', category:'Saúde',
      function:'Treinamento Físico', status:'online', photo:'', gender:'Masculino',
      phone:'(21) 9 5555-5555', whatsapp:'5521955555555', location:'Rio de Janeiro, RJ',
      experience:'7 anos', availability:'Horário Comercial', hourlyRate:120, minValue:300,
      serviceRadius:'15km', transport:'Carro Próprio', insurance:'Sim', register:'CREF 012345-G/RJ',
      languages:['Português','Inglês'], instagram:'@rafaelgomes_trainer', serviceType:'Presencial e Remoto',
      paymentMethods:['PIX','Cartão Crédito','Dinheiro'],
      formations:['Educação Física - UFRJ','Especialização em Nutrição Esportiva'],
      documents:['CREF 012345-G/RJ'], portfolio:[],
      description:'Personal trainer especializado em emagrecimento e hipertrofia.',
      reviews:[
          { user:'Juliana Carvalho', text:'Perdi 12kg em 4 meses! Incrível.',   date:'2024-03-08', rating:5 },
          { user:'Marcelo Dias',     text:'Treinos personalizados e motivador.', date:'2024-01-20', rating:5 },
      ] },
    { id:'demo-6', userEmail:null, name:'Camila Andrade', specialty:'Cabeleireira', category:'Beleza',
      function:'Corte e Coloração', status:'offline', photo:'', gender:'Feminino',
      phone:'(31) 9 4444-4444', whatsapp:'5531944444444', location:'Belo Horizonte, MG',
      experience:'9 anos', availability:'Fins de Semana', hourlyRate:80, minValue:120,
      serviceRadius:'10km', transport:'Carro Próprio', insurance:'Não', register:'',
      languages:['Português'], instagram:'@camilaandrade_hair', serviceType:'Presencial',
      paymentMethods:['PIX','Dinheiro','Cartão Débito'],
      formations:['Curso Técnico SENAC','Especialização em Colorimetria'],
      documents:['Certificado Profissional SENAC'], portfolio:[],
      description:'Especialista em corte feminino, coloração e tratamentos capilares.',
      reviews:[
          { user:'Lara Fonseca', text:'Ficou lindo o corte! Muito caprichosa.', date:'2024-02-14', rating:5 },
          { user:'Sônia Braga',  text:'Coloração perfeita. Super recomendo!',   date:'2024-01-05', rating:5 },
      ] },
];

const getAllProfessionals = () => [...DEMO_PROFESSIONALS, ...DB.getProfessionals()];

// ═══════════════════════════════════════════════════════
//  PHONE — DDI / WhatsApp
// ═══════════════════════════════════════════════════════
const Phone = (() => {
    const COUNTRIES = [
        { code:'BR', name:'Brasil',         ddi:'55',  flag:'🇧🇷', mask:'(00) 00000-0000' },
        { code:'US', name:'Estados Unidos', ddi:'1',   flag:'🇺🇸', mask:'(000) 000-0000'  },
        { code:'PT', name:'Portugal',       ddi:'351', flag:'🇵🇹', mask:'000 000 000'      },
        { code:'AR', name:'Argentina',      ddi:'54',  flag:'🇦🇷', mask:'(000) 000-0000'  },
        { code:'CL', name:'Chile',          ddi:'56',  flag:'🇨🇱', mask:'00 0000 0000'     },
        { code:'CO', name:'Colômbia',       ddi:'57',  flag:'🇨🇴', mask:'000 000 0000'     },
        { code:'MX', name:'México',         ddi:'52',  flag:'🇲🇽', mask:'(000) 000-0000'  },
        { code:'ES', name:'Espanha',        ddi:'34',  flag:'🇪🇸', mask:'000 000 000'      },
        { code:'AO', name:'Angola',         ddi:'244', flag:'🇦🇴', mask:'000 000 000'      },
        { code:'MZ', name:'Moçambique',     ddi:'258', flag:'🇲🇿', mask:'00 000 0000'      },
    ];

    const getCountry = code => COUNTRIES.find(x => x.code === code) ?? COUNTRIES[0];

    const buildDDISelector = (inputId, sel = 'BR') => {
        const c       = getCountry(sel);
        const options = COUNTRIES.map(x =>
            `<option value="${x.code}"${x.code === sel ? ' selected' : ''}>${x.flag} +${x.ddi} — ${x.name}</option>`
        ).join('');
        return `<div class="ddi-wrapper">
            <select class="ddi-select" id="ddi-${inputId}" onchange="Phone.onDDIChange('${inputId}')">${options}</select>
            <span class="ddi-display" id="ddi-display-${inputId}">${c.flag} +${c.ddi}</span>
            <input type="tel" id="${inputId}" class="form-input ddi-phone-input" placeholder="${c.mask}" autocomplete="tel">
        </div>`;
    };

    const onDDIChange = id => {
        const sel   = document.getElementById('ddi-' + id);
        const disp  = document.getElementById('ddi-display-' + id);
        const input = document.getElementById(id);
        if (!sel || !disp || !input) return;
        const c = getCountry(sel.value);
        disp.textContent   = `${c.flag} +${c.ddi}`;
        input.placeholder  = c.mask;
        input.value        = '';
    };

    const initField = (id, def = 'BR') => {
        const container = document.getElementById(`ddi-${id}-container`);
        if (container) container.innerHTML = buildDDISelector(id, def);
    };

    const getSelectedCountry = id => document.getElementById('ddi-' + id)?.value ?? 'BR';

    const buildNumber = id => {
        const sel   = document.getElementById('ddi-' + id);
        const input = document.getElementById(id);
        if (!sel || !input) return '';
        const digits = input.value.replace(/\D/g, '');
        return digits ? getCountry(sel.value).ddi + digits : '';
    };

    const buildWhatsappUrl = (num, name) => {
        const d = (num || '').replace(/\D/g, '');
        if (d.length < 8) return null;
        return `https://wa.me/${d}?text=${encodeURIComponent(`Olá, ${name}! Vi seu perfil no Avalia.Serv. 😊`)}`;
    };

    return { getCountry, buildDDISelector, onDDIChange, initField, getSelectedCountry, buildNumber, buildWhatsappUrl };
})();

// ═══════════════════════════════════════════════════════
//  UTILS — Utilitários puros (sem DOM)
// ═══════════════════════════════════════════════════════
const Utils = (() => {
    const sanitize = s => {
        if (typeof s !== 'string') return s ?? '';
        return s.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    const getStars  = r  => { r = parseFloat(r) || 0; return '★'.repeat(Math.floor(r)) + '☆'.repeat(5 - Math.floor(r)); };
    const avgRating = rs => { if (!rs?.length) return 0; return (rs.reduce((s, r) => s + r.rating, 0) / rs.length).toFixed(1); };
    const fmtTime   = ts => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const fmtDate   = ts => new Date(ts).toLocaleDateString('pt-BR');

    const estimateDistance = (cityA, cityB) => {
        if (!cityA || !cityB) return null;
        const a = cityA.toLowerCase(), b = cityB.toLowerCase();
        if (a === b || a.split(',')[0].trim() === b.split(',')[0].trim()) return 'Mesma cidade';
        if (a.split(',')[1]?.trim() === b.split(',')[1]?.trim()) return 'Mesmo estado (~50-200 km)';
        return 'Outro estado (+200 km)';
    };

    return { sanitize, getStars, avgRating, fmtTime, fmtDate, estimateDistance };
})();

// ═══════════════════════════════════════════════════════
//  UI — Helpers de DOM genéricos
// ═══════════════════════════════════════════════════════
const UI = (() => {
    const $        = id  => document.getElementById(id);
    const setValue = (id, val) => { const e = $(id); if (e) e.value = val ?? ''; };
    const setHTML  = (id, html) => { const e = $(id); if (e) e.innerHTML = html; };
    const show     = id  => $(id)?.classList.remove('hidden');
    const hide     = id  => $(id)?.classList.add('hidden');
    const toggle   = (id, visible) => $(id)?.classList.toggle('hidden', !visible);

    const setMsg = (id, text, type) => {
        const el = $(id);
        if (!el) return;
        el.textContent = text;
        el.className   = `form-message${type ? ' ' + type : ''}`;
    };

    const showToast = (msg, type = 'success') => {
        const t = document.createElement('div');
        t.className   = `toast ${type}`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 3200);
    };

    return { $, setValue, setHTML, show, hide, toggle, setMsg, showToast };
})();

// ═══════════════════════════════════════════════════════
//  THEME — Alternância de tema claro / escuro
// ═══════════════════════════════════════════════════════
const Theme = (() => {
    const _apply = dark => {
        document.body.classList.toggle('dark', dark);
        const btn = UI.$('theme-toggle');
        if (btn) btn.textContent = dark ? '☀️ Tema Claro' : '🌙 Tema Escuro';
    };

    const load   = () => _apply(localStorage.getItem('av_theme') === 'dark');
    const toggle = () => { const dark = document.body.classList.toggle('dark'); localStorage.setItem('av_theme', dark ? 'dark' : 'light'); _apply(dark); };

    return { load, toggle };
})();

// ═══════════════════════════════════════════════════════
//  MODALS — Abertura e fechamento genérico
// ═══════════════════════════════════════════════════════
const Modals = (() => {
    const open  = id => UI.$(id)?.classList.remove('hidden');
    const close = id => UI.$(id)?.classList.add('hidden');

    const bindOverlayClose = () => {
        document.querySelectorAll('.modal-overlay').forEach(o => {
            o.addEventListener('click', e => {
                if (e.target === o && !['login-modal', 'signup-modal'].includes(o.id)) {
                    o.classList.add('hidden');
                }
            });
        });
    };

    return { open, close, bindOverlayClose };
})();

// ═══════════════════════════════════════════════════════
//  AUTH — Login / cadastro / recuperação de senha
// ═══════════════════════════════════════════════════════
const Auth = (() => {
    const showSignup = () => { Modals.close('login-modal'); Modals.open('signup-modal'); };
    const showLogin  = () => { Modals.close('signup-modal'); Modals.open('login-modal'); };

    const toggleProfessionalFields = show => {
        UI.toggle('professional-fields', show);
        if (show) setTimeout(() => Phone.initField('signup-whatsapp', 'BR'), 10);
    };

    /* ── Login ── */
    const loginUser = () => {
        const email = UI.$('login-email').value.trim().toLowerCase();
        const pass  = UI.$('login-password').value;
        if (!email || !pass) { UI.setMsg('login-message', '⚠️ Preencha e-mail e senha.', 'error'); return; }
        const found = DB.findUser(email);
        if (found && found.password === pass) {
            State.currentUser = found;
            DB.saveSession(State.currentUser);
            initApp();
        } else {
            UI.setMsg('login-message', '❌ E-mail ou senha incorretos.', 'error');
        }
    };

    /* ── Cadastro ── */
    const _readProfFields = () => ({
        specialty:    UI.$('signup-specialty')?.value   || '',
        category:     UI.$('signup-category')?.value    || '',
        function:     UI.$('signup-function')?.value    || '',
        experience:   UI.$('signup-experience')?.value  || '',
        description:  UI.$('signup-description')?.value || '',
        whatsapp:     Phone.buildNumber('signup-whatsapp'),
        whatsappRaw:  UI.$('signup-whatsapp')?.value    || '',
        whatsappCountry: Phone.getSelectedCountry('signup-whatsapp'),
        location:     UI.$('signup-location')?.value    || '',
        serviceRadius:UI.$('signup-radius')?.value      || '',
        availability: UI.$('signup-availability')?.value|| '',
        hourlyRate:   parseFloat(UI.$('signup-hourly')?.value)     || 0,
        minValue:     parseFloat(UI.$('signup-min-value')?.value)  || 0,
        register:     UI.$('signup-register')?.value    || '',
        insurance:    UI.$('signup-insurance')?.value   || '',
        formations:   (UI.$('signup-formations')?.value || '').split(',').map(s => s.trim()).filter(Boolean),
        website:      UI.$('signup-website')?.value     || '',
        instagram:    UI.$('signup-instagram')?.value   || '',
        transport:    UI.$('signup-transport')?.value   || '',
        serviceType:  UI.$('signup-service-type')?.value|| '',
        paymentMethods: [...document.querySelectorAll('.checkbox-grid input:checked')]
            .map(c => c.value).filter(v => ['Dinheiro','PIX','Cartão Crédito','Cartão Débito','Transferência','Boleto'].includes(v)),
        languages: [...document.querySelectorAll('.checkbox-grid input:checked')]
            .map(c => c.value).filter(v => ['Português','Inglês','Espanhol','Francês'].includes(v)),
        status: 'online', reviews: [], documents: [],
    });

    const registerUser = () => {
        const name  = UI.$('signup-name').value.trim();
        const email = UI.$('signup-email').value.trim().toLowerCase();
        const pass  = UI.$('signup-password').value;
        const type  = document.querySelector('input[name="account-type"]:checked')?.value || 'client';

        if (!name || !email || !pass) { UI.setMsg('signup-message', '⚠️ Preencha nome, e-mail e senha.', 'error'); return; }
        if (pass.length < 6)          { UI.setMsg('signup-message', '⚠️ Senha mínima de 6 caracteres.', 'error'); return; }
        if (DB.findUser(email))        { UI.setMsg('signup-message', '⚠️ E-mail já cadastrado.', 'error'); return; }

        const user = {
            name: Utils.sanitize(name), email, password: pass, type, photo: '',
            phone:  UI.$('signup-phone-client')?.value || '',
            city:   UI.$('signup-city-client')?.value  || '',
            gender: UI.$('signup-gender')?.value        || '',
            birth:  UI.$('signup-birth')?.value         || '',
            cpf:    UI.$('signup-cpf')?.value            || '',
            bio: '', createdAt: new Date().toISOString(),
        };

        if (type === 'professional') {
            Object.assign(user, _readProfFields());
            DB.upsertProfessional(buildProfEntry(user));
        }

        DB.upsertUser(user);
        State.currentUser = user;
        DB.saveSession(State.currentUser);
        UI.setMsg('signup-message', '✅ Conta criada com sucesso!', 'success');
        setTimeout(() => initApp(), 700);
    };

    /* ── Logout / deletar conta ── */
    const logout = () => {
        if (State.chatPollTimer) clearInterval(State.chatPollTimer);
        State.currentUser = null;
        DB.clearSession();
        UI.hide('main-content');
        Modals.open('login-modal');
        UI.setMsg('login-message', '', '');
    };

    const confirmDeleteAccount = () => Modals.open('delete-confirm-modal');

    const deleteAccount = () => {
        if (!State.currentUser) return;
        DB.deleteUser(State.currentUser.email);
        if (State.currentUser.type === 'professional') DB.deleteProfessional(State.currentUser.email);
        State.favorites = State.favorites.filter(f => f !== 'user-' + State.currentUser.email);
        DB.saveFavorites(State.favorites);
        DB.clearSession();
        State.currentUser = null;
        Modals.close('delete-confirm-modal');
        Modals.close('profile-modal');
        UI.hide('main-content');
        Modals.open('login-modal');
        UI.showToast('Conta excluída.', 'error');
    };

    /* ── Esqueci minha senha ── */
    const showForgotPassword = () => {
        Modals.close('login-modal');
        Modals.open('forgot-modal');
        UI.show('forgot-step-email');
        UI.hide('forgot-step-token');
        UI.hide('forgot-step-newpass');
        UI.setMsg('forgot-msg', '', '');
    };

    const sendPasswordReset = () => {
        const email = (UI.$('forgot-email').value || '').trim().toLowerCase();
        if (!email) { UI.setMsg('forgot-msg', '⚠️ Informe seu e-mail.', 'error'); return; }
        const user = DB.findUser(email);
        if (!user) { UI.setMsg('forgot-msg', '❌ E-mail não encontrado.', 'error'); return; }

        const token  = String(Math.floor(100000 + Math.random() * 900000));
        const expiry = Date.now() + 15 * 60 * 1000;
        DB.saveToken(email, token, expiry);

        const msgEl = UI.$('forgot-msg');
        if (msgEl) {
            msgEl.innerHTML = `✅ Código enviado para <strong>${email}</strong><br>
                <span style="font-size:.8rem;color:var(--text-3)">(Simulação: seu código é <strong style="color:var(--primary);font-size:1rem">${token}</strong>)</span>`;
            msgEl.className = 'form-message success';
        }
        setTimeout(() => { UI.hide('forgot-step-email'); UI.show('forgot-step-token'); UI.setValue('forgot-token-email', email); }, 1500);
    };

    const verifyResetToken = () => {
        const email = UI.$('forgot-token-email').value;
        const token = (UI.$('forgot-token-input').value || '').trim();
        const saved = DB.getToken(email);
        if (!saved || saved.token !== token) { UI.setMsg('forgot-msg', '❌ Código inválido.', 'error'); return; }
        if (Date.now() > saved.expiry) { DB.clearToken(email); UI.setMsg('forgot-msg', '❌ Código expirado. Solicite novamente.', 'error'); return; }
        UI.setMsg('forgot-msg', '✅ Código válido!', 'success');
        setTimeout(() => { UI.hide('forgot-step-token'); UI.show('forgot-step-newpass'); }, 800);
    };

    const saveNewPassword = () => {
        const email = UI.$('forgot-token-email').value;
        const pass1 = (UI.$('forgot-newpass').value  || '').trim();
        const pass2 = (UI.$('forgot-newpass2').value || '').trim();
        if (!pass1 || pass1.length < 6) { UI.setMsg('forgot-msg', '⚠️ Senha mínima de 6 caracteres.', 'error'); return; }
        if (pass1 !== pass2)             { UI.setMsg('forgot-msg', '❌ As senhas não coincidem.', 'error'); return; }
        const user = DB.findUser(email);
        if (!user) { UI.setMsg('forgot-msg', '❌ Usuário não encontrado.', 'error'); return; }
        user.password = pass1;
        DB.upsertUser(user);
        DB.clearToken(email);
        UI.setMsg('forgot-msg', '✅ Senha alterada com sucesso!', 'success');
        setTimeout(() => { Modals.close('forgot-modal'); showLogin(); }, 1200);
    };

    return {
        showSignup, showLogin, toggleProfessionalFields,
        loginUser, registerUser,
        logout, confirmDeleteAccount, deleteAccount,
        showForgotPassword, sendPasswordReset, verifyResetToken, saveNewPassword,
    };
})();

// ═══════════════════════════════════════════════════════
//  BUILDER — Entrada canônica de profissional a partir do user
// ═══════════════════════════════════════════════════════
function buildProfEntry(u) {
    return {
        id: 'user-' + u.email, userEmail: u.email,
        name: u.name, specialty: u.specialty || u.function || '', category: u.category || '',
        function: u.function || '', status: u.status || 'online', photo: u.photo || '',
        gender: u.gender || '', phone: u.phone || '', whatsapp: u.whatsapp || '',
        whatsappRaw: u.whatsappRaw || '', whatsappCountry: u.whatsappCountry || 'BR',
        documents: u.documents || [], formations: u.formations || [], portfolio: u.portfolio || [],
        description: u.description || '', location: u.location || '', experience: u.experience || '',
        availability: u.availability || '', hourlyRate: u.hourlyRate || 0, minValue: u.minValue || 0,
        paymentMethods: u.paymentMethods || [], serviceRadius: u.serviceRadius || '',
        transport: u.transport || '', insurance: u.insurance || '', register: u.register || '',
        languages: u.languages || [], instagram: u.instagram || '', website: u.website || '',
        serviceType: u.serviceType || '', reviews: u.reviews || [],
    };
}

// ═══════════════════════════════════════════════════════
//  SIDEBAR — Barra lateral
// ═══════════════════════════════════════════════════════
const Sidebar = (() => {
    const update = () => {
        const u = State.currentUser;
        if (!u) return;
        const setText = (id, val) => { const el = UI.$(id); if (el) el.textContent = val; };
        setText('sidebar-name',  u.name  || 'Usuário');
        setText('sidebar-email', u.email || '');
        setText('sidebar-type',  u.type === 'professional' ? '🔧 Profissional' : '👤 Cliente');
        const avatar = UI.$('sidebar-avatar');
        if (avatar) avatar.innerHTML = u.photo
            ? `<img src="${u.photo}" alt="foto">`
            : (u.name || 'U').charAt(0).toUpperCase();
        UI.toggle('nav-prof-section',   u.type === 'professional');
        UI.toggle('nav-client-section', u.type === 'client');
    };
    return { update };
})();

// ═══════════════════════════════════════════════════════
//  VIEWS — Roteamento de visão por tipo de usuário
// ═══════════════════════════════════════════════════════
const Views = (() => {
    const showClient = () => {
        UI.show('client-view');
        UI.hide('professional-view');
        Sections.Client.renderProfessionals();
    };
    const showProfessional = () => {
        UI.show('professional-view');
        UI.hide('client-view');
        Sections.Professional.renderClientRequests();
    };
    return { showClient, showProfessional };
})();

// ═══════════════════════════════════════════════════════
//  SECTIONS — Navegação interna de cada view
// ═══════════════════════════════════════════════════════
const Sections = (() => {

    /* ── Seções do cliente ── */
    const Client = (() => {
        const SECTIONS = ['section-explore', 'section-favorites', 'section-my-requests'];

        const show = name => {
            SECTIONS.forEach(id => UI.toggle(id, id === 'section-' + name));
            if (name === 'favorites') Favorites.render();
            if (name === 'explore')   renderProfessionals();
            if (name === 'requests')  Requests.renderMine();
        };

        const renderProfessionals = () => {
            const grid  = UI.$('professionals-list');
            const count = UI.$('results-count');
            const s     = (UI.$('search-input')?.value  || '').toLowerCase();
            const catF  =  UI.$('category-filter')?.value || '';
            const cityF =  UI.$('city-filter')?.value     || '';
            const avlF  =  UI.$('avail-filter')?.value    || '';
            if (!grid) return;
            grid.innerHTML = '';

            const filtered = getAllProfessionals().filter(p => {
                const matchSearch = !s || [p.name, p.specialty, p.description, p.category].some(x => (x || '').toLowerCase().includes(s));
                return matchSearch
                    && (!catF  || (p.category     || '') === catF)
                    && (!cityF || (p.location      || '').includes(cityF))
                    && (!avlF  || (p.availability  || '') === avlF);
            });

            if (count) count.textContent = `${filtered.length} encontrado${filtered.length !== 1 ? 's' : ''}`;
            if (!filtered.length) { grid.innerHTML = '<p class="empty-state">😕 Nenhum profissional encontrado.</p>'; return; }
            filtered.forEach(p => ProfCards.render(grid, p));
        };

        return { show, renderProfessionals };
    })();

    /* ── Seções do profissional ── */
    const Professional = (() => {
        const SECTIONS = ['prof-section-requests', 'prof-section-chats'];

        const show = name => {
            SECTIONS.forEach(id => UI.hide(id));
            UI.show('prof-section-' + name);
            if (name === 'requests') renderClientRequests();
            if (name === 'chats')    Chat.renderProfChats();
        };

        const renderClientRequests = () => {
            const list = UI.$('client-requests-list');
            if (!list) return;
            const catF = UI.$('prof-cat-filter')?.value || '';
            const reqs = DB.getRequests().filter(r => r.status === 'open' && (!catF || r.category === catF));
            if (!reqs.length) { list.innerHTML = '<p class="empty-state">😊 Nenhuma solicitação aberta no momento.</p>'; return; }
            list.innerHTML = '';
            reqs.forEach(r => {
                const dist = Utils.estimateDistance(r.clientCity, State.currentUser.location || '');
                const card = document.createElement('div');
                card.className = 'request-card clickable';
                card.onclick   = () => ClientModal.open(r.id);
                card.innerHTML = `
                    <div class="request-header">
                        <div style="display:flex;align-items:center;gap:.6rem">
                            <div class="client-avatar-sm">${r.clientPhoto ? `<img src="${r.clientPhoto}">` : (r.clientName || 'C').charAt(0).toUpperCase()}</div>
                            <div>
                                <div class="request-title">${Utils.sanitize(r.title)}</div>
                                <div style="font-size:.78rem;color:var(--text-3)">${Utils.sanitize(r.clientName)} ${r.clientCity ? '· ' + Utils.sanitize(r.clientCity) : ''}</div>
                            </div>
                        </div>
                        <span class="request-status status-open">🟢 Aberta</span>
                    </div>
                    <div class="request-desc">${Utils.sanitize(r.desc)}</div>
                    <div class="request-meta">
                        ${r.category ? `<span>📂 ${Utils.sanitize(r.category)}</span>` : ''}
                        ${r.budget   ? `<span>💰 R$ ${Utils.sanitize(r.budget)}</span>` : ''}
                        ${dist       ? `<span>📏 ${dist}</span>` : ''}
                        <span>🕐 ${Utils.fmtDate(r.createdAt)}</span>
                    </div>
                    <button class="btn-primary" style="margin-top:.5rem;font-size:.82rem;padding:.5rem 1rem"
                        onclick="event.stopPropagation();ClientModal.open('${r.id}')">
                        👤 Ver Perfil & Responder
                    </button>`;
                list.appendChild(card);
            });
        };

        return { show, renderClientRequests };
    })();

    return { Client, Professional };
})();

// ═══════════════════════════════════════════════════════
//  PROF CARDS — Cards de profissional (visão cliente)
// ═══════════════════════════════════════════════════════
const ProfCards = (() => {
    const render = (container, prof) => {
        const avg    = Utils.avgRating(prof.reviews);
        const isFav  = State.favorites.includes(prof.id);
        const avatar = prof.photo ? `<img src="${prof.photo}" alt="${prof.name}">` : prof.name.charAt(0).toUpperCase();
        const dist   = Utils.estimateDistance(State.currentUser?.city, prof.location);

        const card = document.createElement('div');
        card.className = 'professional-card';
        card.onclick   = () => ProfModal.open(prof.id);
        card.innerHTML = `
            <div class="card-header">
                <div class="status-dot ${prof.status || 'offline'}"></div>
                <button class="fav-btn ${isFav ? 'active' : ''}" onclick="event.stopPropagation();Favorites.toggle('${prof.id}',this)" title="Favoritar">${isFav ? '❤️' : '🤍'}</button>
                <div class="card-avatar">${avatar}</div>
                <div class="card-name">${Utils.sanitize(prof.name)}</div>
                <div class="card-specialty">${Utils.sanitize(prof.specialty || prof.function || '')}</div>
                ${prof.reviews?.length ? `<div class="card-rating"><span class="stars">${Utils.getStars(avg)}</span><span class="rating-text">${avg} (${prof.reviews.length})</span></div>` : ''}
            </div>
            <div class="card-body">
                <div class="card-tags">
                    <span class="tag">${Utils.sanitize(prof.category || '')}</span>
                    ${prof.availability ? `<span class="tag green">${Utils.sanitize(prof.availability)}</span>` : ''}
                    ${(prof.serviceType || '').includes('Remoto') ? '<span class="tag green">🌐 Remoto</span>' : ''}
                </div>
                <div class="card-info-row">
                    ${prof.location   ? `<span class="card-info-item">📍 ${Utils.sanitize(prof.location)}</span>` : ''}
                    ${dist            ? `<span class="card-info-item">📏 ${dist}</span>` : ''}
                    ${prof.hourlyRate ? `<span class="card-info-item">💰 R$ ${prof.hourlyRate}/h</span>` : ''}
                </div>
                <div class="card-desc">${Utils.sanitize(prof.description || '')}</div>
                <div class="card-actions">
                    <button class="btn-primary" onclick="event.stopPropagation();ProfModal.open('${prof.id}')">Ver Perfil</button>
                    <button class="btn-chat"    onclick="event.stopPropagation();Chat.open('${prof.id}')" title="Iniciar conversa">💬 Chat</button>
                </div>
            </div>`;
        container.appendChild(card);
    };
    return { render };
})();

// ═══════════════════════════════════════════════════════
//  PROF MODAL — Modal de perfil do profissional (cliente)
// ═══════════════════════════════════════════════════════
const ProfModal = (() => {
    const _infoCard  = (label, val) =>
        `<div class="info-card"><div class="info-card-label">${label}</div><div class="info-card-value">${Utils.sanitize(String(val || '—'))}</div></div>`;
    const _tagList   = arr => arr?.length ? arr.map(t => `<span class="tag">${Utils.sanitize(t)}</span>`).join('') : '—';
    const _listItems = arr => arr?.length
        ? `<ul style="list-style:none">${arr.map(i => `<li style="font-size:.85rem;color:var(--text-2);padding:.15rem 0">✅ ${Utils.sanitize(i)}</li>`).join('')}</ul>`
        : '—';

    const open = id => {
        const prof = getAllProfessionals().find(p => p.id === id || p.id === String(id));
        if (!prof) return;

        const avg    = Utils.avgRating(prof.reviews);
        const avatar = prof.photo ? `<img src="${prof.photo}" alt="${prof.name}">` : prof.name.charAt(0).toUpperCase();
        const dist   = Utils.estimateDistance(State.currentUser?.city, prof.location);
        const reviews = prof.reviews?.map(r => `
            <div class="review-card">
                <div class="review-header">
                    <span class="review-user">👤 ${Utils.sanitize(r.user)}</span>
                    <span class="review-date">${r.date}</span>
                </div>
                <div class="review-stars">${Utils.getStars(r.rating)} ${r.rating}/5</div>
                <div class="review-text">${Utils.sanitize(r.text)}</div>
            </div>`).join('') || '<p style="color:var(--text-3);font-size:.85rem">Ainda sem avaliações.</p>';

        UI.setHTML('prof-modal-name', Utils.sanitize(prof.name));
        UI.setHTML('professional-modal-body', `
            <div class="prof-modal-header">
                <div class="prof-modal-avatar">${avatar}</div>
                <div class="prof-modal-info">
                    <h3>${Utils.sanitize(prof.name)}</h3>
                    <div class="specialty">${Utils.sanitize(prof.specialty || prof.function || '')} · ${Utils.sanitize(prof.category || '')}</div>
                    ${prof.reviews?.length ? `<div class="rating"><span style="color:#fbbf24">${Utils.getStars(parseFloat(avg))}</span><span style="color:rgba(255,255,255,.85);font-size:.85rem"> ${avg} (${prof.reviews.length} avaliações)</span></div>` : ''}
                    <span style="display:inline-flex;align-items:center;gap:.3rem;margin-top:.3rem;font-size:.8rem;color:rgba(255,255,255,.8)">
                        <span style="width:8px;height:8px;border-radius:50%;background:${prof.status === 'online' ? '#4ade80' : '#94a3b8'};display:inline-block"></span>
                        ${prof.status === 'online' ? 'Online agora' : 'Offline'}
                    </span>
                </div>
            </div>
            <div class="prof-modal-content">
                <div class="info-grid">
                    ${_infoCard('📍 Localização', prof.location)} ${dist ? _infoCard('📏 Distância', dist) : ''}
                    ${_infoCard('⏱️ Experiência', prof.experience)} ${_infoCard('💰 Valor/Hora', prof.hourlyRate ? 'R$ ' + prof.hourlyRate : '')}
                    ${_infoCard('📦 Mínimo', prof.minValue ? 'R$ ' + prof.minValue : '')} ${_infoCard('📅 Disponibilidade', prof.availability)}
                    ${_infoCard('📡 Raio', prof.serviceRadius)} ${_infoCard('🛡️ Seguro', prof.insurance)}
                </div>
                ${prof.description  ? `<div><div class="prof-section-title">Sobre</div><p style="font-size:.9rem;color:var(--text-2);line-height:1.6">${Utils.sanitize(prof.description)}</p></div>` : ''}
                ${prof.register     ? `<div><div class="prof-section-title">Registro</div><p style="font-weight:600">🏅 ${Utils.sanitize(prof.register)}</p></div>` : ''}
                ${prof.formations?.length     ? `<div><div class="prof-section-title">Formações</div>${_listItems(prof.formations)}</div>` : ''}
                ${prof.paymentMethods?.length ? `<div><div class="prof-section-title">Pagamento</div><div class="tags-list">${_tagList(prof.paymentMethods)}</div></div>` : ''}
                ${prof.languages?.length      ? `<div><div class="prof-section-title">Idiomas</div><div class="tags-list">${_tagList(prof.languages)}</div></div>` : ''}
                <div><div class="prof-section-title">Avaliações</div>${reviews}</div>
            </div>
            <div class="prof-modal-actions">
                <button class="btn-chat-lg" onclick="Modals.close('professional-modal');Chat.open('${prof.id}')">💬 Iniciar Chat</button>
                <button class="btn-outline" onclick="Modals.close('professional-modal')">Fechar</button>
            </div>`);

        Modals.open('professional-modal');
    };

    return { open };
})();

// ═══════════════════════════════════════════════════════
//  CLIENT MODAL — Modal de perfil do cliente (profissional)
// ═══════════════════════════════════════════════════════
const ClientModal = (() => {
    const open = requestId => {
        const req = DB.getRequests().find(r => r.id === requestId);
        if (!req) return;
        const client = DB.findUser(req.clientEmail) || { name: req.clientName, email: req.clientEmail, city: req.clientCity, photo: req.clientPhoto };
        const dist   = Utils.estimateDistance(State.currentUser.location || '', req.clientCity || client.city || '');
        const avatar = client.photo
            ? `<img src="${client.photo}" alt="${client.name}">`
            : (client.name || 'C').charAt(0).toUpperCase();

        UI.setHTML('cpm-title', '👤 Perfil do Cliente');
        UI.setHTML('client-profile-modal-body', `
            <div class="prof-modal-header" style="background:linear-gradient(135deg,#1e3a5f,#0ea5e9)">
                <div class="prof-modal-avatar">${avatar}</div>
                <div class="prof-modal-info">
                    <h3>${Utils.sanitize(client.name || 'Cliente')}</h3>
                    <div class="specialty" style="color:rgba(255,255,255,.85)">👤 Cliente · ${Utils.sanitize(client.city || req.clientCity || 'Localização não informada')}</div>
                    ${dist ? `<div style="margin-top:.4rem;font-size:.82rem;color:rgba(255,255,255,.75)">📏 ${dist} de você</div>` : ''}
                </div>
            </div>
            <div class="prof-modal-content">
                <div class="info-grid">
                    <div class="info-card"><div class="info-card-label">📍 Cidade</div><div class="info-card-value">${Utils.sanitize(client.city || req.clientCity || '—')}</div></div>
                    <div class="info-card"><div class="info-card-label">📏 Distância</div><div class="info-card-value">${dist || '—'}</div></div>
                    <div class="info-card"><div class="info-card-label">📂 Categoria</div><div class="info-card-value">${Utils.sanitize(req.category || 'Geral')}</div></div>
                    <div class="info-card"><div class="info-card-label">💰 Orçamento</div><div class="info-card-value">${req.budget ? 'R$ ' + Utils.sanitize(req.budget) : 'A combinar'}</div></div>
                </div>
                <div style="margin-top:1.2rem">
                    <div class="prof-section-title">🔧 Problema Relatado</div>
                    <div style="background:var(--surface-2);border-radius:12px;padding:1rem;margin-top:.5rem">
                        <div style="font-weight:700;font-size:.95rem;margin-bottom:.4rem;color:var(--text-1)">${Utils.sanitize(req.title)}</div>
                        <p style="font-size:.88rem;color:var(--text-2);line-height:1.6;white-space:pre-wrap">${Utils.sanitize(req.desc)}</p>
                    </div>
                </div>
                <div style="margin-top:.8rem;font-size:.78rem;color:var(--text-3)">🕐 Publicado em ${Utils.fmtDate(req.createdAt)}</div>
            </div>
            <div class="prof-modal-actions">
                <button class="btn-chat-lg" onclick="Modals.close('client-profile-modal');Chat.open(null,'${req.clientEmail}','${Utils.sanitize(req.clientName)}','${req.id}')">
                    💬 Iniciar Chat com o Cliente
                </button>
                <button class="btn-outline" onclick="Modals.close('client-profile-modal')">Fechar</button>
            </div>`);

        Modals.open('client-profile-modal');
    };

    return { open };
})();

// ═══════════════════════════════════════════════════════
//  FAVORITES — Favoritos
// ═══════════════════════════════════════════════════════
const Favorites = (() => {
    const toggle = (id, btn) => {
        const idx = State.favorites.indexOf(id);
        if (idx === -1) {
            State.favorites.push(id);
            if (btn) { btn.innerHTML = '❤️'; btn.classList.add('active'); }
            UI.showToast('Adicionado aos favoritos!');
        } else {
            State.favorites.splice(idx, 1);
            if (btn) { btn.innerHTML = '🤍'; btn.classList.remove('active'); }
            UI.showToast('Removido dos favoritos.');
        }
        DB.saveFavorites(State.favorites);
    };

    const render = () => {
        const grid = UI.$('favorites-list');
        if (!grid) return;
        grid.innerHTML = '';
        const favs = getAllProfessionals().filter(p => State.favorites.includes(p.id));
        if (!favs.length) { grid.innerHTML = '<p class="empty-state">Você ainda não favoritou nenhum profissional.</p>'; return; }
        favs.forEach(p => ProfCards.render(grid, p));
    };

    return { toggle, render };
})();

// ═══════════════════════════════════════════════════════
//  REQUESTS — Solicitações do cliente
// ═══════════════════════════════════════════════════════
const Requests = (() => {
    const openNew = () => { Modals.open('new-request-modal'); UI.setMsg('req-msg', '', ''); };

    const submit = () => {
        const title  = (UI.$('req-title')?.value  || '').trim();
        const desc   = (UI.$('req-desc')?.value   || '').trim();
        const cat    =  UI.$('req-category')?.value || '';
        const budget = (UI.$('req-budget')?.value  || '').trim();
        if (!title || !desc) { UI.setMsg('req-msg', '⚠️ Preencha título e descrição.', 'error'); return; }

        DB.upsertRequest({
            id: 'req-' + Date.now(),
            clientEmail: State.currentUser.email,
            clientName:  State.currentUser.name,
            clientCity:  State.currentUser.city  || '',
            clientPhoto: State.currentUser.photo || '',
            title, desc, category: cat, budget,
            status: 'open', createdAt: new Date().toISOString(),
        });

        UI.setMsg('req-msg', '✅ Solicitação publicada!', 'success');
        setTimeout(() => { Modals.close('new-request-modal'); renderMine(); }, 800);
    };

    const renderMine = () => {
        const list = UI.$('my-requests-list');
        if (!list) return;
        const reqs = DB.getRequests().filter(r => r.clientEmail === State.currentUser.email);
        if (!reqs.length) { list.innerHTML = '<p class="empty-state">Você ainda não publicou nenhuma solicitação.</p>'; return; }
        list.innerHTML = reqs.map(r => `
            <div class="request-card">
                <div class="request-header">
                    <span class="request-title">${Utils.sanitize(r.title)}</span>
                    <span class="request-status status-${r.status}">${r.status === 'open' ? '🟢 Aberta' : '✅ Resolvida'}</span>
                </div>
                <div class="request-desc">${Utils.sanitize(r.desc)}</div>
                <div class="request-meta">
                    ${r.category ? `<span>📂 ${Utils.sanitize(r.category)}</span>` : ''}
                    ${r.budget   ? `<span>💰 Orçamento: R$ ${Utils.sanitize(r.budget)}</span>` : ''}
                    <span>🕐 ${Utils.fmtDate(r.createdAt)}</span>
                </div>
                <button class="btn-ghost danger small" onclick="Requests.remove('${r.id}')">🗑️ Remover</button>
            </div>`).join('');
    };

    const remove = id => { DB.saveRequests(DB.getRequests().filter(r => r.id !== id)); renderMine(); };

    return { openNew, submit, renderMine, remove };
})();

// ═══════════════════════════════════════════════════════
//  CHAT — Chat interno
// ═══════════════════════════════════════════════════════
const Chat = (() => {
    const _renderMessages = roomId => {
        const container = UI.$('chat-messages');
        if (!container) return;
        const msgs = DB.getMessages(roomId);
        container.innerHTML = msgs.length
            ? msgs.map(m => `
                <div class="chat-bubble ${m.senderEmail === State.currentUser.email ? 'sent' : 'received'}">
                    <div class="bubble-text">${Utils.sanitize(m.text)}</div>
                    <div class="bubble-time">${Utils.fmtTime(m.ts)}</div>
                </div>`).join('')
            : '<div class="chat-empty">Envie uma mensagem para iniciar a conversa 👋</div>';
        container.scrollTop = container.scrollHeight;
    };

    const open = (profId, targetEmail, targetName, requestId, existingRoomId) => {
        let otherEmail = targetEmail;
        let otherName  = targetName;
        let roomId     = existingRoomId;

        if (!otherEmail && profId) {
            const prof = getAllProfessionals().find(p => p.id === profId || p.id === String(profId));
            if (!prof) return;
            otherEmail = prof.userEmail || prof.id;
            otherName  = prof.name;
        }

        if (!roomId) roomId = [State.currentUser.email, otherEmail].sort().join('_');

        State.activeChatRoom = roomId;

        const msgs = DB.getMessages(roomId);
        msgs.forEach(m => { if (m.senderEmail !== State.currentUser.email) m.read = true; });
        DB.saveMessages(roomId, msgs);

        UI.setHTML('chat-modal-title', `💬 ${Utils.sanitize(otherName || 'Chat')}`);
        UI.setHTML('chat-other-name',  otherName || '');
        UI.setHTML('chat-request-ref', requestId ? 'Ref: solicitação #' + requestId.slice(-6) : '');
        Modals.open('chat-modal');
        _renderMessages(roomId);

        const btn = UI.$('chat-send-btn');
        if (btn) { btn.dataset.room = roomId; btn.dataset.otherEmail = otherEmail; }

        if (State.chatPollTimer) clearInterval(State.chatPollTimer);
        State.chatPollTimer = setInterval(() => _renderMessages(roomId), 2000);
    };

    const send = () => {
        const inp  = UI.$('chat-input');
        const text = (inp?.value || '').trim();
        if (!text || !State.activeChatRoom) return;
        DB.addMessage(State.activeChatRoom, {
            id: Date.now(), roomId: State.activeChatRoom,
            senderEmail: State.currentUser.email,
            senderName:  State.currentUser.name,
            text, ts: Date.now(), read: false,
        });
        inp.value = '';
        _renderMessages(State.activeChatRoom);
    };

    const close = () => {
        if (State.chatPollTimer) clearInterval(State.chatPollTimer);
        State.activeChatRoom = null;
        Modals.close('chat-modal');
    };

    const renderProfChats = () => {
        const list = UI.$('prof-chats-list');
        if (!list) return;
        const myRooms = Object.keys(localStorage).filter(k => k.startsWith('av_chat_') && k.includes(State.currentUser.email));
        if (!myRooms.length) { list.innerHTML = '<p class="empty-state">Nenhuma conversa ainda.</p>'; return; }
        list.innerHTML = '';
        myRooms.forEach(k => {
            const roomId     = k.replace('av_chat_', '');
            const msgs       = DB.getMessages(roomId);
            if (!msgs.length) return;
            const last       = msgs[msgs.length - 1];
            const otherEmail = roomId.replace(State.currentUser.email, '').replace(/_/g, '').trim() || '';
            const otherUser  = DB.findUser(otherEmail) || { name: otherEmail };
            const unread     = msgs.filter(m => m.senderEmail !== State.currentUser.email && !m.read).length;
            const div = document.createElement('div');
            div.className = 'chat-list-item';
            div.onclick   = () => open(null, otherEmail, otherUser.name, null, roomId);
            div.innerHTML = `
                <div class="cli-avatar">${otherUser.photo ? `<img src="${otherUser.photo}">` : (otherUser.name || '?').charAt(0).toUpperCase()}</div>
                <div class="cli-info">
                    <div class="cli-name">${Utils.sanitize(otherUser.name || otherEmail)}</div>
                    <div class="cli-last">${Utils.sanitize(last.text || '').slice(0, 40)}${last.text?.length > 40 ? '...' : ''}</div>
                </div>
                ${unread ? `<span class="unread-badge">${unread}</span>` : ''}
                <span class="cli-time">${Utils.fmtTime(last.ts)}</span>`;
            list.appendChild(div);
        });
    };

    return { open, send, close, renderProfChats };
})();

// ═══════════════════════════════════════════════════════
//  PROFILE — Modal de editar perfil do usuário logado
// ═══════════════════════════════════════════════════════
const Profile = (() => {
    const open = () => {
        const u = State.currentUser;
        if (!u) return;
        UI.setValue('profile-name',  u.name  || '');
        UI.setValue('profile-email', u.email || '');
        UI.setValue('profile-phone', u.phone || '');
        UI.setValue('profile-city',  u.city  || '');
        UI.setValue('profile-bio',   u.bio   || '');
        const prev = UI.$('profile-photo-preview');
        if (prev) prev.innerHTML = u.photo
            ? `<img src="${u.photo}" alt="Foto">`
            : (u.name || 'U').charAt(0).toUpperCase();
        UI.toggle('profile-pro-fields', u.type === 'professional');
        if (u.type === 'professional') {
            Phone.initField('profile-whatsapp', u.whatsappCountry || 'BR');
            setTimeout(() => UI.setValue('profile-whatsapp', u.whatsappRaw || ''), 20);
            UI.setValue('profile-specialty',    u.specialty    || '');
            UI.setValue('profile-hourly',       u.hourlyRate   || '');
            UI.setValue('profile-availability', u.availability || '');
            UI.setValue('profile-description',  u.description  || '');
            UI.setValue('profile-location',     u.location     || '');
        }
        Modals.open('profile-modal');
    };

    const save = () => {
        const u = State.currentUser;
        if (!u) return;
        u.name  = UI.$('profile-name')?.value.trim()  || u.name;
        u.email = UI.$('profile-email')?.value.trim() || u.email;
        u.phone = UI.$('profile-phone')?.value || '';
        u.city  = UI.$('profile-city')?.value  || '';
        u.bio   = UI.$('profile-bio')?.value   || '';
        if (u.type === 'professional') {
            const waRaw = UI.$('profile-whatsapp')?.value || '';
            if (waRaw.trim()) {
                u.whatsappRaw     = waRaw;
                u.whatsapp        = Phone.buildNumber('profile-whatsapp');
                u.whatsappCountry = Phone.getSelectedCountry('profile-whatsapp');
            }
            u.specialty    = UI.$('profile-specialty')?.value    || u.specialty    || '';
            u.hourlyRate   = parseFloat(UI.$('profile-hourly')?.value) || u.hourlyRate || 0;
            u.availability = UI.$('profile-availability')?.value || u.availability || '';
            u.description  = UI.$('profile-description')?.value  || u.description  || '';
            u.location     = UI.$('profile-location')?.value     || u.location     || '';
        }
        DB.upsertUser(u);
        DB.saveSession(u);
        if (u.type === 'professional') {
            DB.upsertProfessional(buildProfEntry(u));
            Sections.Professional.renderClientRequests();
        }
        Sidebar.update();
        Modals.close('profile-modal');
        UI.showToast('✅ Perfil atualizado e salvo!');
    };

    return { open, save };
})();

// ═══════════════════════════════════════════════════════
//  PHOTO — Upload e remoção de foto de perfil
// ═══════════════════════════════════════════════════════
const Photo = (() => {
    const _persist = () => {
        const u = State.currentUser;
        DB.upsertUser(u);
        DB.saveSession(u);
        if (u.type === 'professional') DB.upsertProfessional(buildProfEntry(u));
        Sidebar.update();
    };

    const upload = input => {
        const file = input.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { UI.showToast('⚠️ Máximo 5MB.', 'error'); return; }
        const reader = new FileReader();
        reader.onload = e => {
            State.currentUser.photo = e.target.result;
            _persist();
            const prev = UI.$('profile-photo-preview');
            if (prev) prev.innerHTML = `<img src="${State.currentUser.photo}" alt="Foto">`;
            UI.showToast('📷 Foto atualizada!');
        };
        reader.readAsDataURL(file);
    };

    const remove = () => {
        if (!State.currentUser) return;
        State.currentUser.photo = '';
        _persist();
        const prev = UI.$('profile-photo-preview');
        if (prev) prev.textContent = (State.currentUser.name || 'U').charAt(0).toUpperCase();
        UI.showToast('🗑️ Foto removida.');
    };

    return { upload, remove };
})();

// ═══════════════════════════════════════════════════════
//  SUPPORT — Modal de suporte
// ═══════════════════════════════════════════════════════
const Support = (() => {
    const open = () => {
        const u = State.currentUser;
        if (u) { UI.setValue('support-name', u.name || ''); UI.setValue('support-email', u.email || ''); }
        UI.setMsg('support-msg', '', '');
        Modals.open('support-modal');
    };

    const send = () => {
        const name    = (UI.$('support-name')?.value    || '').trim();
        const email   = (UI.$('support-email')?.value   || '').trim();
        const subject =  UI.$('support-subject')?.value || 'Dúvida';
        const message = (UI.$('support-message')?.value || '').trim();
        if (!name || !email || !message) { UI.setMsg('support-msg', '⚠️ Preencha todos os campos.', 'error'); return; }
        const wa   = '5500000000000';
        const wMsg = encodeURIComponent(`*Suporte Avalia.Serv*\nNome: ${name}\nE-mail: ${email}\nAssunto: ${subject}\n\n${message}`);
        UI.setMsg('support-msg', '✅ Redirecionando...', 'success');
        setTimeout(() => { window.open(`https://wa.me/${wa}?text=${wMsg}`, '_blank'); Modals.close('support-modal'); UI.showToast('✅ Suporte aberto!'); }, 800);
    };

    return { open, send };
})();

// ═══════════════════════════════════════════════════════
//  DONATION — Modal de doação
// ═══════════════════════════════════════════════════════
const Donation = (() => {
    const open = () => {
        UI.setMsg('donation-msg', '', '');
        Modals.open('donation-modal');
        select(document.querySelector('.donation-option'), 5);
    };

    const select = (el, amount) => {
        document.querySelectorAll('.donation-option').forEach(o => o.classList.remove('selected'));
        if (!el) return;
        el.classList.add('selected');
        el.dataset.selectedAmount = amount;
        const lbl = UI.$('donation-amount-label');
        if (lbl) lbl.textContent = 'R$ ' + parseFloat(amount).toFixed(2).replace('.', ',');
    };

    const process = () => {
        const custom = UI.$('donation-custom-value')?.value;
        const amount = custom || document.querySelector('.donation-option.selected')?.dataset.selectedAmount || '5';
        const pix    = 'suporte@avalia.serv';
        const msgEl  = UI.$('donation-msg');
        if (msgEl) {
            msgEl.innerHTML = `<div style="text-align:center;padding:1rem 0">
                <div style="font-size:2.5rem;margin-bottom:.5rem">❤️</div>
                <strong>Muito obrigado!</strong><br>
                <span style="font-size:.88rem;color:var(--text-2)">
                    Doe <strong>R$ ${parseFloat(amount).toFixed(2).replace('.', ',')}</strong> via PIX:<br>
                    <strong style="color:var(--primary)">${pix}</strong><br>
                    <small>Copie e cole no app do banco 💙</small>
                </span></div>`;
            msgEl.className = 'form-message success';
        }
    };

    return { open, select, process };
})();

// ═══════════════════════════════════════════════════════
//  FAB — Botão flutuante
// ═══════════════════════════════════════════════════════
const FAB = (() => {
    const toggle = () => {
        const menu = UI.$('fab-menu');
        const btn  = UI.$('fab-main');
        const icon = UI.$('fab-main-icon');
        const open = menu.classList.toggle('open');
        btn.classList.toggle('open', open);
        if (icon) icon.textContent = open ? '✕' : '❓';
    };

    const bindOutsideClick = () => {
        document.addEventListener('click', e => {
            const fab = UI.$('fab-container');
            if (fab && !fab.contains(e.target)) {
                UI.$('fab-menu')?.classList.remove('open');
                UI.$('fab-main')?.classList.remove('open');
                const ic = UI.$('fab-main-icon');
                if (ic) ic.textContent = '❓';
            }
        });
    };

    return { toggle, bindOutsideClick };
})();

// ═══════════════════════════════════════════════════════
//  APP — Inicialização principal
// ═══════════════════════════════════════════════════════
function initApp() {
    Modals.close('login-modal');
    Modals.close('signup-modal');
    UI.show('main-content');
    State.currentUser.type === 'professional' ? Views.showProfessional() : Views.showClient();
    Sidebar.update();
    Theme.load();
}

function setNavActive(btn) {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

// ═══════════════════════════════════════════════════════
//  BOOT — DOMContentLoaded
// ═══════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    const session = DB.getSession();
    if (session?.email) {
        State.currentUser = DB.findUser(session.email) || session;
        DB.saveSession(State.currentUser);
        initApp();
    } else {
        Modals.open('login-modal');
    }

    Theme.load();
    Modals.bindOverlayClose();
    FAB.bindOutsideClick();

    UI.$('search-input')?.addEventListener('input', Sections.Client.renderProfessionals);
    UI.$('chat-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); Chat.send(); }
    });

    UI.$('signup-cpf')?.addEventListener('input', function () {
        let v = this.value.replace(/\D/g, '').slice(0, 11);
        if      (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
        else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/,        '$1.$2.$3');
        else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/,               '$1.$2');
        this.value = v;
    });
});

// ═══════════════════════════════════════════════════════
//  BRIDGE — Aliases globais para compatibilidade com
//  os atributos onclick no HTML
// ═══════════════════════════════════════════════════════
const showLogin                = Auth.showLogin;
const showSignup               = Auth.showSignup;
const toggleProfessionalFields = Auth.toggleProfessionalFields;
const loginUser                = Auth.loginUser;
const registerUser             = Auth.registerUser;
const logout                   = Auth.logout;
const confirmDeleteAccount     = Auth.confirmDeleteAccount;
const deleteAccount            = Auth.deleteAccount;
const showForgotPassword       = Auth.showForgotPassword;
const sendPasswordReset        = Auth.sendPasswordReset;
const verifyResetToken         = Auth.verifyResetToken;
const saveNewPassword          = Auth.saveNewPassword;

const closeModal               = Modals.close;
const openModal                = Modals.open;

const toggleTheme              = Theme.toggle;

const openProfileModal         = Profile.open;
const updateProfile            = Profile.save;

const handlePhotoUpload        = Photo.upload;
const removePhoto              = Photo.remove;

const openSupportModal         = Support.open;
const sendSupportMessage       = Support.send;

const openDonationModal        = Donation.open;
const selectDonation           = Donation.select;
const processDonation          = Donation.process;

const toggleFAB                = FAB.toggle;

const showSection              = Sections.Client.show;
const renderProfessionals      = Sections.Client.renderProfessionals;

const showProfessionalView     = Views.showProfessional;
const showClientView           = Views.showClient;
const showProfSection          = Sections.Professional.show;
const renderClientRequests     = Sections.Professional.renderClientRequests;

const openNewRequestModal      = Requests.openNew;
const submitRequest            = Requests.submit;
const renderMyRequests         = Requests.renderMine;
const deleteRequest            = Requests.remove;

const openProfessionalModal    = ProfModal.open;
const openClientProfileModal   = ClientModal.open;

const toggleFavorite           = Favorites.toggle;
const renderFavorites          = Favorites.render;

const openChat                 = Chat.open;
const sendChatMessage          = Chat.send;
const closeChatModal           = Chat.close;
const renderProfChats          = Chat.renderProfChats;

const onDDIChange              = Phone.onDDIChange;
