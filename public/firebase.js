import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDtxh3omrvV_TMAyOpN1KwJDSY2uTjVfCI",
  authDomain: "reserva-veiculos-178e6.firebaseapp.com",
  projectId: "reserva-veiculos-178e6",
  storageBucket: "reserva-veiculos-178e6.firebasestorage.app",
  messagingSenderId: "541042381166",
  appId: "1:541042381166:web:9418c99d77081256ca717f"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
