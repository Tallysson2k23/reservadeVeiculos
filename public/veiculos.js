import { getMessaging, getToken, onMessage } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";

import { db, auth, functions } from "./firebase.js";

import {
  collection, getDocs, doc, getDoc, updateDoc, addDoc,
  serverTimestamp, query, where, setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";


/* =====================================================
   🔔 ATIVAR NOTIFICAÇÕES (NÃO ALTERA SUA LÓGICA)
===================================================== */

const messaging = getMessaging();

async function ativarNotificacoes() {
  try {
    const permissao = await Notification.requestPermission();

    if (permissao !== "granted") {
      console.log("Permissão de notificação negada.");
      return;
    }

const token = await getToken(messaging, {
  vapidKey: "BJIpqoJ0C2CMilMeGZXXteBrG3BlslsUwhdBSHD5CqWHxhzMZOGRE8TDrGa_oU0emyciV-e742NkpDujr9w4Kdo"
});


    if (token) {
      console.log("Token gerado:", token);

      const user = auth.currentUser;
      if (user) {
        await setDoc(doc(db, "tokens", user.uid), {
          token: token,
          email: user.email
        });
      }
    }
  } catch (erro) {
    console.error("Erro ao ativar notificações:", erro);
  }
}

/* Escutar mensagens enquanto site está aberto */
onMessage(messaging, (payload) => {
  console.log("Mensagem recebida:", payload);

  if (payload.notification) {
    new Notification(payload.notification.title, {
      body: payload.notification.body
    });
  }
});


/* =====================================================
   ELEMENTOS
===================================================== */

const lista = document.getElementById("lista");
const adminBtn = document.getElementById("adminBtn");
const cadastroBtn = document.getElementById("cadastroBtn");
const logoutBtn = document.getElementById("logout");
const usuarioLogado = document.getElementById("usuarioLogado");
const botoesCategoria = document.querySelectorAll(".categoria-btn");

let listaVeiculos = [];
let categoriaAtiva = "carros";
let usuarioEhAdmin = false;
let emailUsuarioAtual = "";

const ADMIN_EMAIL = "admin@gmail.com";


/* =====================================================
   LOGOUT
===================================================== */
if (logoutBtn) {
  logoutBtn.onclick = () => {
    signOut(auth).then(() => {
      window.location.href = "index.html";
    });
  };
}


/* =====================================================
   CARREGAR VEÍCULOS
===================================================== */
async function carregarVeiculos() {
  const snap = await getDocs(collection(db, "veiculos"));
  listaVeiculos = snap.docs.map(documento => ({
    id: documento.id,
    ...documento.data()
  }));

  exibirCategoria();
}

/* Mantém o sistema funcionando até as Cloud Functions serem publicadas. */
function funcaoServidorIndisponivel(error) {
  return error?.code === "functions/not-found"
    || error?.code === "functions/internal"
    || /not found|404/i.test(String(error?.message || ""));
}

async function buscarItensEmUso(email) {
  const consulta = query(
    collection(db, "veiculos"),
    where("usuarioAtual", "==", email)
  );
  const snapshot = await getDocs(consulta);
  return snapshot.docs.map(documento => ({
    id: documento.id,
    ...documento.data()
  }));
}

function validarNovaSolicitacao(itemSolicitado, itensEmUso) {
  const tipoSolicitado = identificarTipo(itemSolicitado);
  const tiposEmUso = itensEmUso.map(identificarTipo);

  if (tipoSolicitado === "capacete") {
    return tiposEmUso.includes("capacete")
      ? { permitido: false, mensagem: "Você já possui um capacete em uso." }
      : { permitido: true };
  }

  const jaTemVeiculo = tiposEmUso.includes("moto") || tiposEmUso.includes("carro");
  return jaTemVeiculo
    ? { permitido: false, mensagem: "Você já possui um veículo em uso." }
    : { permitido: true };
}

async function solicitarDiretamente(id, user) {
  const veiculoRef = doc(db, "veiculos", id);
  const [veiculoSnap, itensEmUso] = await Promise.all([
    getDoc(veiculoRef),
    buscarItensEmUso(user.email)
  ]);

  if (!veiculoSnap.exists()) throw new Error("ITEM_NAO_ENCONTRADO");

  const item = { id: veiculoSnap.id, ...veiculoSnap.data() };
  if (item.status !== "disponivel") throw new Error("ITEM_INDISPONIVEL");

  const validacao = validarNovaSolicitacao(item, itensEmUso);
  if (!validacao.permitido) throw new Error(validacao.mensagem);

  await updateDoc(veiculoRef, {
    status: "indisponivel",
    usuarioAtual: String(user.email || "").trim().toLowerCase()
  });
  await addDoc(collection(db, "solicitacoes"), {
    veiculo: id,
    usuario: String(user.email || "").trim().toLowerCase(),
    tipo: "retirada",
    data: serverTimestamp()
  });
}

async function devolverDiretamente(id, user) {
  const veiculoRef = doc(db, "veiculos", id);
  const veiculoSnap = await getDoc(veiculoRef);
  if (!veiculoSnap.exists()) throw new Error("ITEM_NAO_ENCONTRADO");

  const dados = veiculoSnap.data();
  const email = String(user.email || "").trim().toLowerCase();
  const responsavel = String(dados.usuarioAtual || "").trim().toLowerCase();

  if (email !== ADMIN_EMAIL && email !== responsavel) {
    throw new Error("SEM_PERMISSAO");
  }

  await updateDoc(veiculoRef, { status: "disponivel", usuarioAtual: null });
  await addDoc(collection(db, "solicitacoes"), {
    veiculo: id,
    usuario: responsavel || "Usuário não informado",
    tipo: email === ADMIN_EMAIL && email !== responsavel
      ? "devolucao_admin"
      : "devolucao",
    devolvidoPor: email,
    data: serverTimestamp()
  });
}

/* =====================================================
   FILTRAR CARROS, MOTOS E CAPACETES
===================================================== */
function exibirCategoria() {
  const itensVisiveis = listaVeiculos.filter(item => {
    const tipo = identificarTipo(item);

    if (categoriaAtiva === "carros") {
      return tipo === "carro";
    }

    return tipo === "moto" || tipo === "capacete";
  });

  lista.innerHTML = itensVisiveis.length
    ? itensVisiveis.map(criarCard).join("")
    : `<p class="lista-vazia">Nenhum item cadastrado nesta categoria.</p>`;

  atualizarPainel(itensVisiveis);
}

function criarCard(item) {
  const indisponivel = item.status !== "disponivel";
  const tipo = identificarTipo(item);
  const nome = escaparHTML(item.modelo || "Item sem nome");
  const imagem = escaparHTML(item.imagem || "");
  const id = escaparHTML(item.id);
  const identificacao = escaparHTML(
    item.identificacao || item.placa || "Não informada"
  );
  const rotuloIdentificacao = tipo === "capacete" ? "Identificação" : "Placa";

  return `
    <div class="card">
      <img src="${imagem}" alt="${nome}">
      <b>${nome}</b>
      <p>${rotuloIdentificacao}: ${identificacao}</p>

      ${
        indisponivel && item.usuarioAtual
          ? `
              <p class="usuario-veiculo">
                Está com:
                <strong class="nome-usuario">
                  ${escaparHTML(getNomeUsuario(item.usuarioAtual))}
                </strong>
              </p>
            `
          : ""
      }

      <button
        class="${indisponivel ? "btn-indisponivel" : ""}"
        ${indisponivel ? "disabled" : ""}
        data-acao="solicitar"
        data-id="${id}">
        ${indisponivel ? "INDISPONÍVEL" : "Solicitar"}
      </button>

      ${
        indisponivel && (
          usuarioEhAdmin
          || normalizarTexto(item.usuarioAtual) === emailUsuarioAtual
        )
          ? `<button data-acao="devolver" data-id="${id}">Devolver</button>`
          : ""
      }
    </div>
  `;
}

function identificarTipo(item) {
  const tipoCadastrado = normalizarTexto(item.tipo || item.categoria || "");

  if (tipoCadastrado.includes("capacete")) return "capacete";
  if (tipoCadastrado === "moto" || tipoCadastrado === "motocicleta") return "moto";
  if (tipoCadastrado === "carro" || tipoCadastrado === "automovel") return "carro";

  // Mantém compatibilidade com itens antigos que ainda não possuem o campo "tipo".
  const descricao = normalizarTexto(`${item.modelo || ""} ${item.descricao || ""}`);

  if (descricao.includes("capacete")) return "capacete";

  const nomesComunsDeMoto = /\b(moto|motocicleta|pop|biz|bros|titan|fan|factor|fazer|start|xre|cg)\b/;
  if (nomesComunsDeMoto.test(descricao)) return "moto";

  return "carro";
}

function normalizarTexto(valor) {
  return String(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

botoesCategoria.forEach(botao => {
  botao.addEventListener("click", () => {
    categoriaAtiva = botao.dataset.categoria;

    botoesCategoria.forEach(opcao => {
      const estaAtiva = opcao === botao;
      opcao.classList.toggle("ativa", estaAtiva);
      opcao.setAttribute("aria-pressed", String(estaAtiva));
    });

    exibirCategoria();
  });
});

lista.addEventListener("click", evento => {
  const botao = evento.target.closest("button[data-acao]");
  if (!botao || botao.disabled) return;

  const acao = botao.dataset.acao;
  const id = botao.dataset.id;

  if (acao === "solicitar") window.solicitar(id);
  if (acao === "devolver") window.devolver(id);
});


/* =====================================================
   SOLICITAR VEÍCULO
===================================================== */
window.solicitar = async (id) => {
  const user = auth.currentUser;
  if (!user) {
    alert("Faça login novamente");
    return;
  }

  try {
    const solicitarItem = httpsCallable(functions, "solicitarItem");
    await solicitarItem({ veiculoId: id });
    await carregarVeiculos();
  } catch (error) {
    if (funcaoServidorIndisponivel(error)) {
      try {
        await solicitarDiretamente(id, user);
        await carregarVeiculos();
        return;
      } catch (erroDireto) {
        const mensagensDiretas = {
          ITEM_NAO_ENCONTRADO: "Este item não foi encontrado.",
          ITEM_INDISPONIVEL: "Este item não está mais disponível."
        };
        alert(mensagensDiretas[erroDireto.message] || erroDireto.message || "Não foi possível solicitar o item.");
        console.error("Erro ao solicitar diretamente:", erroDireto);
        await carregarVeiculos();
        return;
      }
    }

    const mensagens = {
      "functions/not-found": "Este item não foi encontrado.",
      "functions/already-exists": "Este item não está mais disponível.",
      "functions/failed-precondition": error.message || "Você já atingiu o limite de itens em uso.",
      "functions/unauthenticated": "Sua sessão expirou. Entre novamente."
    };

    alert(mensagens[error.code] || "Não foi possível solicitar o item.");
    console.error("Erro ao solicitar item:", error);
    await carregarVeiculos();
  }
};


/* =====================================================
   DEVOLVER VEÍCULO
===================================================== */
window.devolver = async (id) => {
  const user = auth.currentUser;
  if (!user) {
    alert("Faça login novamente.");
    return;
  }

  try {
    const devolverItem = httpsCallable(functions, "devolverItem");
    await devolverItem({ veiculoId: id });
    await carregarVeiculos();
  } catch (error) {
    if (funcaoServidorIndisponivel(error)) {
      try {
        await devolverDiretamente(id, user);
        await carregarVeiculos();
        return;
      } catch (erroDireto) {
        const mensagensDiretas = {
          ITEM_NAO_ENCONTRADO: "Este item não foi encontrado.",
          SEM_PERMISSAO: "Você só pode devolver os itens solicitados por você."
        };
        alert(mensagensDiretas[erroDireto.message] || "Não foi possível devolver o item.");
        console.error("Erro ao devolver diretamente:", erroDireto);
        return;
      }
    }

    const mensagens = {
      "functions/permission-denied": "Somente quem solicitou o item ou o administrador pode devolvê-lo.",
      "functions/not-found": "Este item não foi encontrado.",
      "functions/failed-precondition": "Este item já está disponível."
    };

    alert(mensagens[error.code] || "Não foi possível devolver o item.");
    console.error("Erro ao devolver item:", error);
  }
};


/* =====================================================
   ADMIN + ATIVAR NOTIFICAÇÃO APÓS LOGIN
===================================================== */
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  // 🔔 Ativa notificação quando usuário estiver logado
  ativarNotificacoes();

  if (usuarioLogado) {
    usuarioLogado.textContent = `Usuário: ${user.email}`;
  }

  emailUsuarioAtual = String(user.email || "").trim().toLowerCase();
  usuarioEhAdmin = emailUsuarioAtual === ADMIN_EMAIL;

  if (usuarioEhAdmin) {
    if (adminBtn) adminBtn.style.display = "block";
    if (cadastroBtn) cadastroBtn.style.display = "block";
  }

  await carregarVeiculos();
});


/* =====================================================
   AUXILIARES
===================================================== */

function getNomeUsuario(email) {
  if (!email) return "";
  return email.split("@")[0];
}

function escaparHTML(valor) {
  return String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function atualizarPainel(listaVeiculos) {
  let disponiveis = 0;
  let reservados = 0;

  listaVeiculos.forEach(v => {
    if (v.status === "disponivel") {
      disponiveis++;
    } else {
      reservados++;
    }
  });

  document.getElementById("qtdDisponiveis").textContent = disponiveis;
  document.getElementById("qtdReservados").textContent = reservados;
}
