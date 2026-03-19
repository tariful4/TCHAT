import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, push, onValue, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyD62pLbwBDSyszTVuN4pi83SIBxFMjjfqQ",
  authDomain: "tariful-4f6c2.firebaseapp.com",
  databaseURL: "https://tariful-4f6c2-default-rtdb.firebaseio.com",
  projectId: "tariful-4f6c2",
  storageBucket: "tariful-4f6c2.firebasestorage.app",
  messagingSenderId: "882412147422",
  appId: "1:882412147422:web:3100db9391ccd0bdc4684f"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let currentUser = null;
let currentChatId = null;

// টাইম ফরম্যাট ফাংশন (১২ ঘণ্টা)
const get12HourTime = () => new Date().toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });

// ফরম সুইচিং
document.getElementById('toReg').onclick = () => { document.getElementById('login-form').style.display='none'; document.getElementById('reg-form').style.display='block'; };
document.getElementById('toLogin').onclick = () => { document.getElementById('reg-form').style.display='none'; document.getElementById('login-form').style.display='block'; };

// রেজিস্ট্রেশন
document.getElementById('registerBtn').onclick = async () => {
    const user = document.getElementById('regUser').value;
    const pass = document.getElementById('regPass').value;
    if(!user || !pass) return alert("Fill all fields!");

    const dbId = user.replace(/[^a-zA-Z0-9]/g, "");
    const userRef = ref(db, 'users/' + dbId);
    const snap = await get(userRef);

    if(snap.exists()) return alert("Account already exists! Please Login.");

    currentUser = { id: dbId, username: user.split('@')[0], password: pass, profilePic: `https://ui-avatars.com/api/?name=${user}&background=random` };
    await set(userRef, currentUser);
    startApp();
};

// লগইন
document.getElementById('loginBtn').onclick = async () => {
    const user = document.getElementById('loginUser').value;
    const pass = document.getElementById('loginPass').value;
    const dbId = user.replace(/[^a-zA-Z0-9]/g, "");
    const userRef = ref(db, 'users/' + dbId);
    const snap = await get(userRef);

    if(snap.exists() && snap.val().password === pass) {
        currentUser = snap.val();
        startApp();
    } else alert("Invalid Credentials!");
};

function startApp() {
    localStorage.setItem("m_user", JSON.stringify(currentUser));
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('messenger-app').style.display = 'block';
    document.getElementById('myPic').src = currentUser.profilePic;
    loadUserLists();
}

// অটোমেটিক ইউজার লিস্ট লোড
function loadUserLists() {
    onValue(ref(db, 'users/'), (snap) => {
        const list = document.getElementById('users-list');
        const activeBar = document.getElementById('active-bar');
        list.innerHTML = ""; activeBar.innerHTML = "";

        snap.forEach(child => {
            const u = child.val();
            if(u.id === currentUser.id) return;

            // স্টোরি বার
            activeBar.innerHTML += `<img src="${u.profilePic}" class="story-circle" onclick="openChat('${u.id}','${u.username}','${u.profilePic}')">`;

            // চ্যাট লিস্ট
            list.innerHTML += `
                <div class="chat-item" onclick="openChat('${u.id}','${u.username}','${u.profilePic}')">
                    <img src="${u.profilePic}">
                    <div class="chat-info"><b>${u.username}</b><p>Active now</p></div>
                </div>`;
        });
    });
}

// ইনবক্স ওপেন
window.openChat = (id, name, pic) => {
    document.getElementById('chat-list-page').style.display = 'none';
    document.getElementById('inbox-page').style.display = 'block';
    document.getElementById('partnerName').innerText = name;
    document.getElementById('partnerPic').src = pic;
    currentChatId = [currentUser.id, id].sort().join("_");
    
    onValue(ref(db, 'chats/' + currentChatId), (snap) => {
        const box = document.getElementById('chat-box');
        box.innerHTML = "";
        let lastTime = "";
        snap.forEach(m => {
            const d = m.val();
            if(d.time !== lastTime) {
                box.innerHTML += `<div class="time-stamp">${d.time}</div>`;
                lastTime = d.time;
            }
            box.innerHTML += `<div class="msg ${d.s === currentUser.id ? 'sent' : 'received'}">${d.t}</div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
};

document.getElementById('sendBtn').onclick = () => {
    const t = document.getElementById('messageInput').value;
    if(!t) return;
    push(ref(db, 'chats/' + currentChatId), { s: currentUser.id, t, time: get12HourTime() });
    document.getElementById('messageInput').value = "";
};

document.getElementById('backBtn').onclick = () => {
    document.getElementById('inbox-page').style.display = 'none';
    document.getElementById('chat-list-page').style.display = 'block';
};

document.getElementById('logoutBtn').onclick = () => { localStorage.clear(); location.reload(); };

const saved = localStorage.getItem("m_user");
if(saved) { currentUser = JSON.parse(saved); startApp(); }
