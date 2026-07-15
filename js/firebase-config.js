import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBs3LrnVDUOij2kmZespcJCBv3EWa9lI8M",
  authDomain: "level-up-eval.firebaseapp.com",
  projectId: "level-up-eval",
  storageBucket: "level-up-eval.firebasestorage.app",
  messagingSenderId: "397816935880",
  appId: "1:397816935880:web:9d8a7fea13e292aa7ffcfd",
  measurementId: "G-1CGC0RV1BF"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { app, db };