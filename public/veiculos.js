import { db, auth } from "./firebase.js";
import { 
  collection, getDocs, doc, updateDoc, addDoc, serverTimestamp, getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const lista = document.getElementById("lista");
const adminBtn = document.getElementById("adminBtn");

async function carregarVeiculos(){
  const snap = await getDocs(collection(db,"veiculos"));
  lista.innerHTML = "";

  snap.forEach(v => {
    const dados = v.data();

    lista.innerHTML += `
      <div class="card">
        <img src="${dados.imagem}" width="200"><br>
        <b>${dados.modelo}</b><br>
        Placa: ${dados.placa}<br>
        Status: ${dados.status}<br><br>

        <button ${dados.status !== "disponivel" ? "disabled" : ""} onclick="solicitar('${v.id}')">
          Solicitar
        </button>

        <button onclick="devolver('${v.id}')">
          Devolver
        </button>
      </div>
      <hr>
    `;
  });
}

window.solicitar = async (id) => {
  const user = auth.currentUser;
  if(!user) return alert("Faça login novamente");

  await updateDoc(doc(db,"veiculos",id),{ status:"indisponivel" });

  await addDoc(collection(db,"solicitacoes"),{
    veiculo:id,
    usuario:user.email,
    tipo:"retirada",
    data:serverTimestamp()
  });

  carregarVeiculos();
}

window.devolver = async (id) => {
  const user = auth.currentUser;
  if(!user) return;

  await updateDoc(doc(db,"veiculos",id),{ status:"disponivel" });

  await addDoc(collection(db,"solicitacoes"),{
    veiculo:id,
    usuario:user.email,
    tipo:"devolucao",
    data:serverTimestamp()
  });

  carregarVeiculos();
}

// 🔐 Verificar se usuário é admin
auth.onAuthStateChanged(async (user)=>{
  if(!user || !adminBtn) return;

  const ref = doc(db,"admins",user.email);
  const snap = await getDoc(ref);

  if(snap.exists()){
    adminBtn.style.display = "block";
  }
});

carregarVeiculos();
