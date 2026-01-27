import { db, auth } from "./firebase.js";
import {
  collection, getDocs, query, orderBy, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged }
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const tabela = document.getElementById("tabela");
const filtroData = document.getElementById("filtroData");
const btnBuscar = document.getElementById("btnBuscar");
const btnHoje = document.getElementById("btnHoje");
const adminLoader = document.getElementById("adminLoader");

let registros = [];

/* =====================================================
   ADMIN
===================================================== */
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

/* =====================================================
   DATA UTIL — FUSO LOCAL CORRETO
===================================================== */
function criarDataLocal(yyyy_mm_dd){
  const [ano, mes, dia] = yyyy_mm_dd.split("-");
  return new Date(ano, mes - 1, dia);
}

function inicioDoDia(data){
  return new Date(data.getFullYear(), data.getMonth(), data.getDate(), 0, 0, 0);
}

function fimDoDia(data){
  return new Date(data.getFullYear(), data.getMonth(), data.getDate(), 23, 59, 59);
}

/* =====================================================
   LOADER
===================================================== */
function mostrarLoader(){
  adminLoader.classList.remove("hidden");
  btnBuscar.disabled = true;
  btnHoje.disabled = true;
}

function esconderLoader(){
  adminLoader.classList.add("hidden");
  btnBuscar.disabled = false;
  btnHoje.disabled = false;
}

/* =====================================================
   CARREGAR DADOS DO FIRESTORE
===================================================== */
async function carregarDados(){
  mostrarLoader();

  registros = [];
  tabela.innerHTML = "";

  const q = query(collection(db,"solicitacoes"), orderBy("data","desc"));
  const snap = await getDocs(q);

  for(const s of snap.docs){
    const d = s.data();
    if(!d.data) continue;

    const vRef = doc(db,"veiculos",d.veiculo);
    const vSnap = await getDoc(vRef);

    let placa = "";
    let modelo = "";

    if(vSnap.exists()){
      placa = vSnap.data().placa;
      modelo = vSnap.data().modelo;
    }

    registros.push({
      usuario: d.usuario,
      veiculo: `${modelo} - ${placa}`,
      tipo: d.tipo,
      data: d.data.toDate()
    });
  }

  mostrarHoje();
  esconderLoader();
}

/* =====================================================
   RENDER
===================================================== */
function renderizar(lista){
  tabela.innerHTML = "";

  if(lista.length === 0){
    tabela.innerHTML = `
      <tr>
        <td colspan="4" class="admin-vazio">
          Nenhum registro encontrado para esta data.
        </td>
      </tr>
    `;
    return;
  }

  lista.forEach(r => {
    tabela.innerHTML += `
      <tr>
        <td>${r.usuario}</td>
        <td>${r.veiculo}</td>
        <td>${r.tipo}</td>
        <td>${r.data.toLocaleString("pt-BR")}</td>
      </tr>
    `;
  });
}

/* =====================================================
   FILTROS
===================================================== */
function filtrarPorData(dataSelecionada){
  const inicio = inicioDoDia(dataSelecionada);
  const fim = fimDoDia(dataSelecionada);

  const resultado = registros.filter(r =>
    r.data >= inicio && r.data <= fim
  );

  renderizar(resultado);
}

function mostrarHoje(){
  filtrarPorData(new Date());
}

/* =====================================================
   BOTÕES
===================================================== */
btnBuscar.onclick = () => {
  if(!filtroData.value){
    alert("Selecione uma data");
    return;
  }

  mostrarLoader();
  const dataLocal = criarDataLocal(filtroData.value);

  setTimeout(() => {
    filtrarPorData(dataLocal);
    esconderLoader();
  }, 300);
};

btnHoje.onclick = () => {
  filtroData.value = "";

  mostrarLoader();
  setTimeout(() => {
    mostrarHoje();
    esconderLoader();
  }, 300);
};

/* =====================================================
   INIT
===================================================== */
onAuthStateChanged(auth, async (user)=>{
  if(!user){
    window.location.href = "index.html";
    return;
  }

  if(await verificarAdmin(user)){
    carregarDados();
  }
});
