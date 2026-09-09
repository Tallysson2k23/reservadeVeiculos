import { app, auth } from "./firebase.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  initializeAuth,
  inMemoryPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const email = document.getElementById("email");
const senha = document.getElementById("senha");
const loginBtn = document.getElementById("login");
const cadastrarBtn = document.getElementById("cadastrar");
const rememberMe = document.getElementById("rememberMe");
const loader = document.getElementById("loader");
const msg = document.getElementById("msg");

if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    try {
      loginBtn.classList.add("loading");
      loginBtn.disabled = true;

      const persistence = rememberMe?.checked
        ? browserLocalPersistence
        : browserSessionPersistence;

      await setPersistence(auth, persistence);
      await signInWithEmailAndPassword(auth, email.value.trim(), senha.value);
      window.location.href = "veiculos.html";
    } catch (error) {
      alert("Email ou senha inválidos.");
      console.error("Erro ao fazer login:", error);
      loginBtn.classList.remove("loading");
      loginBtn.disabled = false;
    }
  });
}

/* A instância temporária preserva a sessão de quem está cadastrando. */
if (cadastrarBtn) {
  cadastrarBtn.addEventListener("click", async () => {
    if (cadastrarBtn.disabled) return;
    msg.textContent = "";
    msg.className = "msg";

    const novoEmail = email.value.trim().toLowerCase();
    const novaSenha = senha.value;

    if (!novoEmail || !novaSenha) {
      msg.textContent = "Preencha email e senha.";
      msg.classList.add("error");
      return;
    }

    if (novaSenha.length < 6) {
      msg.textContent = "A senha deve ter no mínimo 6 caracteres.";
      msg.classList.add("error");
      return;
    }

    let cadastroApp;
    try {
      cadastrarBtn.disabled = true;
      loader?.classList.remove("hidden");

      cadastroApp = initializeApp(app.options, "cadastro-temporario");
      const cadastroAuth = initializeAuth(cadastroApp, { persistence: inMemoryPersistence });
      await createUserWithEmailAndPassword(cadastroAuth, novoEmail, novaSenha);

      msg.textContent = "Usuário criado com sucesso!";
      msg.classList.add("success");
      email.value = "";
      senha.value = "";
    } catch (error) {
      const mensagens = {
        "auth/email-already-in-use": "Este email já está cadastrado.",
        "auth/invalid-email": "Informe um email válido.",
        "auth/weak-password": "Use uma senha mais forte, com pelo menos 6 caracteres.",
        "auth/password-does-not-meet-requirements": "A senha não atende aos requisitos. Use uma senha mais forte.",
        "auth/operation-not-allowed": "Habilite o cadastro por email e senha no Firebase Authentication.",
        "auth/admin-restricted-operation": "A criação de contas está desativada no Firebase. Habilite o cadastro nas configurações de autenticação.",
        "auth/network-request-failed": "Falha de conexão. Verifique sua internet e tente novamente.",
        "auth/too-many-requests": "Muitas tentativas de cadastro. Aguarde um pouco e tente novamente."
      };

      msg.textContent = mensagens[error.code] || "Não foi possível criar o usuário.";
      msg.classList.add("error");
      console.error("Erro ao cadastrar usuário:", error);
    } finally {
      if (cadastroApp) {
        await deleteApp(cadastroApp).catch((error) => {
          console.error("Erro ao encerrar a instância temporária de cadastro:", error);
        });
      }
      loader?.classList.add("hidden");
      cadastrarBtn.disabled = false;
    }
  });
}
