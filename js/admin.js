import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, query, where, deleteDoc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
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
const db = getFirestore(app);
const auth = getAuth(app);

const SEU_EMAIL = "sidocha19@gmail.com"; // AJUSTE AQUI
let rodadaAtual = 1;

onAuthStateChanged(auth, (user) => {
    if (!user || user.email !== SEU_EMAIL) {
        alert("Acesso negado!");
        window.location.href = "palpites.html";
    }
    atualizarTelaAdmin();
});

// NAVEGAÇÃO
document.getElementById('btn-rodada-prox')?.addEventListener('click', () => {
    if (rodadaAtual < 8) { rodadaAtual++; atualizarTelaAdmin(); }
});

document.getElementById('btn-rodada-ant')?.addEventListener('click', () => {
    if (rodadaAtual > 1) { rodadaAtual--; atualizarTelaAdmin(); }
});

document.getElementById('btn-voltar')?.addEventListener('click', () => {
    window.location.href = "palpites.html";
});

function atualizarTelaAdmin() {
    document.getElementById('titulo-rodada').innerText = "Rodada " + rodadaAtual;
    if (rodadaAtual <= 3) {
        renderizarAdminFaseGrupos();
        document.getElementById('container-admin-grupos').style.display = 'grid';
        renderizarAdminGruposClassif();
    } else {
        renderizarAdminMataMata();
        document.getElementById('container-admin-grupos').style.display = 'none';
    }
}

// RENDERIZAR JOGOS DA FASE DE GRUPOS
async function renderizarAdminFaseGrupos() {
    const container = document.getElementById('container-admin');
    const resDoc = await getDoc(doc(db, "resultados", "oficiais"));
    const oficiais = resDoc.exists() ? resDoc.data() : {};

    container.innerHTML = "";
    const jogos = listaJogos.filter(j => j.rodada === rodadaAtual);

    jogos.forEach(jogo => {
        const resA = oficiais[jogo.id]?.a ?? "";
        const resB = oficiais[jogo.id]?.b ?? "";
        container.innerHTML += templateCardAdmin(jogo, resA, resB);
    });
}

// RENDERIZAR JOGOS DE MATA-MATA
async function renderizarAdminMataMata() {
    const container = document.getElementById('container-admin');
    const nomesFases = { 4: '16avos', 5: 'oitavas', 6: 'quartas', 7: 'semi', 8: 'final' };
    const fase = nomesFases[rodadaAtual];

    const q = query(collection(db, "jogos_matamata"), where("fase", "==", fase));
    const snap = await getDocs(q);
    const resDoc = await getDoc(doc(db, "resultados", "oficiais"));
    const oficiais = resDoc.exists() ? resDoc.data() : {};

    container.innerHTML = snap.empty ? "<p>Nenhum jogo criado para esta fase.</p>" : "";
    snap.forEach(d => {
        const jogo = d.data();
        const resA = oficiais[jogo.id]?.a ?? "";
        const resB = oficiais[jogo.id]?.b ?? "";
        container.innerHTML += templateCardAdmin(jogo, resA, resB);
    });
}

function templateCardAdmin(jogo, resA, resB) {
    return `
        <div class="jogo-card">
            <div class="placar-area">
                <span>${jogo.timeA}</span>
                <input type="number" id="res-${jogo.id}-A" value="${resA}" class="placar-input">
                <span>X</span>
                <input type="number" id="res-${jogo.id}-B" value="${resB}" class="placar-input">
                <span>${jogo.timeB}</span>
            </div>
            <button onclick="window.salvarResultado('${jogo.id}')">OK</button>
        </div>
    `;
}

// SALVAR RESULTADO OFICIAL
window.salvarResultado = async (jogoId) => {
    const a = document.getElementById(`res-${jogoId}-A`).value;
    const b = document.getElementById(`res-${jogoId}-B`).value;
    if (a === "" || b === "") return alert("Preencha o placar!");

    await setDoc(doc(db, "resultados", "oficiais"), {
        [jogoId]: { a: parseInt(a), b: parseInt(b) }
    }, { merge: true });
    alert("Resultado salvo!");
};

// --- NOVIDADE: CRIAR JOGO COM BANDEIRAS ---
document.getElementById('btn-criar-jogo')?.addEventListener('click', async () => {
    const fase = document.getElementById('mata-fase').value;
    const timeA = document.getElementById('mata-timeA').value;
    const timeB = document.getElementById('mata-timeB').value;
    const data = document.getElementById('mata-data').value;
    
    // Peça para o admin colocar o emoji da bandeira (ex: 🇧🇷) 
    // ou adicione inputs específicos para isso no HTML
    const bandA = prompt("Cole o emoji da bandeira do Time A (ex: 🇧🇷):");
    const bandB = prompt("Cole o emoji da bandeira do Time B (ex: 🇦🇷):");

    if(!timeA || !timeB || !data || !bandA || !bandB) return alert("Preencha tudo!");

    const id = "mata_" + Date.now();
    await setDoc(doc(db, "jogos_matamata", id), {
        id, fase, timeA, timeB,
        bandeiraA: bandA, // Agora salvamos a bandeira!
        bandeiraB: bandB,
        dataInicio: new Date(data).toISOString(),
        multiplicador: (fase === 'semi' || fase === 'final') ? 2 : (fase === '16avos' ? 1 : 1.5)
    });
    alert("Jogo criado com sucesso!");
    atualizarTelaAdmin();
});

// --- FUNÇÃO PARA APAGAR/RESETAR RESULTADOS ---
document.getElementById('btn-reset-oficiais')?.addEventListener('click', async () => {
    if(confirm("Tem certeza que deseja APAGAR todos os resultados oficiais? Isso zerará o cálculo do ranking.")){
        await setDoc(doc(db, "resultados", "oficiais"), {}); // Limpa o objeto de resultados
        await deleteDoc(doc(db, "resultados", "historico_ranking")); // Limpa o histórico do gráfico (evita pontos órfãos)
        alert("Resultados oficiais resetados!");
        location.reload();
    }
});

document.getElementById('btn-limpar-mata')?.addEventListener('click', async () => {
    if(confirm("Deseja apagar TODOS os jogos de mata-mata criados?")){
        const snap = await getDocs(collection(db, "jogos_matamata"));
        // O Firebase não apaga coleções inteiras de uma vez via JS simples, 
        // então deletamos um por um
        const promises = snap.docs.map(d => deleteDoc(d.ref)); 
        await Promise.all(promises);
        alert("Jogos de mata-mata removidos!");
        location.reload();
    }
});

// --- RESETAR CLASSIFICAÇÃO DOS GRUPOS ---
document.getElementById('btn-reset-grupos')?.addEventListener('click', async () => {
    if(confirm("Deseja APAGAR a classificação oficial de todos os grupos?")){
        try {
            // No Firestore, para resetar um documento específico, podemos deletá-lo
            await deleteDoc(doc(db, "resultados", "grupos_oficiais"));
            alert("Classificação dos grupos resetada com sucesso!");
            location.reload();
        } catch (error) {
            console.error("Erro ao resetar grupos:", error);
            alert("Erro ao limpar dados.");
        }
    }
});

// CLASSIFICAÇÃO DE GRUPOS
async function renderizarAdminGruposClassif() {
    const container = document.getElementById('container-admin-grupos');
    const resDoc = await getDoc(doc(db, "resultados", "grupos_oficiais"));
    const oficiais = resDoc.exists() ? resDoc.data() : {};

    const letras = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
    container.innerHTML = "";
    letras.forEach(letra => {
        const times = [...new Set(listaJogos.filter(j => j.grupo === letra).flatMap(j => [j.timeA, j.timeB]))];
        const salvo = oficiais[letra] || ["", "", "", ""];
        let html = `<div class="grupo-caixa"><h4 class="grupo-titulo">Grupo ${letra}</h4>`;
        for (let i = 1; i <= 4; i++) {
            html += `<div class="linha-classif"><span>${i}º</span>
                <select id="oficial-${letra}-${i}" class="select-posicao"><option value="">-</option>
                ${times.map(t => `<option value="${t}" ${salvo[i-1] === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`;
        }
        html += `<button onclick="window.salvarGrupoOficial('${letra}')" style="width:100%;margin-top:10px">Salvar</button></div>`;
        container.innerHTML += html;
    });
}

window.salvarGrupoOficial = async (letra) => {
    const ordem = [1,2,3,4].map(i => document.getElementById(`oficial-${letra}-${i}`).value);
    await setDoc(doc(db, "resultados", "grupos_oficiais"), { [letra]: ordem }, { merge: true });
    alert("Grupo " + letra + " salvo!");
};

// CÁLCULO DO RANKING
document.getElementById('btn-processar-ranking')?.addEventListener('click', async () => {
    const resJogos = (await getDoc(doc(db, "resultados", "oficiais"))).data() || {};
    const resGrupos = (await getDoc(doc(db, "resultados", "grupos_oficiais"))).data() || {};
    const mataDocs = await getDocs(collection(db, "jogos_matamata"));
    const infoMata = {};
    mataDocs.forEach(d => infoMata[d.id] = d.data());

    const usuarios = await getDocs(collection(db, "usuarios"));
    const ptsMap = {};
    for (const uDoc of usuarios.docs) {
        const palpiteDoc = await getDoc(doc(db, "palpites", uDoc.id));
        let pts = 0;
        if (palpiteDoc.exists()) {
            const d = palpiteDoc.data();
            // Pontos Jogos (Fixos + Mata)
            for (const id in resJogos) {
                if (d.palpites && d.palpites[id]) {
                    const base = calcularPontos(d.palpites[id], resJogos[id]);
                    const mult = infoMata[id] ? infoMata[id].multiplicador : 1;
                    pts += Math.round(base * mult);
                }
            }
            // Pontos Grupos
            if (d.posicoes) {
                for (const g in resGrupos) {
                    let acertos = 0;
                    for (let i=0; i<4; i++) {
                        if (resGrupos[g][i] !== "" && d.posicoes[g][i] === resGrupos[g][i]) { pts += 10; acertos++; }
                    }
                    if (acertos === 4) pts += 10;
                }
            }
        }
        ptsMap[uDoc.id] = pts;
        await setDoc(doc(db, "usuarios", uDoc.id), { pontos: pts }, { merge: true });
    }

    // Salvar snapshot do ranking histórico (por quantidade de jogos apurados)
    const snapshotAtual = {};
    usuarios.docs.forEach(uDoc => {
        const u = uDoc.data();
        if (!u.isAdmin && u.email !== SEU_EMAIL) {
            snapshotAtual[uDoc.id] = { nome: u.nome, pontos: ptsMap[uDoc.id] };
        }
    });
    const ordenados = Object.entries(snapshotAtual).sort((a, b) => b[1].pontos - a[1].pontos);
    ordenados.forEach(([uid, dados], i) => { dados.posicao = i + 1; });
    const numJogos = Object.keys(resJogos).length;
    const labelJogo = numJogos === 1 ? "1 jogo" : `${numJogos} jogos`;
    await setDoc(doc(db, "resultados", "historico_ranking"), {
        [labelJogo]: snapshotAtual
    }, { merge: true });

    alert("Ranking atualizado!");
});

function calcularPontos(p, r) {
    if (p.a === r.a && p.b === r.b) return 10;
    const vP = p.a > p.b ? 'A' : (p.a < p.b ? 'B' : 'E');
    const vR = r.a > r.b ? 'A' : (r.a < r.b ? 'B' : 'E');
    if (vP === vR) return (p.a === r.a || p.b === r.b) ? 7 : 5;
    return (p.a === r.a || p.b === r.b) ? 2 : 0;
}