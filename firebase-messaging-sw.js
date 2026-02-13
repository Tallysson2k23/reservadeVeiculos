importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDtxh3omrvV_TMAyOpN1KwJDSY2uTjVfCI", // ⚠️ NÃO É A VAPID
  authDomain: "reserva-veiculos-178e6.firebaseapp.com",
  projectId: "reserva-veiculos-178e6",
  messagingSenderId: "541042381166",
  appId: "1:541042381166:web:9418c99d77081256ca717f"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  console.log("Mensagem recebida em background:", payload);

  const notificationTitle = payload.notification?.title || "Notificação";
  const notificationOptions = {
    body: payload.notification?.body || "",
    icon: "/icon.png"
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
