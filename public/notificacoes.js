const admin = require("firebase-admin");
const cron = require("node-cron");

// Inicializa Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(require("./serviceAccountKey.json"))
});

const db = admin.firestore();

/* =====================================================
   FUNÇÃO PARA ENVIAR NOTIFICAÇÃO PARA TODOS
===================================================== */
async function enviarParaTodos(titulo, mensagem) {
  try {
    const snapshot = await db.collection("tokens").get();

    if (snapshot.empty) {
      console.log("Nenhum token encontrado.");
      return;
    }

    const tokens = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.token) {
        tokens.push(data.token);
      }
    });

    if (tokens.length === 0) {
      console.log("Lista de tokens vazia.");
      return;
    }

    const response = await admin.messaging().sendEachForMulticast({
      tokens: tokens,
      notification: {
        title: titulo,
        body: mensagem
      }
    });

    console.log(`Notificações enviadas: ${response.successCount}`);
    console.log(`Falhas: ${response.failureCount}`);

    /* =====================================================
       REMOVE TOKENS INVÁLIDOS AUTOMATICAMENTE
    ===================================================== */
    if (response.failureCount > 0) {
      const tokensParaRemover = [];

      response.responses.forEach((resp, index) => {
        if (!resp.success) {
          tokensParaRemover.push(tokens[index]);
        }
      });

      const snapshotRemover = await db.collection("tokens").get();

      snapshotRemover.forEach(doc => {
        if (tokensParaRemover.includes(doc.data().token)) {
          doc.ref.delete();
        }
      });

      console.log("Tokens inválidos removidos.");
    }

  } catch (erro) {
    console.error("Erro ao enviar notificação:", erro);
  }
}

/* =====================================================
   AGENDAMENTO 08:00
===================================================== */
cron.schedule("37 10* * *", () => {
  console.log("Enviando notificação das 08h...");
  enviarParaTodos(
    "Bom dia 🚗",
    "Não esqueça de solicitar seu veículo."
  );
});

/* =====================================================
   AGENDAMENTO 18:00
===================================================== */
cron.schedule("0 18 * * *", () => {
  console.log("Enviando notificação das 18h...");
  enviarParaTodos(
    "Fim do expediente 🚘",
    "Não esqueça de devolver o veículo."
  );
});

console.log("Servidor de notificações rodando...");

