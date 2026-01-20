import { auth } from "./firebase.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const btnLogin = document.getElementById("login");
const btnCadastro = document.getElementById("cadastrar");

if(btnCadastro){
btnCadastro.onclick = () => {
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;

  createUserWithEmailAndPassword(auth, email, senha)
    .then(() => alert("Usuário criado!"))
    .catch(e => alert(e.message));
}
}

if(btnLogin){
btnLogin.onclick = () => {
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;

  signInWithEmailAndPassword(auth, email, senha)
    .then(() => window.location.href = "veiculos.html")
    .catch(e => alert("Erro: " + e.message));
}
}
