import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, push, onValue, get, remove, onDisconnect } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyD62pLbwBDSyszTVuN4pi83SIBxFMjjfqQ",
  authDomain: "tariful-4f6c2.firebaseapp.com",
  databaseURL: "https://tariful-4f6c2-default-rtdb.firebaseio.com",
  projectId: "tariful-4f6c2",
  storageBucket: "tariful-4f6c2.firebasestorage.app",
  messagingSenderId: "882412147422",
  appId: "1:882412147422:web:3100db9391ccd0bdc4684f",
  measurementId: "G-TDF69WJXNP"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let currentUser = null;
let chatPartner = null;
let currentChatId = null;

// ১২ ঘণ্টার টাইম ফরম্যাট ফাংশন
function formatTime() {
    return new Date().toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
}

// অটো লগইন চেক
window.onload = () => {
    const saved = localStorage.getItem("messenger_user");
    if(saved) {
        currentUser = JSON.parse(saved);
        loginSuccess();
    }
};

// রেজিস্ট্রেশন ও লগইন
document.getElementById('authBtn').onclick = async () => {
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const phone = document.getElementById('regPhone').value;
    const pass = document.getElementById('regPass').value;

    if(!phone || !pass) return alert("Phone and Password are required!");

    const userRef = ref(db, 'users/' + phone);
    const snap = await get(userRef);

    if(snap.exists()){
        if(snap.val().password === pass) {
            currentUser = snap.val();
            loginSuccess();
        } else alert("Wrong password!");
    } else {
        currentUser = { username: name || "New User", email: email || "N/A", phone, password: pass, profilePic: "https://ui-avatars.com/api/?name="+name, status: "online" };
        await set(userRef, currentUser);
        loginSuccess();
    }
};

function loginSuccess() {
    localStorage.setItem("messenger_user", JSON.stringify(currentUser));
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('chat-interface').style.display = 'flex';
    document.getElementById('myName').innerText = currentUser.username;
    document.getElementById('myPic').src = currentUser.profilePic;

    // অনলাইন স্ট্যাটাস হ্যান্ডলিং
    const statusRef = ref(db, 'users/' + currentUser.phone + '/status');
    set(statusRef, "online");
    onDisconnect(statusRef).set("offline");

    loadUsers();
}

// ইউজার লিস্ট লোড (প্রাইভেসি মেনটেইন করে)
function loadUsers() {
    onValue(ref(db, 'users/'), (snapshot) => {
        const listDiv = document.getElementById('users-list');
        listDiv.innerHTML = "";
        snapshot.forEach(child => {
            const user = child.val();
            if(user.phone !== currentUser.phone) {
                const item = document.createElement('div');
                item.className = 'user-item';
                item.innerHTML = `
                    <div class="avatar-box">
                        <img src="${user.profilePic}" class="list-avatar">
                        <div class="status-dot ${user.status === 'online' ? 'online' : ''}"></div>
                    </div>
                    <div>
                        <div style="font-weight:bold;">${user.username}</div>
                        <div style="font-size:12px; color:gray;">Tap to chat</div>
                    </div>
                `;
                item.onclick = () => openChat(user);
                listDiv.appendChild(item);
            }
        });
    });
}

// চ্যাট ওপেন ও মেসেজ ম্যানেজমেন্ট
function openChat(partner) {
    chatPartner = partner;
    document.getElementById('chat-header').innerText = partner.username;
    document.getElementById('input-section').style.display = 'flex';
    currentChatId = [currentUser.phone, partner.phone].sort().join("_");

    // মেসেজ লোড
    onValue(ref(db, 'chats/' + currentChatId), (snapshot) => {
        const box = document.getElementById('chat-box');
        box.innerHTML = "";
        snapshot.forEach(m => {
            const data = m.val();
            box.innerHTML += `
                <div class="msg-container ${data.sender === currentUser.phone ? 'sent' : 'received'}">
                    <div class="bubble">${data.text}</div>
                    <div class="time">${data.timestamp}</div>
                </div>`;
        });
        box.scrollTop = box.scrollHeight;
    });

    // টাইপিং স্ট্যাটাস চেক
    onValue(ref(db, `typing/${currentChatId}/${partner.phone}`), (snap) => {
        document.getElementById('typing-text').innerText = snap.val() ? partner.username + " is typing..." : "";
    });
}

// মেসেজ পাঠানো
document.getElementById('sendBtn').onclick = () => {
    const text = document.getElementById('messageInput').value;
    if(!text) return;
    push(ref(db, 'chats/' + currentChatId), {
        sender: currentUser.phone,
        text: text,
        timestamp: formatTime()
    });
    document.getElementById('messageInput').value = "";
    set(ref(db, `typing/${currentChatId}/${currentUser.phone}`), false);
};

// টাইপিং ইভেন্ট
document.getElementById('messageInput').oninput = () => {
    if(currentChatId) {
        set(ref(db, `typing/${currentChatId}/${currentUser.phone}`), true);
        clearTimeout(window.tTimer);
        window.tTimer = setTimeout(() => set(ref(db, `typing/${currentChatId}/${currentUser.phone}`), false), 2000);
    }
};

// সেটিংস ও লগআউট
document.getElementById('logoutBtn').onclick = () => {
    set(ref(db, 'users/' + currentUser.phone + '/status'), "offline");
    localStorage.removeItem("messenger_user");
    location.reload();
};

document.getElementById('updateBtn').onclick = async () => {
    const newName = document.getElementById('newName').value;
    const newPic = document.getElementById('newPic').value;
    if(newName) currentUser.username = newName;
    if(newPic) currentUser.profilePic = newPic;
    await set(ref(db, 'users/' + currentUser.phone), currentUser);
    localStorage.setItem("messenger_user", JSON.stringify(currentUser));
    alert("Profile Updated!");
    location.reload();
};

document.getElementById('deleteBtn').onclick = async () => {
    if(confirm("Delete account permanently?")) {
        await remove(ref(db, 'users/' + currentUser.phone));
        localStorage.removeItem("messenger_user");
        location.reload();
    }
};
