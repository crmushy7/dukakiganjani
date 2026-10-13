import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAYFZDyDpFa86bRIvzweO81t6lhYEA2SHw",
  authDomain: "dukabrai.firebaseapp.com",
  projectId: "dukabrai",
  storageBucket: "dukabrai.firebasestorage.app",
  messagingSenderId: "296404813290",
  appId: "1:296404813290:web:dcd05c05cb065803e31e93",
  measurementId: "G-E3MBLMXPLX"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

if (typeof window !== "undefined") {
  getAnalytics(app);
}
