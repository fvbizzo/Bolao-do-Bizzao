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

const DATA_LIMITE_GRUPOS = new Date("2026-06-11T12:00:00Z");

let listaUsuarios = [];
let usuarioIndex = 0;
let resultadosOficiais = {};
let gruposOficiais = {};
let listaCompletaJogos = [];

onAuthStateChanged(auth, async (user) => {
    if (user) {
        await inicializarEspiao();
    } else {
        window.location.href = "index.html";
    }
});

async function inicializarEspiao() {
    // 1. Resultados Oficiais de Jogos
    const resSnap = await getDoc(doc(db, "resultados", "oficiais"));
    resultadosOficiais = resSnap.exists() ? resSnap.data() : {};

    // 2. Classificação Oficial de Grupos
    const grupSnap = await getDoc(doc(db, "resultados", "grupos_oficiais"));
    gruposOficiais = grupSnap.exists() ? grupSnap.data() : {};

    // 3. Monta lista de jogos (Fixos + Mata-Mata dinâmicos)
    listaCompletaJogos = [...listaJogos];
    const mataSnap = await getDocs(collection(db, "jogos_matamata"));
    mataSnap.forEach(d => listaCompletaJogos.push(d.data()));

    // 4. Lista de Usuários ativos (Removendo o Admin pela role e pelo e-mail fixo)
    const usersSnap = await getDocs(collection(db, "usuarios"));
    listaUsuarios = [];
    usersSnap.forEach(d => {
        const u = d.data();
        u.uid = d.id;
        
        const ehAdmin = u.isAdmin === true || u.email === "sidocha19@gmail.com";
        if (u.nome && !ehAdmin) {
            listaUsuarios.push(u);
        }
    });

    if (listaUsuarios.length > 0) {
        renderizarUsuarioAtual();
    }
}

async function renderizarUsuarioAtual() {
    const usuario = listaUsuarios[usuarioIndex];

    const palpiteSnap = await getDoc(doc(db, "palpites", usuario.uid));
    const dadosPalpites = palpiteSnap.exists() ? palpiteSnap.data() : {};
    
    const palpitesUser = dadosPalpites.palpites || {};
    const posicoesUser = dadosPalpites.posicoes || {};

    const agora = new Date();
    const prazoGruposEncerrado = agora >= DATA_LIMITE_GRUPOS;

    // Acumulador de pontos totais do jogador nesta tela
    let pontuacaoTotalCalculada = 0;

    // --- 1. RENDERIZAR BLOCO DE GRUPOS ---
    const containerGrupos = document.getElementById('container-grupos-espiar');
    
    if (containerGrupos) {
        containerGrupos.innerHTML = "";
        const letrasGrupos = ["A","B","C","D","E","F","G","H","I","J","K","L"];
        
        letrasGrupos.forEach(g => {
            if (posicoesUser[g]) {
                let htmlGrupo = `<div class="grupo-caixa-espiar"><strong>Grupo ${g}</strong><hr>`;
                let acertosGabarito = 0;
                let pontosDesteGrupo = 0;

                [1, 2, 3, 4].forEach((pos, idx) => {
                    const timePalpite = posicoesUser[g][idx] || "-";
                    const timeOficial = (gruposOficiais[g] && gruposOficiais[g][idx]) ? gruposOficiais[g][idx] : null;
                    
                    let txtExibicao = timePalpite;
                    let classePontos = "";

                    if (!prazoGruposEncerrado) {
                        txtExibicao = `<span class="palpite-oculto">🔒 Oculto</span>`;
                    } else if (timeOficial) {
                        if (timePalpite === timeOficial) {
                            classePontos = `style="color:green; font-weight:bold;"`;
                            acertosGabarito++;
                            pontosDesteGrupo += 10; // 10 pontos por posição correta
                        } else {
                            classePontos = `style="color:red;"`;
                        }
                    }

                    htmlGrupo += `
                        <div class="linha-grupo-espiar" ${classePontos}>
                            <span>${pos}º ${txtExibicao}</span>
                            ${timeOficial && prazoGruposEncerrado ? `<span>(Oficial: ${timeOficial})</span>` : ""}
                        </div>`;
                });

                // Bônus se gabaritar todas as posições do grupo
                if (acertosGabarito === 4 && prazoGruposEncerrado) {
                    pontosDesteGrupo += 10;
                    htmlGrupo += `<div style="font-size:0.8em; color:gold; font-weight:bold; text-align:center; margin-top:5px;">⭐ Gabaritou grupo! (+10)</div>`;
                }

                // --- QUINTA LINHA ATUALIZADA (Fica visível sempre) ---
                if (prazoGruposEncerrado) {
                    pontuacaoTotalCalculada += pontosDesteGrupo;
                }
                
                // Exibe 0 pts enquanto o campeonato não rolar, e atualiza sozinho depois!
                htmlGrupo += `
                    <div style="margin-top: 10px; padding-top: 5px; border-top: 1px solid #eee; text-align: right; font-size: 0.9em; color: #555;">
                        Pontos obtidos: <strong style="color: ${pontosDesteGrupo > 0 ? '#008000' : '#333'};">${pontosDesteGrupo} pts</strong>
                    </div>`;

                htmlGrupo += `</div>`;
                containerGrupos.innerHTML += htmlGrupo;
            }
        });
    }

    // --- 2. RENDERIZAR TABELA DE JOGOS ---
    const corpoTabela = document.getElementById('corpo-espiar');
    
    if (corpoTabela) {
        corpoTabela.innerHTML = "";

        listaCompletaJogos.forEach(j => {
            const jaComecou = agora >= new Date(j.dataInicio);
            const palpite = palpitesUser[j.id];
            const oficial = resultadosOficiais[j.id];

            let txtPalpite = "-";
            let txtOficial = "-";
            let txtPontos = "-";

            if (palpite) {
                if (jaComecou) {
                    txtPalpite = `${palpite.a} x ${palpite.b}`;
                } else {
                    txtPalpite = `<span class="palpite-oculto">🔒 Oculto até o início</span>`;
                }
            }

            if (oficial && oficial.a !== undefined && oficial.b !== undefined) {
                txtOficial = `${oficial.a} x ${oficial.b}`;
                if (palpite && jaComecou) {
                    const pontosDoJogo = calcularPontosJogo(palpite, oficial, j.multiplicador || 1);
                    pontuacaoTotalCalculada += pontosDoJogo;
                    txtPontos = `<span class="pts-ganhos">+${pontosDoJogo} pts</span>`;
                }
            }

            const faseNome = j.rodada ? `Rodada ${j.rodada}` : (j.fase || "Mata-mata");

            corpoTabela.innerHTML += `
                <tr>
                    <td><small>${faseNome}</small><br><strong>${j.timeA} x ${j.timeB}</strong></td>
                    <td>${txtPalpite}</td>
                    <td>${txtOficial}</td>
                    <td>${txtPontos}</td>
                </tr>
            `;
        });
    }

    // --- 3. ATUALIZAR TOPO DA TELA (Nome + Placar Geral) ---
    const nomeUsuarioDoc = document.getElementById('nome-usuario-atual');
    if (nomeUsuarioDoc) {
        nomeUsuarioDoc.innerHTML = `${usuario.nome} <br><span style="font-size: 0.8em; color: #333; font-weight: normal;">Total no Bolão: <b style="color: #008000;">${pontuacaoTotalCalculada} pts</b></span>`;
    }
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

// --- CONTROLES DO CARROSSEL ---
document.getElementById('btn-user-ant')?.addEventListener('click', () => {
    if (usuarioIndex > 0) {
        usuarioIndex--;
        renderizarUsuarioAtual();
    }
});

document.getElementById('btn-user-prox')?.addEventListener('click', () => {
    if (usuarioIndex < listaUsuarios.length - 1) {
        usuarioIndex++;
        renderizarUsuarioAtual();
    }
});