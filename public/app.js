import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const email = document.getElementById("email");
const senha = document.getElementById("senha");
const loginBtn = document.getElementById("login");
const cadastrarBtn = document.getElementById("cadastrar");
const rememberMe = document.getElementById("rememberMe");

const loader = document.getElementById("loader");
const msg = document.getElementById("msg");

/* ===============================
   LOGIN
================================ */

if (loginBtn) {
  loginBtn.onclick = async () => {
    try {
      const persistence = rememberMe && rememberMe.checked
        ? browserLocalPersistence
        : browserSessionPersistence;

      await setPersistence(auth, persistence);

      await signInWithEmailAndPassword(auth, email.value, senha.value);
      window.location.href = "veiculos.html";

    } catch (error) {
      alert("Erro ao fazer login");
      console.error(error.message);
    }
  };
}

/* ===============================
   CADASTRO COM LOADER
================================ */

if (cadastrarBtn) {
  cadastrarBtn.onclick = async () => {
    msg.textContent = "";
    msg.className = "msg";

    if (!email.value || !senha.value) {
      msg.textContent = "Preencha email e senha";
      msg.classList.add("error");
      return;
    }

    if (senha.value.length < 6) {
      msg.textContent = "Senha mínima de 6 caracteres";
      msg.classList.add("error");
      return;
    }

    try {
      cadastrarBtn.disabled = true;
      loader.classList.remove("hidden");

      await createUserWithEmailAndPassword(
        auth,
        email.value,
        senha.value
      );

      msg.textContent = "Cadastro realizado com sucesso!";
      msg.classList.add("success");

      setTimeout(() => {
        window.location.href = "index.html";
      }, 1500);

    } catch (error) {
      msg.textContent = "Erro ao cadastrar usuário";
      msg.classList.add("error");
      console.error(error.message);
    } finally {
      loader.classList.add("hidden");
      cadastrarBtn.disabled = false;
    }
  };
}
const botao = document.getElementById("login");

botao.addEventListener("click", () => {
  botao.classList.add("loading");
  botao.disabled = true;

  // Simula o tempo de login (substitua pela sua lógica real)
  setTimeout(() => {
    // Aqui você faz a validação, redireciona, etc.
    // Exemplo:
    // window.location.href = "dashboard.html";

    botao.classList.remove("loading");
    botao.disabled = false;
  }, 2000);
});
