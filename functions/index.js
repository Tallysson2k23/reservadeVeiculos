const { setGlobalOptions } = require("firebase-functions/v2");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();
setGlobalOptions({ region: "southamerica-east1", maxInstances: 10 });

const db = getFirestore();
const ADMIN_EMAIL = "admin@gmail.com";

function emailDoUsuario(request) {
  return String(request.auth?.token?.email || "").trim().toLowerCase();
}

function exigirLogin(request) {
  const email = emailDoUsuario(request);
  if (!request.auth || !email) {
    throw new HttpsError("unauthenticated", "Faça login novamente.");
  }
  return email;
}

function exigirAdmin(request) {
  const email = exigirLogin(request);
  if (email !== ADMIN_EMAIL) {
    throw new HttpsError("permission-denied", "Somente o administrador pode realizar esta ação.");
  }
  return email;
}

function exigirId(valor) {
  const id = String(valor || "").trim();
  if (!id || id.length > 200 || id.includes("/")) {
    throw new HttpsError("invalid-argument", "Item inválido.");
  }
  return id;
}

function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function identificarTipo(item) {
  const tipo = normalizarTexto(item.tipo || item.categoria);
  if (tipo.includes("capacete")) return "capacete";
  if (tipo === "moto" || tipo === "motocicleta") return "moto";
  if (tipo === "carro" || tipo === "automovel") return "carro";

  const descricao = normalizarTexto(`${item.modelo || ""} ${item.descricao || ""}`);
  if (descricao.includes("capacete")) return "capacete";
  if (/\b(moto|motocicleta|pop|biz|bros|titan|fan|factor|fazer|start|xre|cg)\b/.test(descricao)) {
    return "moto";
  }
  return "carro";
}

exports.criarUsuario = onCall(async (request) => {
  exigirAdmin(request);

  const email = String(request.data?.email || "").trim().toLowerCase();
  const senha = String(request.data?.senha || "");

  if (!/^\S+@\S+\.\S+$/.test(email) || senha.length < 6) {
    throw new HttpsError("invalid-argument", "Informe um email válido e uma senha de pelo menos 6 caracteres.");
  }

  try {
    const usuario = await getAuth().createUser({ email, password: senha });
    return { uid: usuario.uid, email: usuario.email };
  } catch (erro) {
    if (erro.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "Este email já está cadastrado.");
    }
    if (erro.code === "auth/invalid-email" || erro.code === "auth/invalid-password") {
      throw new HttpsError("invalid-argument", "Email ou senha inválidos.");
    }
    console.error("Erro ao criar usuário:", erro);
    throw new HttpsError("internal", "Não foi possível criar o usuário.");
  }
});

exports.solicitarItem = onCall(async (request) => {
  const email = exigirLogin(request);
  const veiculoId = exigirId(request.data?.veiculoId);
  const veiculoRef = db.collection("veiculos").doc(veiculoId);
  const usoRef = db.collection("usuariosEmUso").doc(request.auth.uid);
  const solicitacaoRef = db.collection("solicitacoes").doc();
  const itensAtuaisQuery = db.collection("veiculos").where("usuarioAtual", "==", email);

  await db.runTransaction(async (transaction) => {
    const [veiculoSnap, usoSnap, itensAtuaisSnap] = await Promise.all([
      transaction.get(veiculoRef),
      transaction.get(usoRef),
      transaction.get(itensAtuaisQuery)
    ]);

    if (!veiculoSnap.exists) {
      throw new HttpsError("not-found", "Item não encontrado.");
    }

    const item = veiculoSnap.data();
    if (item.status !== "disponivel") {
      throw new HttpsError("already-exists", "Item indisponível.");
    }

    const tipo = identificarTipo(item);
    const uso = usoSnap.exists ? usoSnap.data() : {};
    const tiposAtuais = itensAtuaisSnap.docs.map((documento) => identificarTipo(documento.data()));
    const jaTemCapacete = Boolean(uso.capaceteId) || tiposAtuais.includes("capacete");
    const jaTemVeiculo = Boolean(uso.veiculoId)
      || tiposAtuais.includes("carro")
      || tiposAtuais.includes("moto");

    if (tipo === "capacete" && jaTemCapacete) {
      throw new HttpsError("failed-precondition", "Você já possui um capacete em uso.");
    }
    if (tipo !== "capacete" && jaTemVeiculo) {
      throw new HttpsError("failed-precondition", "Você já possui um veículo em uso.");
    }

    const campo = tipo === "capacete" ? "capaceteId" : "veiculoId";
    transaction.update(veiculoRef, {
      status: "indisponivel",
      usuarioAtual: email
    });
    transaction.set(usoRef, {
      email,
      [campo]: veiculoId,
      atualizadoEm: FieldValue.serverTimestamp()
    }, { merge: true });
    transaction.create(solicitacaoRef, {
      veiculo: veiculoId,
      usuario: email,
      tipo: "retirada",
      data: FieldValue.serverTimestamp()
    });
  });

  return { ok: true };
});

exports.devolverItem = onCall(async (request) => {
  const email = exigirLogin(request);
  const veiculoId = exigirId(request.data?.veiculoId);
  const veiculoRef = db.collection("veiculos").doc(veiculoId);
  const solicitacaoRef = db.collection("solicitacoes").doc();

  await db.runTransaction(async (transaction) => {
    const veiculoSnap = await transaction.get(veiculoRef);
    if (!veiculoSnap.exists) {
      throw new HttpsError("not-found", "Item não encontrado.");
    }

    const item = veiculoSnap.data();
    if (item.status === "disponivel") {
      throw new HttpsError("failed-precondition", "Item já disponível.");
    }

    const usuarioAnterior = String(item.usuarioAtual || "").trim().toLowerCase();
    const usuarioEhAdmin = email === ADMIN_EMAIL;

    if (!usuarioEhAdmin && usuarioAnterior !== email) {
      throw new HttpsError(
        "permission-denied",
        "Somente quem solicitou o item ou o administrador pode devolvê-lo."
      );
    }

    const usuarioDoHistorico = usuarioAnterior || "Usuário não informado";
    const controlesQuery = db.collection("usuariosEmUso").where("email", "==", usuarioAnterior);
    const controlesSnap = item.usuarioAtual
      ? await transaction.get(controlesQuery)
      : null;

    transaction.update(veiculoRef, {
      status: "disponivel",
      usuarioAtual: null
    });
    transaction.create(solicitacaoRef, {
      veiculo: veiculoId,
      usuario: usuarioDoHistorico,
      tipo: usuarioEhAdmin && usuarioAnterior !== email
        ? "devolucao_admin"
        : "devolucao",
      devolvidoPor: email,
      data: FieldValue.serverTimestamp()
    });

    if (controlesSnap) {
      const tipo = identificarTipo(item);
      const campo = tipo === "capacete" ? "capaceteId" : "veiculoId";
      for (const controle of controlesSnap.docs) {
        if (controle.data()[campo] === veiculoId) {
          transaction.update(controle.ref, {
            [campo]: FieldValue.delete(),
            atualizadoEm: FieldValue.serverTimestamp()
          });
        }
      }
    }
  });

  return { ok: true };
});

exports.devolucaoAutomatica = onSchedule({
  schedule: "0 23 * * *",
  timeZone: "America/Sao_Paulo",
  retryCount: 3
}, async () => {
  const snapshot = await db.collection("veiculos")
    .where("status", "==", "indisponivel")
    .get();

  const itens = snapshot.docs;
  for (let inicio = 0; inicio < itens.length; inicio += 200) {
    const batch = db.batch();
    const grupo = itens.slice(inicio, inicio + 200);

    for (const itemSnap of grupo) {
      const dados = itemSnap.data();
      batch.update(itemSnap.ref, {
        status: "disponivel",
        usuarioAtual: null
      });
      batch.create(db.collection("solicitacoes").doc(), {
        veiculo: itemSnap.id,
        usuario: dados.usuarioAtual || "Usuário não informado",
        tipo: "devolucao_automatica",
        data: FieldValue.serverTimestamp()
      });
    }
    await batch.commit();
  }

  const controles = await db.collection("usuariosEmUso").get();
  for (let inicio = 0; inicio < controles.docs.length; inicio += 450) {
    const batch = db.batch();
    for (const controle of controles.docs.slice(inicio, inicio + 450)) {
      batch.delete(controle.ref);
    }
    await batch.commit();
  }

  console.log(`${itens.length} item(ns) devolvido(s) automaticamente às 23h.`);
});
