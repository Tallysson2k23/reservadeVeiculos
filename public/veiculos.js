import { db, auth } from "./firebase.js";
import {
  collection, getDocs, doc, updateDoc, addDoc,
  serverTimestamp, getDoc, query, where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const lista = document.getElementById("lista");
const adminBtn = document.getElementById("adminBtn");
const logoutBtn = document.getElementById("logout");

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

  snap.forEach(v => {
    const dados = v.data();
    const indisponivel = dados.status !== "disponivel";

    lista.innerHTML += `
      <div class="card">
        <img src="${dados.imagem}">
        <b>${dados.modelo}</b>
        <p>Placa: ${dados.placa}</p>
        <p>Status: ${dados.status}</p>

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
   DEVOLVER VEÍCULO (🔒 REGRA CORRETA AQUI)
===================================================== */
window.devolver = async (id) => {
  const user = auth.currentUser;
  if (!user) return;

  const veiculoRef = doc(db, "veiculos", id);
  const veiculoSnap = await getDoc(veiculoRef);

  if (!veiculoSnap.exists()) return;

  const dados = veiculoSnap.data();

  // 🔴 REGRA: só quem solicitou pode devolver
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
   ADMIN
===================================================== */
auth.onAuthStateChanged(async (user) => {
  if (!user) return;

  // 👤 Mostrar usuário logado
  if (usuarioLogado) {
    usuarioLogado.textContent = `Usuário: ${user.email}`;
  }

  // 🔐 Admin
  if (adminBtn) {
    const ref = doc(db, "admins", user.email);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      adminBtn.style.display = "block";
    }
  }
});


carregarVeiculos();
