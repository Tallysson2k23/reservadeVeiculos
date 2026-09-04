import { auth, functions } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

const ADMIN_EMAIL = "admin@gmail.com";

const email = document.getElementById("email");
const senha = document.getElementById("senha");
const loginBtn = document.getElementById("login");
const cadastrarBtn = document.getElementById("cadastrar");
const rememberMe = document.getElementById("rememberMe");
const loader = document.getElementById("loader");
const msg = document.getElementById("msg");

function emailNormalizado(user) {
  return String(user?.email || "").trim().toLowerCase();
}

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

/* Cadastro feito no servidor para não trocar a sessão do administrador. */
if (cadastrarBtn) {
  cadastrarBtn.disabled = true;

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }

    if (emailNormalizado(user) !== ADMIN_EMAIL) {
      alert("Somente o administrador pode criar usuários.");
      window.location.href = "veiculos.html";
      return;
    }

    cadastrarBtn.disabled = false;
  });

  cadastrarBtn.addEventListener("click", async () => {
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

    try {
      cadastrarBtn.disabled = true;
      loader?.classList.remove("hidden");

      const criarUsuario = httpsCallable(functions, "criarUsuario");
      await criarUsuario({ email: novoEmail, senha: novaSenha });

      msg.textContent = "Usuário criado com sucesso!";
      msg.classList.add("success");
      email.value = "";
      senha.value = "";
    } catch (error) {
      const mensagens = {
        "functions/already-exists": "Este email já está cadastrado.",
        "functions/invalid-argument": "Confira o email e a senha informados.",
        "functions/permission-denied": "Somente o administrador pode criar usuários.",
        "functions/unauthenticated": "Sua sessão expirou. Entre novamente."
      };

      msg.textContent = mensagens[error.code] || "Não foi possível criar o usuário.";
      msg.classList.add("error");
      console.error("Erro ao cadastrar usuário:", error);
    } finally {
      loader?.classList.add("hidden");
      cadastrarBtn.disabled = false;
    }
  });
}
