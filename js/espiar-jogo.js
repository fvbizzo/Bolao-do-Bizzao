import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
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

let listaUsuarios = [];
let bancoPalpites = {}; // Guardar todos os palpites para não ficar lendo o banco à toa
let resultadosOficiais = {};
let jogosIniciados = [];

onAuthStateChanged(auth, async (user) => {
    if (user) {
        await inicializarRaioX();
    } else {
        window.location.href = "index.html";
    }
});

async function inicializarRaioX() {
    const agora = new Date();

    // 1. Carregar resultados oficiais
    const resSnap = await getDoc(doc(db, "resultados", "oficiais"));
    resultadosOficiais = resSnap.exists() ? resSnap.data() : {};

    // 2. Montar lista de jogos que JÁ COMEÇARAM
    let todosOsJogos = [...listaJogos];
    const mataSnap = await getDocs(collection(db, "jogos_matamata"));
    mataSnap.forEach(d => todosOsJogos.push(d.data()));

    jogosIniciados = todosOsJogos.filter(j => agora >= new Date(j.dataInicio));
    
    // Ordenar do mais recente para o mais antigo (para o jogo atual ficar no topo)
    jogosIniciados.sort((a, b) => new Date(b.dataInicio) - new Date(a.dataInicio));

    // 3. Preencher o Select
    const selectJogo = document.getElementById('select-jogo');
    selectJogo.innerHTML = `<option value="">-- Escolha uma partida --</option>`;
    
    jogosIniciados.forEach(j => {
        const dataFormatada = new Date(j.dataInicio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const faseNome = j.rodada ? `Rodada ${j.rodada}` : (j.fase || "Mata-mata");
        selectJogo.innerHTML += `<option value="${j.id}">${dataFormatada} - ${j.timeA} x ${j.timeB} (${faseNome})</option>`;
    });

    // 4. Carregar Usuários (TIRANDO O ADMIN DE VEZ)
    const usersSnap = await getDocs(collection(db, "usuarios"));
    usersSnap.forEach(d => {
        const u = d.data();
        const uid = d.id;
        
        // TRAVA TRIPLA: Bloqueia pelo campo, pelo e-mail ou pelo seu UID fixo!
        const ehAdmin = u.isAdmin === true || 
                        u.email === "sidocha19@gmail.com" || 
                        uid === "nzOrvOgIkCYMWiVyBwH9KJkU2P62";
                        
        if (u.nome && !ehAdmin) {
            listaUsuarios.push({ uid: uid, nome: u.nome });
        }
    });

    // 5. Carregar Palpites de todo mundo de uma vez
    const palpitesSnap = await getDocs(collection(db, "palpites"));
    palpitesSnap.forEach(d => {
        bancoPalpites[d.id] = d.data().palpites || {};
    });

    // 6. Adicionar evento de mudança no select
    selectJogo.addEventListener('change', (e) => {
        renderizarTabela(e.target.value);
    });
}

function renderizarTabela(jogoId) {
    const corpoTabela = document.getElementById('corpo-raiox');
    const placarContainer = document.getElementById('placar-oficial-container');
    
    if (!jogoId) {
        corpoTabela.innerHTML = `<tr><td colspan="3">Selecione um jogo acima para ver os palpites.</td></tr>`;
        placarContainer.innerHTML = "";
        return;
    }

    const jogoAtual = jogosIniciados.find(j => j.id === jogoId);
    const oficial = resultadosOficiais[jogoId];
    
    // Mostrar placar oficial se existir
    if (oficial && oficial.a !== undefined && oficial.b !== undefined) {
        placarContainer.innerHTML = `Placar Oficial: <strong>${jogoAtual.timeA} ${oficial.a} x ${oficial.b} ${jogoAtual.timeB}</strong>`;
    } else {
        placarContainer.innerHTML = `<span style="color: #666; font-style: italic;">Aguardando resultado oficial...</span>`;
    }

    let linhas = [];

    listaUsuarios.forEach(user => {
        const palpite = bancoPalpites[user.uid] ? bancoPalpites[user.uid][jogoId] : null;
        let txtPalpite = "-";
        let pontos = 0;
        let txtPontos = "-";

        if (palpite) {
            txtPalpite = `<strong>${palpite.a} x ${palpite.b}</strong>`;
            
            if (oficial && oficial.a !== undefined && oficial.b !== undefined) {
                pontos = calcularPontosJogo(palpite, oficial, jogoAtual.multiplicador || 1);
                txtPontos = pontos > 0 ? `<span class="pts-ganhos">+${pontos} pts</span>` : `<span class="pts-zero">0 pts</span>`;
            } else {
                txtPontos = `<span style="color:#aaa;">Em jogo</span>`;
            }
        } else {
            txtPalpite = `<span style="color: #ccc;">Sem palpite</span>`;
        }

        linhas.push({ nome: user.nome, txtPalpite, pontos, txtPontos });
    });

    // Ordenar: Quem fez mais pontos no topo. Se empatar, ordem alfabética
    linhas.sort((a, b) => {
        if (b.pontos !== a.pontos) return b.pontos - a.pontos;
        return a.nome.localeCompare(b.nome);
    });

    corpoTabela.innerHTML = "";
    linhas.forEach(l => {
        corpoTabela.innerHTML += `
            <tr>
                <td class="nome-jogador-raiox">${l.nome}</td>
                <td>${l.txtPalpite}</td>
                <td>${l.txtPontos}</td>
            </tr>
        `;
    });
}

function calcularPontosJogo(p, o, mult) {
    let pts = 0;
    const mesmoVencedor = (p.a > p.b && o.a > o.b) || (p.a < p.b && o.a < o.b) || (p.a === p.b && o.a === o.b);
    
    if (p.a === o.a && p.b === o.b) pts = 10;
    else if (mesmoVencedor && (p.a === o.a || p.b === o.b)) pts = 7;
    else if (mesmoVencedor) pts = 5;
    else if (p.a === o.a || p.b === o.b) pts = 2;
    
    return pts * mult;
}