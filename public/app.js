import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const email = document.getElementById("email");
const senha = document.getElementById("senha");
const loginBtn = document.getElementById("login");
const rememberMe = document.getElementById("rememberMe");

loginBtn.onclick = async () => {
  try {
    // 🔑 Define persistência baseada na caixinha
    const persistence = rememberMe.checked
      ? browserLocalPersistence     // mantém logado
      : browserSessionPersistence;  // sessão temporária

    await setPersistence(auth, persistence);

    await signInWithEmailAndPassword(
      auth,
      email.value,
      senha.value
    );

    window.location.href = "veiculos.html";

  } catch (error) {
    alert("Erro ao fazer login");
    console.error(error);
  }
};
