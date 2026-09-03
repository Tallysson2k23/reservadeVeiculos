import { getMessaging, getToken, onMessage } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";

import { db, auth } from "./firebase.js";

import {
  collection, getDocs, doc, updateDoc, addDoc,
  serverTimestamp, getDoc, query, where, setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";


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
const logoutBtn = document.getElementById("logout");
const usuarioLogado = document.getElementById("usuarioLogado");
const botoesCategoria = document.querySelectorAll(".categoria-btn");

let listaVeiculos = [];
let categoriaAtiva = "carros";


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
   ITENS QUE O USUÁRIO ESTÁ UTILIZANDO
===================================================== */
async function buscarItensEmUso(email) {
  const q = query(
    collection(db, "veiculos"),
    where("usuarioAtual", "==", email)
  );

  const snap = await getDocs(q);
  return snap.docs.map(documento => ({
    id: documento.id,
    ...documento.data()
  }));
}

function validarNovaSolicitacao(itemSolicitado, itensEmUso) {
  const tipoSolicitado = identificarTipo(itemSolicitado);
  const tiposEmUso = itensEmUso.map(identificarTipo);
  const temCapacete = tiposEmUso.includes("capacete");
  const temMoto = tiposEmUso.includes("moto");
  const temCarro = tiposEmUso.includes("carro");

  if (tipoSolicitado === "capacete") {
    if (temCapacete) {
      return {
        permitido: false,
        mensagem: "Você já possui um capacete em uso. Devolva-o antes de solicitar outro."
      };
    }

    return { permitido: true };
  }

  if (temMoto || temCarro) {
    return {
      permitido: false,
      mensagem: "Você já possui um veículo em uso. Devolva-o antes de solicitar outro."
    };
  }

  return { permitido: true };
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

      <button data-acao="devolver" data-id="${id}">
        Devolver
      </button>
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

  const veiculoRef = doc(db, "veiculos", id);
  const [veiculoSnap, itensEmUso] = await Promise.all([
    getDoc(veiculoRef),
    buscarItensEmUso(user.email)
  ]);

  if (!veiculoSnap.exists()) {
    alert("Este item não foi encontrado.");
    carregarVeiculos();
    return;
  }

  const itemSolicitado = {
    id: veiculoSnap.id,
    ...veiculoSnap.data()
  };

  if (itemSolicitado.status !== "disponivel") {
    alert("Este item não está mais disponível.");
    carregarVeiculos();
    return;
  }

  const validacao = validarNovaSolicitacao(itemSolicitado, itensEmUso);
  if (!validacao.permitido) {
    alert(validacao.mensagem);
    return;
  }

  await updateDoc(veiculoRef, {
    status: "indisponivel",
    usuarioAtual: user.email
  });

  await addDoc(collection(db, "solicitacoes"), {
    veiculo: id,
    usuario: user.email,
    tipo: "retirada",
    data: serverTimestamp()
  });

  carregarVeiculos();
};


/* =====================================================
   DEVOLVER VEÍCULO
===================================================== */
window.devolver = async (id) => {
  const user = auth.currentUser;
  if (!user) return;

  const veiculoRef = doc(db, "veiculos", id);
  const veiculoSnap = await getDoc(veiculoRef);

  if (!veiculoSnap.exists()) return;

  const dados = veiculoSnap.data();

  if (dados.usuarioAtual !== user.email) {
    alert("Você não pode devolver um veículo que não foi solicitado por você.");
    return;
  }

  await updateDoc(veiculoRef, {
    status: "disponivel",
    usuarioAtual: null
  });

  await addDoc(collection(db, "solicitacoes"), {
    veiculo: id,
    usuario: user.email,
    tipo: "devolucao",
    data: serverTimestamp()
  });

  carregarVeiculos();
};


/* =====================================================
   ADMIN + ATIVAR NOTIFICAÇÃO APÓS LOGIN
===================================================== */
auth.onAuthStateChanged(async (user) => {
  if (!user) return;

  // 🔔 Ativa notificação quando usuário estiver logado
  ativarNotificacoes();

  if (usuarioLogado) {
    usuarioLogado.textContent = `Usuário: ${user.email}`;
  }

  if (adminBtn) {
    const ref = doc(db, "admins", user.email);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      adminBtn.style.display = "block";
    }
  }
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

carregarVeiculos();
