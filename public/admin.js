import { db, auth } from "./firebase.js";
import { collection, getDocs, query, orderBy, doc, getDoc }
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged }
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const tabela = document.getElementById("tabela");

async function verificarAdmin(user){
  const ref = doc(db,"admins",user.email);
  const snap = await getDoc(ref);

  if(!snap.exists()){
    alert("Acesso negado");
    window.location.href = "veiculos.html";
    return false;
  }
  return true;
}

function ehHoje(dataFirestore){
  const hoje = new Date();
  const data = dataFirestore.toDate();

  return (
    data.getDate() === hoje.getDate() &&
    data.getMonth() === hoje.getMonth() &&
    data.getFullYear() === hoje.getFullYear()
  );
}

async function carregarDashboard(){
  tabela.innerHTML = "";

  const q = query(collection(db,"solicitacoes"), orderBy("data","desc"));
  const snap = await getDocs(q);

  for(const registro of snap.docs){
    const dados = registro.data();

    if(!dados.data || !ehHoje(dados.data)) continue;

    const veiculoRef = doc(db,"veiculos",dados.veiculo);
    const veiculoSnap = await getDoc(veiculoRef);

    let placa = "";
    let modelo = "";

    if(veiculoSnap.exists()){
      placa = veiculoSnap.data().placa;
      modelo = veiculoSnap.data().modelo;
    }

    const data = dados.data.toDate().toLocaleString("pt-BR");

    tabela.innerHTML += `
      <tr>
        <td>${dados.usuario}</td>
        <td>${modelo} - ${placa}</td>
        <td>${dados.tipo}</td>
        <td>${data}</td>
      </tr>
    `;
  }
}

onAuthStateChanged(auth, async (user)=>{
  if(!user){
    window.location.href = "index.html";
    return;
  }

  const autorizado = await verificarAdmin(user);
  if(autorizado) carregarDashboard();
});
