// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAYFZDyDpFa86bRIvzweO81t6lhYEA2SHw",
  authDomain: "dukabrai.firebaseapp.com",
  projectId: "dukabrai",
  storageBucket: "dukabrai.firebasestorage.app",
  messagingSenderId: "296404813290",
  appId: "1:296404813290:web:dcd05c05cb065803e31e93",
  measurementId: "G-E3MBLMXPLX"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getFirestore(app);