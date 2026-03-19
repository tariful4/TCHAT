import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, push, onValue, get, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = { /* আপনার কনফিগ এখানে দিন */ };
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let currentUser = null;
let currentChatId = null;

// পেজ টগল
document.getElementById('showReg').onclick = () => { document.getElementById('login-form').style.display='none'; document.getElementById('reg-form').style.display='block'; };
document.getElementById('showLogin').onclick = () => { document.getElementById('reg-form').style.display='none'; document.getElementById('login-form').style.display='block'; };

// রেজিস্ট্রেশন: Email/Phone & Password
document.getElementById('regBtn').onclick = async () => {
    const id = document.getElementById('regId').value;
    const pass = document.getElementById('regPass').value;
    if(!id || !pass) return alert("সব তথ্য দিন!");

    const dbId = id.replace(/[^a-zA-Z0-9]/g, "");
    const userRef = ref(db, 'users/' + dbId);
    const snap = await get(userRef);

    if(snap.exists()) return alert("অ্যাকাউন্ট আগে থেকেই আছে!");

    const userData = { id: dbId, username: id.split('@')[0], password: pass, profilePic: "https://cdn-icons-png.flaticon.com/512/149/149071.png" };
    await set(userRef, userData);
    alert("রেজিস্ট্রেশন সফল! এখন লগইন করুন।");
    location.reload();
};

// লগইন: Username & Password
document.getElementById('loginBtn').onclick = async () => {
    const user = document.getElementById('loginUser').value;
    const pass = document.getElementById('loginPass').value;

    const snap = await get(ref(db, 'users/'));
    let foundUser = null;
    snap.forEach(child => {
        const u = child.val();
        if(u.username === user && u.password === pass) foundUser = u;
    });

    if(foundUser) { currentUser = foundUser; startApp(); } 
    else alert("ভুল ইউজারনেম বা পাসওয়ার্ড!");
};

function startApp() {
    localStorage.setItem("chat_user", JSON.stringify(currentUser));
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('app-interface').style.display = 'block';
    document.getElementById('myPic').src = currentUser.profilePic;
    loadUsers();
}

// অটোমেটিক অন্য অ্যাকাউন্টগুলো লিস্টে দেখাবে
function loadUsers() {
    onValue(ref(db, 'users/'), (snap) => {
        const list = document.getElementById('users-list');
        list.innerHTML = "";
        snap.forEach(child => {
            const u = child.val();
            if(u.id !== currentUser.id) {
                list.innerHTML += `<div class="chat-item" onclick="openChat('${u.id}','${u.username}','${u.profilePic}')" style="display:flex; align-items:center; padding:15px; border-bottom:1px solid #eee; cursor:pointer; background:white;">
                    <img src="${u.profilePic}" style="width:55px; height:55px; border-radius:50%; margin-right:15px;">
                    <div style="flex:1;">
                        <b style="font-size:16px;">${u.username}</b>
                        <p style="font-size:13px; color:gray;">Active now</p>
                    </div>
                </div>`;
            }
        });
    });
}

// প্রোফাইল এডিট ও লগআউট
document.getElementById('editProfileBtn').onclick = () => {
    document.getElementById('edit-modal').style.display = 'flex';
    document.getElementById('editName').value = currentUser.username;
    document.getElementById('editPic').value = currentUser.profilePic;
};

document.getElementById('saveProfileBtn').onclick = async () => {
    const newName = document.getElementById('editName').value;
    const newPic = document.getElementById('editPic').value;
    await update(ref(db, 'users/' + currentUser.id), { username: newName, profilePic: newPic });
    currentUser.username = newName; currentUser.profilePic = newPic;
    document.getElementById('myPic').src = newPic;
    document.getElementById('edit-modal').style.display = 'none';
};

document.getElementById('logoutBtn').onclick = () => { localStorage.clear(); location.reload(); };

// চ্যাট ওপেন এবং মেসেজিং
window.openChat = (id, name, pic) => {
    document.getElementById('chat-list-page').style.display = 'none';
    document.getElementById('inbox-page').style.display = 'block';
    document.getElementById('pName').innerText = name;
    document.getElementById('pPic').src = pic;
    document.getElementById('notif-dot').style.display = 'none';
    currentChatId = [currentUser.id, id].sort().join("_");
    loadMessages();
};

function loadMessages() {
    onValue(ref(db, 'chats/' + currentChatId), (snap) => {
        const box = document.getElementById('chat-box');
        box.innerHTML = "";
        snap.forEach(m => {
            const d = m.val();
            box.innerHTML += `<div class="msg ${d.s === currentUser.id ? 'sent' : 'received'}">${d.t}</div>`;
            if(d.s !== currentUser.id && document.getElementById('inbox-page').style.display === 'none') {
                document.getElementById('notif-dot').style.display = 'block'; // রেড ডট নোটিফিকেশন
            }
        });
        box.scrollTop = box.scrollHeight;
    });
}

document.getElementById('sendBtn').onclick = () => {
    const t = document.getElementById('messageInput').value;
    if(!t) return;
    push(ref(db, 'chats/' + currentChatId), { s: currentUser.id, t });
    document.getElementById('messageInput').value = "";
};

document.getElementById('backBtn').onclick = () => {
    document.getElementById('inbox-page').style.display = 'none';
    document.getElementById('chat-list-page').style.display = 'block';
};

// অটো লগইন চেক
const saved = localStorage.getItem("chat_user");
if(saved) { currentUser = JSON.parse(saved); startApp(); }
