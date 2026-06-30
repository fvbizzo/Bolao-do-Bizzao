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
let labels = [];              // rótulos completos do eixo X, ordenados (ex: "5 jogos")
let series = [];              // [{ nome, cor, pontos:[], posicao:[] }] alinhados a `labels`
let metricaAtual = 'pontos';  // 'pontos' | 'posicao'
let janela = { inicio: 0, fim: 0 }; // índices em `labels` (inclusivos)

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
    labels = chaves.sort((a, b) => parseInt(a) - parseInt(b));

    // Coletar todos os jogadores únicos (por UID)
    const jogadores = {};
    labels.forEach(label => {
        Object.entries(historico[label]).forEach(([uid, dados]) => {
            if (!jogadores[uid]) jogadores[uid] = dados.nome;
        });
    });

    const cores = ['#008000','#e74c3c','#3498db','#f39c12','#9b59b6','#1abc9c','#e67e22','#2980b9','#c0392b','#27ae60'];

    series = Object.entries(jogadores)
        .map(([uid, nome], i) => ({
            nome,
            cor: cores[i % cores.length],
            pontos: labels.map(label => historico[label][uid]?.pontos ?? null),
            posicao: labels.map(label => historico[label][uid]?.posicao ?? null),
        }))
        // Oculta quem nunca pontuou (ex: usuário que não palpita) para não achatar o gráfico
        .filter(s => s.pontos.some(p => p != null && p > 0));

    janela = { inicio: 0, fim: labels.length - 1 };
    configurarControles();
    btnGrafico.style.display = 'inline-block';
}

// Liga os controles uma única vez (os elementos são estáticos no HTML).
// Os handlers leem o estado de módulo, então funcionam assim que os dados carregam.
(function ligarControles() {
    const rInicio = document.getElementById('range-inicio');
    const rFim = document.getElementById('range-fim');
    if (!rInicio || !rFim) return;

    rInicio.addEventListener('input', () => {
        janela.inicio = Math.min(+rInicio.value, +rFim.value);
        rInicio.value = janela.inicio; // não deixa cruzar o outro polegar
        atualizarJanela();
    });
    rFim.addEventListener('input', () => {
        janela.fim = Math.max(+rFim.value, +rInicio.value);
        rFim.value = janela.fim;
        atualizarJanela();
    });

    document.getElementById('tab-pontos')?.addEventListener('click', () => trocarMetrica('pontos'));
    document.getElementById('tab-posicao')?.addEventListener('click', () => trocarMetrica('posicao'));
})();

function configurarControles() {
    const rInicio = document.getElementById('range-inicio');
    const rFim = document.getElementById('range-fim');
    const max = labels.length - 1;

    [rInicio, rFim].forEach(r => { r.min = 0; r.max = max; });
    rInicio.value = janela.inicio;
    rFim.value = janela.fim;
    // Com um único rótulo não há janela para escolher
    rInicio.disabled = rFim.disabled = max <= 0;

    atualizarLabelJanela();
}

function trocarMetrica(metrica) {
    if (metrica === metricaAtual) return;
    metricaAtual = metrica;
    document.getElementById('tab-pontos').classList.toggle('ativo', metrica === 'pontos');
    document.getElementById('tab-posicao').classList.toggle('ativo', metrica === 'posicao');
    desenharGrafico();
}

function atualizarJanela() {
    atualizarLabelJanela();
    desenharGrafico();
}

function atualizarLabelJanela() {
    const el = document.getElementById('janela-label');
    if (el) el.textContent = `De ${labels[janela.inicio]} até ${labels[janela.fim]}`;
}

function desenharGrafico() {
    if (!series.length) return;

    const canvas = document.getElementById('grafico-historico');
    if (!canvas) return;

    const labelsJanela = labels.slice(janela.inicio, janela.fim + 1);
    const datasets = series.map(s => ({
        label: s.nome,
        data: s[metricaAtual].slice(janela.inicio, janela.fim + 1),
        borderColor: s.cor,
        backgroundColor: s.cor,
        tension: 0.3,
        spanGaps: false,
        pointRadius: 4,
    }));

    const yScale = metricaAtual === 'posicao'
        // Eixo invertido: 1º no topo; linhas que se cruzam = ultrapassagens
        ? { reverse: true, ticks: { color: '#333', stepSize: 1, precision: 0, callback: v => v + 'º' } }
        // Auto-escala no intervalo dos pontos (não força o zero) para
        // destacar a diferença entre jogadores com pontuações próximas
        : { grace: '10%', ticks: { color: '#333' } };

    // Atualiza no lugar quando o gráfico já existe (arrastar o slider dispara
    // muitos eventos) e só cria uma nova instância na primeira exibição
    if (graficoInstance) {
        graficoInstance.data.labels = labelsJanela;
        graficoInstance.data.datasets = datasets;
        graficoInstance.options.scales.y = yScale;
        graficoInstance.update('none');
        return;
    }

    graficoInstance = new Chart(canvas, {
        type: 'line',
        data: { labels: labelsJanela, datasets },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#333', font: { size: 12 } } }
            },
            scales: {
                x: { ticks: { color: '#333' } },
                y: yScale
            }
        }
    });
}