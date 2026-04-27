// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA00URrFEBgNpF9Ieg1cXQX1bvXmR5jdl0",
  authDomain: "vione-8fd14.firebaseapp.com",
  projectId: "vione-8fd14",
  storageBucket: "vione-8fd14.firebasestorage.app",
  messagingSenderId: "969728993586",
  appId: "1:969728993586:web:623b032ad0d64232fd4f2b",
  measurementId: "G-D6GR7777HT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getFirestore(app);