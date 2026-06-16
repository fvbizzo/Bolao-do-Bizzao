import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";

// Suas chaves reais inseridas aqui!
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

onAuthStateChanged(auth, (user) => {
    if (user) {
        carregarRanking();
        carregarHistorico();
    } else {
        window.location.href = "index.html";
    }
});

async function carregarRanking() {
    const corpoRanking = document.getElementById('corpo-ranking');
    if (!corpoRanking) return;

    corpoRanking.innerHTML = "<tr><td colspan='3'>Carregando classificação...</td></tr>";

    try {
        const q = query(collection(db, "usuarios"), orderBy("pontos", "desc"));
        const querySnapshot = await getDocs(q); // A variável é definida AQUI
        
        corpoRanking.innerHTML = "";
        let posicao = 1;

        querySnapshot.forEach((doc) => {
            const usuario = doc.data();
            const SEU_EMAIL_ADMIN = "sidocha19@gmail.com"; // Ajuste seu e-mail aqui

            if (usuario.nome && usuario.email !== SEU_EMAIL_ADMIN) {
                const row = `
                    <tr class="${posicao === 1 ? 'primeiro-lugar' : ''}">
                        <td>${posicao}º</td>
                        <td>${usuario.nome}</td>
                        <td><strong>${usuario.pontos || 0}</strong></td>
                    </tr>
                `;
                corpoRanking.innerHTML += row;
                posicao++;
            }
        });
    } catch (error) {
        console.error("Erro ao carregar ranking:", error);
        corpoRanking.innerHTML = "<tr><td colspan='3'>Erro ao carregar. Verifique o console.</td></tr>";
    }
}

document.getElementById('btn-sair')?.addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = "index.html");
});

let graficoInstance = null;
let dadosGrafico = null; // { labels, datasets } preparados, prontos para desenhar

document.getElementById('btn-ver-grafico')?.addEventListener('click', () => {
    const secao = document.getElementById('secao-historico');
    const btn = document.getElementById('btn-ver-grafico');
    if (secao.style.display === 'none') {
        secao.style.display = 'block';
        btn.textContent = 'Ocultar Gráfico 📉';
        // Só desenha o gráfico agora que o container está visível (evita canvas 0x0)
        desenharGrafico();
    } else {
        secao.style.display = 'none';
        btn.textContent = 'Ver Evolução 📈';
    }
});

async function carregarHistorico() {
    const btnGrafico = document.getElementById('btn-ver-grafico');
    const histDoc = await getDoc(doc(db, "resultados", "historico_ranking"));

    if (!histDoc.exists()) return;

    const historico = histDoc.data();
    const chaves = Object.keys(historico);
    if (chaves.length === 0) return;

    // Ordenar as chaves pelo número de jogos (ex: "5 jogos" → 5)
    const labels = chaves.sort((a, b) => {
        const numA = parseInt(a);
        const numB = parseInt(b);
        return numA - numB;
    });

    // Coletar todos os jogadores únicos (por UID)
    const jogadores = {};
    labels.forEach(label => {
        const snap = historico[label];
        Object.entries(snap).forEach(([uid, dados]) => {
            if (!jogadores[uid]) jogadores[uid] = dados.nome;
        });
    });

    const cores = ['#008000','#e74c3c','#3498db','#f39c12','#9b59b6','#1abc9c','#e67e22','#2980b9','#c0392b','#27ae60'];

    const datasets = Object.entries(jogadores).map(([uid, nome], i) => ({
        label: nome,
        data: labels.map(label => historico[label][uid]?.pontos ?? null),
        borderColor: cores[i % cores.length],
        backgroundColor: cores[i % cores.length],
        tension: 0.3,
        spanGaps: false,
        pointRadius: 4,
    }));

    // Guarda os dados; o gráfico só é desenhado ao revelar a seção (ver toggle)
    dadosGrafico = { labels, datasets };
    btnGrafico.style.display = 'inline-block';
}

function desenharGrafico() {
    if (!dadosGrafico) return;

    const canvas = document.getElementById('grafico-historico');
    if (!canvas) return;

    if (graficoInstance) graficoInstance.destroy();

    graficoInstance = new Chart(canvas, {
        type: 'line',
        data: dadosGrafico,
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#333', font: { size: 12 } } }
            },
            scales: {
                x: { ticks: { color: '#333' } },
                y: { beginAtZero: true, ticks: { color: '#333' } }
            }
        }
    });
}