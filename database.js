import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ========================================================
// DATABASE CONFIGURATIONS
// ========================================================
const firebaseConfigAuth = {
    apiKey: "AIzaSyCOwXc5gc46tz1UjPEqcA993YS62clgV_k",
    authDomain: "tchat-46fdb.firebaseapp.com",
    projectId: "tchat-46fdb",
    storageBucket: "tchat-46fdb.firebasestorage.app",
    messagingSenderId: "223368702559",
    appId: "1:223368702559:web:65b9a708ffb81a861909ea"
};

const firebaseConfigApp = {
    apiKey: "AIzaSyDEomqqoxCRZD_27bO70G1MibcAZIV6dQU",
    authDomain: "tchat-b.firebaseapp.com",
    projectId: "tchat-b",
    storageBucket: "tchat-b.firebasestorage.app",
    messagingSenderId: "501622865543",
    appId: "1:501622865543:web:8c11cb04aed6c6fd1dc222"
};

const firebaseConfigChat = {
    apiKey: "AIzaSyAT22X04lwGjaneGGW9sKzeO6hWVAA3n6g",
    authDomain: "tchat-a9707.firebaseapp.com",
    databaseURL: "https://tchat-a9707-default-rtdb.firebaseio.com",
    projectId: "tchat-a9707",
    storageBucket: "tchat-a9707.firebasestorage.app",
    messagingSenderId: "324756549796",
    appId: "1:324756549796:web:f557ebab16be9e5545f631"
};

const appAuth = initializeApp(firebaseConfigAuth, "authInstance");
const appApp = initializeApp(firebaseConfigApp, "appInstance");
const appChat = initializeApp(firebaseConfigChat, "chatInstance");

export const dbAuth = getFirestore(appAuth); 
export const dbApp = getFirestore(appApp);   
export const dbChat = getDatabase(appChat);  
export const auth = getAuth(appAuth);
