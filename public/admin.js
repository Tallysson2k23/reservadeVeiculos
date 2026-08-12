import { db, auth } from "./firebase.js";

import {
    collection,
    getDocs,
    query,
    orderBy,
    where,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* =====================================================
   ELEMENTOS
===================================================== */

const tabela = document.getElementById("tabela");
const filtroData = document.getElementById("filtroData");
const btnBuscar = document.getElementById("btnBuscar");
const btnHoje = document.getElementById("btnHoje");
const adminLoader = document.getElementById("adminLoader");

/*
 * Guarda veículos já consultados.
 * Evita consultar o mesmo veículo várias vezes.
 */
const cacheVeiculos = new Map();

let carregando = false;

/* =====================================================
   VERIFICAR ADMINISTRADOR
===================================================== */

async function verificarAdmin(user) {
    try {
        if (!user?.email) {
            return false;
        }

        const ref = doc(db, "admins", user.email);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
            alert("Acesso negado");
            window.location.href = "veiculos.html";
            return false;
        }

        return true;
    } catch (erro) {
        console.error("Erro ao verificar administrador:", erro);
        alert("Não foi possível verificar seu acesso.");

        return false;
    }
}

/* =====================================================
   FUNÇÕES DE DATA
===================================================== */

/*
 * Cria a data no fuso local.
 * Evita o problema de o navegador interpretar YYYY-MM-DD
 * como uma data em UTC.
 */
function criarDataLocal(dataTexto) {
    const [ano, mes, dia] = dataTexto.split("-").map(Number);

    return new Date(ano, mes - 1, dia);
}

/*
 * Retorna o início do dia selecionado e o início
 * do dia seguinte.
 *
 * A consulta utiliza:
 * data >= início do dia
 * data < início do próximo dia
 */
function obterIntervaloDoDia(data) {
    const inicio = new Date(
        data.getFullYear(),
        data.getMonth(),
        data.getDate(),
        0,
        0,
        0,
        0
    );

    const proximoDia = new Date(
        data.getFullYear(),
        data.getMonth(),
        data.getDate() + 1,
        0,
        0,
        0,
        0
    );

    return {
        inicio,
        proximoDia
    };
}

/*
 * Formata a data de hoje para o campo input type="date".
 */
function formatarDataParaInput(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");

    return `${ano}-${mes}-${dia}`;
}

/* =====================================================
   LOADER
===================================================== */

function mostrarLoader() {
    carregando = true;

    adminLoader?.classList.remove("hidden");

    if (btnBuscar) {
        btnBuscar.disabled = true;
    }

    if (btnHoje) {
        btnHoje.disabled = true;
    }
}

function esconderLoader() {
    carregando = false;

    adminLoader?.classList.add("hidden");

    if (btnBuscar) {
        btnBuscar.disabled = false;
    }

    if (btnHoje) {
        btnHoje.disabled = false;
    }
}

/* =====================================================
   SEGURANÇA DO HTML
===================================================== */

function escaparHTML(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

/* =====================================================
   BUSCAR DADOS DO VEÍCULO
===================================================== */

async function buscarVeiculo(veiculoId) {
    if (!veiculoId) {
        return {
            modelo: "Veículo não informado",
            placa: ""
        };
    }

    /*
     * Retorna o veículo do cache quando ele já tiver
     * sido consultado anteriormente.
     */
    if (cacheVeiculos.has(veiculoId)) {
        return cacheVeiculos.get(veiculoId);
    }

    try {
        const veiculoRef = doc(db, "veiculos", veiculoId);
        const veiculoSnap = await getDoc(veiculoRef);

        let veiculo;

        if (veiculoSnap.exists()) {
            const dados = veiculoSnap.data();

            veiculo = {
                modelo: dados.modelo || "Modelo não informado",
                placa: dados.placa || "Sem placa"
            };
        } else {
            veiculo = {
                modelo: "Veículo não encontrado",
                placa: ""
            };
        }

        cacheVeiculos.set(veiculoId, veiculo);

        return veiculo;
    } catch (erro) {
        console.error(`Erro ao buscar o veículo ${veiculoId}:`, erro);

        return {
            modelo: "Erro ao carregar veículo",
            placa: ""
        };
    }
}

/* =====================================================
   RENDERIZAR TABELA
===================================================== */

function renderizar(registros) {
    if (!tabela) {
        return;
    }

    if (registros.length === 0) {
        tabela.innerHTML = `
            <tr>
                <td colspan="4" class="admin-vazio">
                    Nenhum registro encontrado para esta data.
                </td>
            </tr>
        `;

        return;
    }

    /*
     * Monta todo o HTML uma única vez.
     * Evita alterar tabela.innerHTML repetidamente.
     */
    tabela.innerHTML = registros
        .map((registro) => {
            return `
                <tr>
                    <td>${escaparHTML(registro.usuario)}</td>
                    <td>${escaparHTML(registro.veiculo)}</td>
                    <td>${escaparHTML(registro.tipo)}</td>
                    <td>${escaparHTML(
                        registro.data.toLocaleString("pt-BR")
                    )}</td>
                </tr>
            `;
        })
        .join("");
}

/* =====================================================
   CARREGAR REGISTROS DE UMA DATA
===================================================== */

async function carregarDados(dataSelecionada) {
    if (carregando) {
        return;
    }

    mostrarLoader();

    if (tabela) {
        tabela.innerHTML = "";
    }

    try {
        const { inicio, proximoDia } =
            obterIntervaloDoDia(dataSelecionada);

        /*
         * Agora o Firestore retorna apenas os registros
         * do dia selecionado.
         */
        const consulta = query(
            collection(db, "solicitacoes"),
            where("data", ">=", inicio),
            where("data", "<", proximoDia),
            orderBy("data", "desc")
        );

        const snapshot = await getDocs(consulta);

        if (snapshot.empty) {
            renderizar([]);
            return;
        }

        const solicitacoes = snapshot.docs
            .map((documento) => {
                const dados = documento.data();

                if (!dados.data || typeof dados.data.toDate !== "function") {
                    console.warn(
                        "Registro ignorado por possuir data inválida:",
                        documento.id
                    );

                    return null;
                }

                return {
                    id: documento.id,
                    usuario: dados.usuario || "Usuário não informado",
                    veiculoId: dados.veiculo || "",
                    tipo: dados.tipo || "Não informado",
                    data: dados.data.toDate()
                };
            })
            .filter(Boolean);

        /*
         * Separa apenas IDs únicos.
         * Se houver 20 registros do mesmo carro, ele será
         * consultado apenas uma vez.
         */
        const veiculosUnicos = [
            ...new Set(
                solicitacoes
                    .map((registro) => registro.veiculoId)
                    .filter(Boolean)
            )
        ];

        /*
         * Busca os veículos em paralelo.
         * Não existe mais await sequencial dentro do for.
         */
        await Promise.all(
            veiculosUnicos.map((veiculoId) =>
                buscarVeiculo(veiculoId)
            )
        );

        const registros = solicitacoes.map((registro) => {
            const veiculo = cacheVeiculos.get(registro.veiculoId);

            let descricaoVeiculo = "Veículo não informado";

            if (veiculo) {
                descricaoVeiculo = veiculo.placa
                    ? `${veiculo.modelo} - ${veiculo.placa}`
                    : veiculo.modelo;
            }

            return {
                usuario: registro.usuario,
                veiculo: descricaoVeiculo,
                tipo: registro.tipo,
                data: registro.data
            };
        });

        renderizar(registros);
    } catch (erro) {
        console.error("Erro ao carregar registros:", erro);

        if (erro?.code === "failed-precondition") {
            tabela.innerHTML = `
                <tr>
                    <td colspan="4" class="admin-vazio">
                        O Firestore solicitou a criação de um índice.
                        Verifique o console do navegador para abrir
                        o link de criação.
                    </td>
                </tr>
            `;
        } else {
            tabela.innerHTML = `
                <tr>
                    <td colspan="4" class="admin-vazio">
                        Não foi possível carregar os registros.
                        Tente novamente.
                    </td>
                </tr>
            `;
        }
    } finally {
        esconderLoader();
    }
}

/* =====================================================
   MOSTRAR REGISTROS DE HOJE
===================================================== */

async function mostrarHoje() {
    const hoje = new Date();

    if (filtroData) {
        filtroData.value = formatarDataParaInput(hoje);
    }

    await carregarDados(hoje);
}

/* =====================================================
   BOTÃO BUSCAR
===================================================== */

btnBuscar?.addEventListener("click", async () => {
    if (!filtroData.value) {
        alert("Selecione uma data");
        return;
    }

    const dataSelecionada = criarDataLocal(filtroData.value);

    if (Number.isNaN(dataSelecionada.getTime())) {
        alert("A data selecionada é inválida.");
        return;
    }

    await carregarDados(dataSelecionada);
});

/* =====================================================
   BOTÃO HOJE
===================================================== */

btnHoje?.addEventListener("click", async () => {
    await mostrarHoje();
});

/* =====================================================
   INICIALIZAÇÃO
===================================================== */

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    const adminValido = await verificarAdmin(user);

    if (adminValido) {
        await mostrarHoje();
    }
});