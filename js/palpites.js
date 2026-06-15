import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { listaJogos } from "./jogos.js";

const firebaseConfig = {
  apiKey: "AIzaSyAEz3x9NpVjnUSbk3F1mmqT3_Yq_9lpHSQ",
  authDomain: "bolao-do-bizzao.firebaseapp.com",
  projectId: "bolao-do-bizzao",
  storageBucket: "bolao-do-bizzao.firebasestorage.app",
  messagingSenderId: "984055906045",
  appId: "1:984055906045:web:2320df29a6bfa04f92c894"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- TRAVA TEMPORAL ---
const DATA_LIMITE_GRUPOS = new Date("2026-06-11T16:00:00Z"); // Ajuste para o 1º jogo da Copa

let usuarioLogado = null;
let rodadaAtual = 1;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioLogado = user;
        const uDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (uDoc.exists()) {
            document.getElementById('boas-vindas').innerHTML = `Olá, ${uDoc.data().nome}! <br><b>${uDoc.data().pontos || 0} pts</b>`;
        }
        renderizarJogos();
    } else { window.location.href = "index.html"; }
});

async function renderizarJogos() {
    const container = document.getElementById('container-jogos');
    const titulos = { 1:"Rodada 1", 2:"Rodada 2", 3:"Rodada 3", 4:"16-avos", 5:"Oitavas", 6:"Quartas", 7:"Semi", 8:"Final" };
    document.getElementById('titulo-rodada').innerText = titulos[rodadaAtual];
    container.innerHTML = "Carregando...";

    let exibicao = [];
    if (rodadaAtual <= 3) {
        exibicao = listaJogos.filter(j => j.rodada === rodadaAtual);
    } else {
        const fases = { 4:'16avos', 5:'oitavas', 6:'quartas', 7:'semi', 8:'final' };
        const q = query(collection(db, "jogos_matamata"), where("fase", "==", fases[rodadaAtual]));
        const snap = await getDocs(q);
        snap.forEach(d => exibicao.push(d.data()));
    }

    if (exibicao.length === 0) {
        container.innerHTML = "<p>Confrontos não definidos.</p>";
        return;
    }

    container.innerHTML = "";
    if (rodadaAtual <= 3) {
        const grupos = {};
        exibicao.forEach(j => { if(!grupos[j.grupo]) grupos[j.grupo] = []; grupos[j.grupo].push(j); });
        for (const g in grupos) {
            let html = `<div class="grupo-caixa"><h4 class="grupo-titulo">Grupo ${g}</h4>
                <div class="classificacao-palpite">${gerarSeletores(g)}</div><hr>`;
            grupos[g].forEach(j => html += card(j));
            container.innerHTML += html + `</div>`;
        }
    } else {
        let html = `<div class="grupo-caixa">`;
        exibicao.forEach(j => html += card(j));
        container.innerHTML += html + `</div>`;
    }
    carregarPalpites();
}

function gerarSeletores(g) {
    const agora = new Date();
    const bloqueado = agora >= DATA_LIMITE_GRUPOS;
    const times = [...new Set(listaJogos.filter(j => j.grupo === g).flatMap(j => [j.timeA, j.timeB]))];
    
    return [1,2,3,4].map(i => `<div class="linha-classif"><span>${i}º</span>
        <select id="pos-${g}-${i}" class="select-posicao" data-grupo="${g}" ${bloqueado ? 'disabled' : ''}>
            <option value="">-</option>
            ${times.map(t => `<option value="${t}">${t}</option>`).join('')}
        </select></div>`).join('');
}

// --- TRAVA DE REPETIÇÃO ---
document.addEventListener('change', (e) => {
    if (e.target.classList.contains('select-posicao')) {
        const grupo = e.target.getAttribute('data-grupo');
        const selects = document.querySelectorAll(`.select-posicao[data-grupo="${grupo}"]`);
        const valores = [];
        
        selects.forEach(s => {
            if (s.value !== "") {
                if (valores.includes(s.value)) {
                    alert("Você não pode repetir a mesma seleção no grupo!");
                    e.target.value = "";
                } else {
                    valores.push(s.value);
                }
            }
        });
    }
});

function card(j) {
    const jaComecou = new Date() >= new Date(j.dataInicio);
    const emojiParaSigla = { 
        "🇲🇽":"mx", "🇿🇦":"za", "🇰🇷":"kr", "🇨🇿":"cz", "🇨🇦":"ca", "🇧🇦":"ba", 
        "🇶🇦":"qa", "🇨🇭":"ch", "🇧🇷":"br", "🇲🇦":"ma", "🇭🇹":"ht", "🏴󠁧󠁢󠁳󠁣󠁴󠁿":"gb-sct", 
        "🇺🇸":"us", "🇵🇾":"py", "🇦🇺":"au", "🇹🇷":"tr", "🇩🇪":"de", "🇨🇼":"cw", 
        "🇨🇮":"ci", "🇪🇨":"ec", "🇳🇱":"nl", "🇯🇵":"jp", "🇸🇪":"se", "🇹🇳":"tn", 
        "🇧🇪":"be", "🇪🇬":"eg", "🇮🇷":"ir", "🇳🇿":"nz", "🇪🇸":"es", "🇨🇻":"cv", 
        "🇸🇦":"sa", "🇺🇾":"uy", "🇫🇷":"fr", "🇸🇳":"sn", "🇮🇶":"iq", "🇳🇴":"no", 
        "🇦🇷":"ar", "🇩🇿":"dz", "🇦🇹":"at", "🇯🇴":"jo", "🇵🇹":"pt", "🇨🇩":"cd", 
        "🇺🇿":"uz", "🇨🇴":"co", "🏴󠁧󠁢󠁥󠁮󠁧󠁿":"gb-eng", "🇭🇷":"hr", "🇬罕":"gh", "🇵🇦":"pa" 
    };
    const siglaA = emojiParaSigla[j.bandeiraA] || 'un';
    const siglaB = emojiParaSigla[j.bandeiraB] || 'un';

    return `
    <div class="jogo-card ${jaComecou ? 'bloqueado' : ''}">
        <div class="placar-area">
            <div class="time">
                <img src="https://flagcdn.com/w40/${siglaA}.png">
                <span>${j.timeA}</span>
                <input type="number" id="input-${j.id}-A" class="placar-input" ${jaComecou ? 'disabled' : ''}>
            </div>
            <span class="vs">X</span>
            <div class="time direita">
                <input type="number" id="input-${j.id}-B" class="placar-input" ${jaComecou ? 'disabled' : ''}>
                <span>${j.timeB}</span>
                <img src="https://flagcdn.com/w40/${siglaB}.png">
            </div>
        </div>
    </div>`;
}

document.getElementById('btn-salvar')?.addEventListener('click', async () => {
    const dadosParaSalvar = {}, agora = new Date();
    
    // 1. Coleta jogos da lista fixa (Apenas os que não começaram)
    listaJogos.forEach(j => {
        if(agora < new Date(j.dataInicio)) {
            const a = document.getElementById(`input-${j.id}-A`)?.value;
            const b = document.getElementById(`input-${j.id}-B`)?.value;
            if(a !== "" && b !== "" && a !== undefined && b !== undefined) {
                // Notação de ponto atualiza apenas a sub-chave do jogo
                dadosParaSalvar[`palpites.${j.id}`] = { a:parseInt(a), b:parseInt(b) };
            }
        }
    });

    // 2. Coleta jogos do Mata-mata (Apenas os que não começaram)
    const mataSnap = await getDocs(collection(db, "jogos_matamata"));
    mataSnap.forEach(d => {
        const j = d.data();
        if(agora < new Date(j.dataInicio)) {
            const a = document.getElementById(`input-${j.id}-A`)?.value;
            const b = document.getElementById(`input-${j.id}-B`)?.value;
            if(a !== "" && b !== "" && a !== undefined && b !== undefined) {
                dadosParaSalvar[`palpites.${j.id}`] = { a:parseInt(a), b:parseInt(b) };
            }
        }
    });

    // 3. Coleta Posições de Grupo (Apenas se o prazo geral não venceu e os elementos estão na tela)
    if(agora < DATA_LIMITE_GRUPOS && document.querySelector('.select-posicao')) {
        ["A","B","C","D","E","F","G","H","I","J","K","L"].forEach(g => {
            if (document.getElementById(`pos-${g}-1`)) {
                const cols = [1,2,3,4].map(i => document.getElementById(`pos-${g}-${i}`)?.value || "");
                if(cols.some(c => c !== "")) {
                    dadosParaSalvar[`posicoes.${g}`] = cols;
                }
            }
        });
    }

    // Se não houver nada para salvar, cancela a operação
    if (Object.keys(dadosParaSalvar).length === 0) {
        alert("Nenhum palpite elegível para alteração no momento!");
        return;
    }

    try {
        // O updateDoc atualiza cirurgicamente apenas os campos mapeados,
        // sem nunca apagar o resto do documento!
        await updateDoc(doc(db, "palpites", usuarioLogado.uid), dadosParaSalvar);
        alert("Palpites salvos com sucesso! ⚽");
    } catch (error) {
        // Proteção caso o documento principal falte (Raro)
        if (error.code === 'not-found') {
            const objetoEstruturado = { palpites: {}, posicoes: {} };
            for (const chave in dadosParaSalvar) {
                const partes = chave.split('.');
                objetoEstruturado[partes[0]][partes[1]] = dadosParaSalvar[chave];
            }
            await setDoc(doc(db, "palpites", usuarioLogado.uid), objetoEstruturado, { merge: true });
            alert("Palpites salvos com sucesso! ⚽");
        } else {
            alert("Erro ao salvar: " + error.message);
        }
    }
});

async function carregarPalpites() {
    const snap = await getDoc(doc(db, "palpites", usuarioLogado.uid));
    if(snap.exists()) {
        const d = snap.data();
        if(d.palpites) for(const id in d.palpites) {
            if(document.getElementById(`input-${id}-A`)) {
                document.getElementById(`input-${id}-A`).value = d.palpites[id].a;
                document.getElementById(`input-${id}-B`).value = d.palpites[id].b;
            }
        }
        if(d.posicoes) for(const g in d.posicoes) {
            d.posicoes[g].forEach((t, i) => { 
                if(document.getElementById(`pos-${g}-${i+1}`)) document.getElementById(`pos-${g}-${i+1}`).value = t; 
            });
        }
    }
}

document.getElementById('btn-rodada-prox')?.addEventListener('click', () => { if(rodadaAtual<8){ rodadaAtual++; renderizarJogos(); }});
document.getElementById('btn-rodada-ant')?.addEventListener('click', () => { if(rodadaAtual>1){ rodadaAtual--; renderizarJogos(); }});
document.getElementById('btn-sair')?.addEventListener('click', () => signOut(auth).then(() => window.location.href="index.html"));