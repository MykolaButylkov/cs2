// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCaT-CqQ_ymHl5hFWH8H_FGXEHOxQgunro",
    authDomain: "cs2-website.firebaseapp.com",
    projectId: "cs2-website",
    storageBucket: "cs2-website.firebasestorage.app",
    messagingSenderId: "11271752790",
    appId: "1:11271752790:web:17d92176a2f2cc78c27ff7",
    measurementId: "G-NF0Z5KGLY1"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
