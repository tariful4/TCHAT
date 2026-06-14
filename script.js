const APP_VERSION = "1.0.5"; 
const savedVersion = localStorage.getItem('app_version');
if (savedVersion !== APP_VERSION) {
    localStorage.setItem('app_version', APP_VERSION);
    window.location.reload(true); 
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, updateDoc, deleteDoc, query, where, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { getDatabase, ref as rRef, push, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ==========================================
// EMPTY PROMPT DATABASE CONFIGURATIONS
// ==========================================

// --- Database A (Firestore - Auth & Profiles) ---
// Note: databaseURL is not required for Firestore.
const firebaseConfigA = {
    apiKey: "AIzaSyBdq-mJ3S88htBOLPtHEry4XsVpywZ696s",
    authDomain: "tchat-2bd05.firebaseapp.com",
    projectId: "tchat-2bd05",
    storageBucket: "tchat-2bd05.firebasestorage.app",
    messagingSenderId: "666079222900",
    appId: "1:666079222900:web:390d3892488a3bb6dac521"
};

// --- Database B (Firestore - Post, Like, Comment, Profile Visits) ---
// Note: databaseURL is not required for Firestore.
const firebaseConfigB = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
};

// --- Database C (Realtime Database - Messages) ---
// Note: databaseURL is mandatory for Realtime Database.
const firebaseConfigC = {
    apiKey: "",
    authDomain: "",
    databaseURL: "", 
    projectId: "",
    messagingSenderId: "",
    appId: ""
};

// ==========================================
// SYSTEM INITIALIZATION
// ==========================================
const appA = initializeApp(firebaseConfigA, "appA");
const appB = initializeApp(firebaseConfigB, "appB");
const appC = initializeApp(firebaseConfigC, "appC");

const dbA = getFirestore(appA);
const storageA = getStorage(appA); 

const dbB = getFirestore(appB);
const storageB = getStorage(appB); 

const rtdbC = getDatabase(appC);

let currentUser = JSON.parse(localStorage.getItem('user')) || null;
let currentChatId = null;
let activeChatPartner = null; 
let currentProfileListener = null; 
let currentVisitorsListener = null; 
let selectedPostMediaFile = null; 
let selectedPostMediaType = null; 

const defaultPic = "https://cdn-icons-png.flaticon.com/512/149/149071.png";

function toggleLoader(show) {
    const loader = document.getElementById('loader-overlay');
    if (show) loader.classList.remove('hidden');
    else loader.classList.add('hidden');
}

function requestNotificationPermission() {
    try {
        if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission();
        }
    } catch (e) { console.log("Notification error", e); }
}

function triggerPushNotification(title, body, iconUrl, clickCallback) {
    try {
        if ("Notification" in window && Notification.permission === "granted") {
            const options = { body: body || "", icon: iconUrl || defaultPic, vibrate: [200, 100, 200] };
            const notification = new Notification(title, options);
            if (clickCallback) {
                notification.onclick = function(e) {
                    e.preventDefault(); window.focus(); clickCallback(); notification.close();
                };
            }
        }
    } catch (e) { console.log("Notification fail", e); }
}

let lastPostTimestamp = Date.now();
let globalChatListeners = {};

function updateThemeButton(theme) {
    const btn = document.getElementById('theme-toggle-btn');
    if(!btn) return;
    btn.innerHTML = theme === 'light' ? `<i class="fas fa-sun"></i> <span>Light Mode</span>` : `<i class="fas fa-moon"></i> <span>Dark Mode</span>`;
}

window.toggleTheme = () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const targetTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', targetTheme);
    localStorage.setItem('theme', targetTheme);
    updateThemeButton(targetTheme);
};
document.documentElement.setAttribute('data-theme', localStorage.getItem('theme') || 'dark');

window.addEventListener('popstate', () => {
    const inbox = document.getElementById('inbox-page');
    const users = document.getElementById('users-page');
    const profile = document.getElementById('profile-page');
    
    if (!inbox.classList.contains('hidden')) { inbox.classList.add('hidden'); activeChatPartner = null; } 
    else if (!users.classList.contains('hidden')) { users.classList.add('hidden'); }
    else if (!profile.classList.contains('hidden')) { window.showNewsfeed(); }
});
function pushState() { if (window.history.state !== "app") history.pushState("app", ""); }

// --- Auth System ---
window.toggleAuth = (reg) => {
    document.getElementById('login-form').style.display = reg ? 'none' : 'block';
    document.getElementById('reg-form').style.display = reg ? 'block' : 'none';
}

window.login = async () => {
    const ep = document.getElementById('loginEmailPhone').value.trim();
    const ps = document.getElementById('loginPass').value.trim();
    if(!ep || !ps) return;
    toggleLoader(true);
    
    const qSnap = await getDocs(query(collection(dbA, "users"), where("emailPhone", "==", ep), where("password", "==", ps)));
    if(!qSnap.empty) {
        localStorage.setItem('user', JSON.stringify(qSnap.docs[0].data())); 
        location.reload(); 
    } else { toggleLoader(false); alert("Invalid credentials!"); }
}

window.register = async () => {
    const ep = document.getElementById('regEmailPhone').value.trim();
    const ps = document.getElementById('regPass').value.trim();
    if(!ep || !ps) return;
    toggleLoader(true);
    
    const qSnap = await getDocs(query(collection(dbA, "users"), where("emailPhone", "==", ep)));
    if(!qSnap.empty) { toggleLoader(false); alert("Account already exists!"); return; }
    
    const id = 'user_' + Date.now();
    const user = { id, emailPhone: ep, username: ep.split('@')[0], password: ps, profilePic: defaultPic };
    await setDoc(doc(dbA, "users", id), user);
    localStorage.setItem('user', JSON.stringify(user));
    location.reload();
}

window.logout = () => { localStorage.clear(); location.reload(); }

// --- Media Processing ---
window.handlePostMediaSelect = (event) => {
    const file = event.target.files[0]; if (!file) return;
    selectedPostMediaFile = file;
    selectedPostMediaType = file.type.startsWith('video/') ? 'video' : 'image';
    
    const container = document.getElementById('mediaPreviewContainer');
    const oldMedia = container.querySelector('img, video'); if (oldMedia) oldMedia.remove();

    const mediaEl = document.createElement(selectedPostMediaType === 'image' ? 'img' : 'video');
    mediaEl.src = URL.createObjectURL(file);
    if(selectedPostMediaType === 'video') mediaEl.controls = true;
    container.appendChild(mediaEl); container.style.display = 'block';
};

window.clearSelectedMedia = () => {
    selectedPostMediaFile = null; selectedPostMediaType = null;
    document.getElementById('postMediaInput').value = "";
    const container = document.getElementById('mediaPreviewContainer');
    container.style.display = 'none';
    const oldMedia = container.querySelector('img, video'); if (oldMedia) oldMedia.remove();
};

// --- Profiler & Visit System ---
window.visitProfile = async (uid) => {
    toggleLoader(true);
    if(currentProfileListener) { currentProfileListener(); currentProfileListener = null; } 
    if(currentVisitorsListener) { currentVisitorsListener(); currentVisitorsListener = null; }

    const dSnap = await getDoc(doc(dbA, "users", uid)); if(!dSnap.exists()) { toggleLoader(false); return; }
    const userData = dSnap.data(); pushState();
    
    document.getElementById('newsfeed-page').classList.add('hidden');
    document.getElementById('users-page').classList.add('hidden');
    document.getElementById('inbox-page').classList.add('hidden');
    document.getElementById('profile-page').classList.remove('hidden');
    
    document.getElementById('profPic').src = userData.profilePic || defaultPic;
    document.getElementById('profName').innerText = userData.username;
    
    const isMe = uid === currentUser.id;
    document.getElementById('cam-label').style.display = isMe ? 'flex' : 'none';
    document.getElementById('edit-name-icon').style.display = isMe ? 'block' : 'none';

    const msgBtn = document.getElementById('msg-btn-prof');
    const themeBtn = document.getElementById('theme-toggle-btn');
    const visitorsDashboard = document.getElementById('profile-visitors-dashboard');
    
    if(!isMe) {
        msgBtn.style.display = 'block'; msgBtn.onclick = () => window.openInbox(userData);
        themeBtn.style.display = 'none'; visitorsDashboard.classList.add('hidden');
        
        await setDoc(doc(dbB, `profile_visitors/${uid}/visitors`, currentUser.id), {
            uid: currentUser.id, name: currentUser.username, pic: currentUser.profilePic || defaultPic, timestamp: Date.now()
        });
    } else {
        msgBtn.style.display = 'none'; themeBtn.style.display = 'inline-flex';
        updateThemeButton(localStorage.getItem('theme') || 'dark');
        visitorsDashboard.classList.remove('hidden');
        
        currentVisitorsListener = onSnapshot(query(collection(dbB, `profile_visitors/${currentUser.id}/visitors`), orderBy("timestamp", "desc")), (vSnap) => {
            const listContainer = document.getElementById('visitors-list-container'); listContainer.innerHTML = "";
            if (vSnap.empty) listContainer.innerHTML = `<p style="font-size:12px; opacity:0.5; padding:10px;">No visitors yet.</p>`;
            else {
                vSnap.forEach(docBox => {
                    const v = docBox.data();
                    listContainer.innerHTML += `
                        <div class="visitor-item">
                            <img src="${v.pic || defaultPic}" class="visitor-img">
                            <div class="visitor-info">
                                <span class="visitor-name">${v.name}</span>
                                <div class="visitor-time">${new Date(v.timestamp).toLocaleString()}</div>
                            </div>
                        </div>`;
                });
            }
        });
    }

    currentProfileListener = onSnapshot(query(collection(dbB, "posts"), where("uid", "==", uid)), (pSnap) => {
        const userFeed = document.getElementById('user-posts-container'); userFeed.innerHTML = "";
        let posts = []; pSnap.forEach(d => posts.push({id: d.id, ...d.data()}));
        posts.sort((a,b)=> b.timestamp - a.timestamp).forEach(p => { userFeed.innerHTML += window.generatePostHTML(p); });
        toggleLoader(false);
    });
}

window.showNewsfeed = () => {
    if(currentProfileListener) { currentProfileListener(); currentProfileListener = null; }
    if(currentVisitorsListener) { currentVisitorsListener(); currentVisitorsListener = null; }
    document.getElementById('profile-page').classList.add('hidden');
    document.getElementById('newsfeed-page').classList.remove('hidden');
}

window.generatePostHTML = function(p) {
    const likeCount = p.likes ? Object.keys(p.likes).length : 0;
    const cmtCount = p.commentsCount || 0;
    const isLiked = p.likes && p.likes[currentUser.id];
    let mediaMarkup = p.media ? (p.mediaType === 'video' ? `<div class="post-media-container"><video src="${p.media}" controls preload="metadata"></video></div>` : `<div class="post-media-container"><img src="${p.media}"></div>`) : "";

    return `<div class="post-card"><div class="post-header"><img src="${p.pic || defaultPic}" class="post-avatar" onclick="visitProfile('${p.uid}')"><div><div class="post-user" onclick="visitProfile('${p.uid}')">${p.name}</div><div class="post-time">${new Date(p.timestamp).toLocaleString()}</div></div>${p.uid === currentUser.id ? `<i class="fas fa-trash-alt del-btn" onclick="deletePost('${p.id}')"></i>` : ''}</div><div class="post-content">${p.text || ""}</div>${mediaMarkup}<div class="post-stats"><span><i class="fas fa-thumbs-up"></i> ${likeCount}</span><span style="cursor:pointer;" onclick="showComments('${p.id}')">${cmtCount} Comments</span></div><div class="post-actions"><span class="${isLiked?'liked':''}" onclick="toggleLike('${p.id}', ${isLiked?true:false})"><i class="fas fa-thumbs-up"></i> Like</span><span onclick="showComments('${p.id}')"><i class="fas fa-comment"></i> Comment</span></div><div class="comment-section" id="comments-${p.id}"><div id="comment-list-${p.id}"></div><div class="comment-input-row"><input type="text" id="cmt-inp-${p.id}" placeholder="Write a comment..."><i class="fas fa-paper-plane" onclick="addComment('${p.id}')" style="color:#8c442c; margin-top:5px; cursor:pointer;"></i></div></div></div>`;
}

// --- Feed Feedbacks ---
window.createPost = async () => {
    const txt = document.getElementById('postText').value.trim(); if(!txt && !selectedPostMediaFile) return; toggleLoader(true);
    const pId = 'post_' + Date.now();
    const postObj = { id: pId, uid: currentUser.id, name: currentUser.username, pic: currentUser.profilePic || defaultPic, text: txt, timestamp: Date.now(), commentsCount: 0, likes: {} };

    if (selectedPostMediaFile) {
        const sRefMedia = sRef(storageB, `posts/${pId}_${selectedPostMediaFile.name}`);
        await uploadBytes(sRefMedia, selectedPostMediaFile);
        postObj.media = await getDownloadURL(sRefMedia); postObj.mediaType = selectedPostMediaType;
    }
    await setDoc(doc(dbB, "posts", pId), postObj);
    document.getElementById('postText').value = ""; window.clearSelectedMedia(); toggleLoader(false);
}

window.toggleLike = async (pid, state) => {
    const updates = {}; updates[`likes.${currentUser.id}`] = state ? null : true;
    await updateDoc(doc(dbB, "posts", pid), updates);
}

window.addComment = async (pid) => {
    const inp = document.getElementById(`cmt-inp-${pid}`); const txt = inp.value.trim(); if(!txt) return;
    const cId = 'cmt_' + Date.now();
    await setDoc(doc(dbB, `posts/${pid}/comments`, cId), { id: cId, uid: currentUser.id, name: currentUser.username, text: txt, timestamp: Date.now() });
    
    const dSnap = await getDoc(doc(dbB, "posts", pid));
    await updateDoc(doc(dbB, "posts", pid), { commentsCount: (dSnap.data().commentsCount || 0) + 1 }); inp.value = "";
}

window.showComments = async (pid) => {
    const el = document.getElementById(`comments-${pid}`); if(el.style.display === 'block') { el.style.display = 'none'; return; } el.style.display = 'block';
    onSnapshot(query(collection(dbB, `posts/${pid}/comments`), orderBy("timestamp", "asc")), (cSnap) => {
        const list = document.getElementById(`comment-list-${pid}`); list.innerHTML = "";
        cSnap.forEach(docBox => {
            const c = docBox.data();
            list.innerHTML += `<div class="comment-item"><span class="comment-user">${c.name}:</span> ${c.text}${c.uid === currentUser.id ? `<div class="cmt-actions"><i class="fas fa-trash" onclick="deleteComment('${pid}', '${c.id}')"></i></div>` : ''}</div>`;
        });
    });
}

window.deletePost = (pid) => { if(confirm("Delete post?")) deleteDoc(doc(dbB, "posts", pid)); }
window.deleteComment = async (pid, cid) => {
    if(confirm("Delete comment?")) {
        await deleteDoc(doc(dbB, `posts/${pid}/comments`, cid));
        const dSnap = await getDoc(doc(dbB, "posts", pid));
        await updateDoc(doc(dbB, "posts", pid), { commentsCount: Math.max(0, (dSnap.data().commentsCount || 0) - 1) });
    }
}

// --- Messages Setup ---
window.openInbox = (user) => {
    toggleLoader(true); activeChatPartner = user; pushState();
    document.getElementById('users-page').classList.remove('hidden');
    document.getElementById('profile-page').classList.add('hidden');
    document.getElementById('inbox-page').classList.remove('hidden');
    document.getElementById('pName').innerText = user.username;
    document.getElementById('pPic').src = user.profilePic || defaultPic;
    
    const ids = [currentUser.id, user.id].sort(); currentChatId = ids[0] + '_' + ids[1];
    
    onValue(rRef(rtdbC, 'chats/'+currentChatId), (snap) => {
        const box = document.getElementById('chat-box'); box.innerHTML = "";
        snap.forEach(c => {
            const m = c.val(); const isSent = m.sender === currentUser.id;
            box.innerHTML += `<div class="message-wrapper ${isSent?'sent':'received'}"><div class="message-bubble ${isSent?'sent':'received'}">${m.text}</div></div>`;
        });
        box.scrollTop = box.scrollHeight; toggleLoader(false);
    });
}

window.sendMessage = async () => {
    const input = document.getElementById('messageInput'); if(!input.value.trim()) return;
    await push(rRef(rtdbC, 'chats/'+currentChatId), { sender: currentUser.id, text: input.value, timestamp: Date.now() });
    input.value = "";
}

// --- Dynamic Settings ---
window.uploadPhoto = (event) => {
    const file = event.target.files[0]; if (!file) return; toggleLoader(true);
    const sRefProf = sRef(storageA, `profiles/${currentUser.id}_avatar`);
    uploadBytes(sRefProf, file).then(async () => {
        const downloadURL = await getDownloadURL(sRefProf);
        await updateDoc(doc(dbA, "users", currentUser.id), { profilePic: downloadURL });
        currentUser.profilePic = downloadURL; localStorage.setItem('user', JSON.stringify(currentUser)); location.reload();
    });
};

window.changeName = async () => {
    const newName = prompt("Enter new name:", currentUser.username);
    if (newName && newName.trim() !== "") {
        toggleLoader(true);
        await updateDoc(doc(dbA, "users", currentUser.id), { username: newName.trim() });
        currentUser.username = newName.trim(); localStorage.setItem('user', JSON.stringify(currentUser)); location.reload();
    }
};

// --- Initialization & Binding ---
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("loginBtn")?.addEventListener("click", () => window.login());
    document.getElementById("registerBtn")?.addEventListener("click", () => window.register());
    document.getElementById("switchToRegister")?.addEventListener("click", () => window.toggleAuth(true));
    document.getElementById("switchToLogin")?.addEventListener("click", () => window.toggleAuth(false));
    
    document.getElementById("logoutBtn")?.addEventListener("click", () => window.logout());
    document.getElementById("feedTabBtn")?.addEventListener("click", () => window.showNewsfeed());
    document.getElementById("myPic")?.addEventListener("click", () => window.visitProfile(currentUser.id));
    document.getElementById("postMyPic")?.addEventListener("click", () => window.visitProfile(currentUser.id));
    document.getElementById("backToFeedBtn")?.addEventListener("click", () => window.showNewsfeed());
    
    document.getElementById("chat-toggle-btn")?.addEventListener("click", () => { pushState(); document.getElementById('users-page').classList.remove('hidden'); });
    document.getElementById("closeChatListBtn")?.addEventListener("click", () => document.getElementById('users-page').classList.add('hidden'));
    document.getElementById("closeInboxBtn")?.addEventListener("click", () => { document.getElementById('inbox-page').classList.add('hidden'); activeChatPartner = null; });
    document.getElementById("sendMessageBtn")?.addEventListener("click", () => window.sendMessage());
    document.getElementById("messageInput")?.addEventListener("keydown", (e) => { if(e.key === 'Enter') window.sendMessage(); });
    
    document.getElementById("postMediaInput")?.addEventListener("change", (e) => window.handlePostMediaSelect(e));
    document.getElementById("clearMediaBtn")?.addEventListener("click", () => window.clearSelectedMedia());
    document.getElementById("submitPostBtn")?.addEventListener("click", () => window.createPost());
    
    document.getElementById("fileInput")?.addEventListener("change", (e) => window.uploadPhoto(e));
    document.getElementById("edit-name-icon")?.addEventListener("click", () => window.changeName());
    document.getElementById("theme-toggle-btn")?.addEventListener("click", () => window.toggleTheme());
    document.getElementById("pPic")?.addEventListener("click", () => { if(activeChatPartner) window.visitProfile(activeChatPartner.id); });
    document.getElementById("pName")?.addEventListener("click", () => { if(activeChatPartner) window.visitProfile(activeChatPartner.id); });

    if(currentUser) {
        toggleLoader(true); requestNotificationPermission();
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('app-interface').style.display = 'flex';
        document.getElementById('myPic').src = currentUser.profilePic || defaultPic;
        document.getElementById('postMyPic').src = currentUser.profilePic || defaultPic;
        
        onSnapshot(query(collection(dbB, "posts"), orderBy("timestamp", "desc")), (snap) => {
            const feed = document.getElementById('feed-container'); feed.innerHTML = "";
            let updatesNotified = false;
            snap.forEach(docBox => {
                const p = docBox.data(); feed.innerHTML += window.generatePostHTML(p);
                if (!updatesNotified && p.uid !== currentUser.id && p.timestamp > lastPostTimestamp) {
                    triggerPushNotification(`New Post from ${p.name || "User"}`, p.text || "Attached Media", p.pic, () => window.showNewsfeed());
                    updatesNotified = true;
                }
            });
            if(!snap.empty) lastPostTimestamp = Date.now();
            toggleLoader(false);
        });

        onSnapshot(collection(dbA, "users"), (snap) => {
            const list = document.getElementById('users-list'); list.innerHTML = "";
            snap.forEach(docBox => {
                const u = docBox.data();
                if(u.id !== currentUser.id) {
                    const div = document.createElement('div'); div.className = 'chat-item';
                    div.innerHTML = `<img src="${u.profilePic || defaultPic}"><div><h4>${u.username}</h4><small>Tap to chat</small></div>`;
                    div.onclick = () => window.openInbox(u); list.appendChild(div);

                    const ids = [currentUser.id, u.id].sort(); const chatRoomId = ids[0] + '_' + ids[1];
                    if (!globalChatListeners[chatRoomId]) {
                        let lastMsgTime = Date.now();
                        globalChatListeners[chatRoomId] = onValue(rRef(rtdbC, 'chats/' + chatRoomId), (chatSnap) => {
                            chatSnap.forEach(msgNode => {
                                const m = msgNode.val();
                                if (m.sender === u.id && m.timestamp > lastMsgTime) {
                                    if (activeChatPartner === null || activeChatPartner.id !== u.id) {
                                        triggerPushNotification(`New Message from ${u.username}`, m.text || "", u.profilePic, () => window.openInbox(u));
                                    }
                                }
                                if(m.timestamp > lastMsgTime) lastMsgTime = m.timestamp;
                            });
                        });
                    }
                }
            });
        });
    }
});
