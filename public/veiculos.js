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
   VERIFICA SE USUÁRIO JÁ TEM VEÍCULO ATIVO
===================================================== */
async function usuarioJaTemVeiculo(email) {
  const q = query(
    collection(db, "veiculos"),
    where("usuarioAtual", "==", email)
  );

  const snap = await getDocs(q);
  return !snap.empty;
}


/* =====================================================
   CARREGAR VEÍCULOS
===================================================== */
async function carregarVeiculos() {
  const snap = await getDocs(collection(db, "veiculos"));
  lista.innerHTML = "";

  const listaVeiculos = [];

  snap.forEach(v => {
    const dados = v.data();
    listaVeiculos.push(dados);

    const indisponivel = dados.status !== "disponivel";

    lista.innerHTML += `
      <div class="card">
        <img src="${dados.imagem}">
        <b>${dados.modelo}</b>
        <p>Placa: ${dados.placa}</p>
        
${
    dados.status !== "disponivel" && dados.usuarioAtual
        ? `
            <p class="usuario-veiculo">
                Está com:
                <strong class="nome-usuario">
                    ${getNomeUsuario(dados.usuarioAtual)}
                </strong>
            </p>
        `
        : ""
}

        <button
          class="${indisponivel ? 'btn-indisponivel' : ''}"
          ${indisponivel ? "disabled" : ""}
          onclick="solicitar('${v.id}')">
          ${indisponivel ? "INDISPONÍVEL" : "Solicitar"}
        </button>

        <button onclick="devolver('${v.id}')">
          Devolver
        </button>
      </div>
    `;
  });

  atualizarPainel(listaVeiculos);
}


/* =====================================================
   SOLICITAR VEÍCULO
===================================================== */
window.solicitar = async (id) => {
  const user = auth.currentUser;
  if (!user) {
    alert("Faça login novamente");
    return;
  }

  const jaTem = await usuarioJaTemVeiculo(user.email);
  if (jaTem) {
    alert("Você já possui um veículo em uso. Devolva antes de solicitar outro.");
    return;
  }

  await updateDoc(doc(db, "veiculos", id), {
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
