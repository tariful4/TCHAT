import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, query, where, orderBy, onSnapshot, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { getDatabase, ref as rRef, push, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ==========================================
// FIREBASE CONFIGURATIONS
// ==========================================
const firebaseConfigA = {
    apiKey: "AIzaSyBdq-mJ3S88htBOLPtHEry4XsVpywZ696s",
    authDomain: "tchat-2bd05.firebaseapp.com",
    projectId: "tchat-2bd05",
    storageBucket: "tchat-2bd05.firebasestorage.app",
    messagingSenderId: "666079222900",
    appId: "1:666079222900:web:390d3892488a3bb6dac521"
};

const firebaseConfigB = {
    apiKey: "AIzaSyCd8I9wgA6wRiLIK811anaHbGjm9SQVHro",
    authDomain: "tchat-ebe69.firebaseapp.com",
    projectId: "tchat-ebe69",
    storageBucket: "tchat-ebe69.firebasestorage.app",
    messagingSenderId: "311814351008",
    appId: "1:311814351008:web:4293c759ac3f0f24a5c1c5"
};

const firebaseConfigC = {
    apiKey: "AIzaSyAT22X04lwGjaneGGW9sKzeO6hWVAA3n6g",
    authDomain: "tchat-a9707.firebaseapp.com",
    databaseURL: "https://tchat-a9707-default-rtdb.firebaseio.com", 
    projectId: "tchat-a9707",
    messagingSenderId: "324756549796",
    appId: "1:324756549796:web:f557ebab16be9e5545f631"
};

// INITIALIZE APPS
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
    if (loader) {
        if (show) loader.classList.remove('hidden');
        else loader.classList.add('hidden');
    }
}

// ==========================================
// FIXED AUTH FUNCTIONS (DIRECT WINDOW BINDING)
// ==========================================
window.loginUser = async function() {
    const ep = document.getElementById('loginEmailPhone').value.trim();
    const ps = document.getElementById('loginPass').value.trim();
    
    if(!ep || !ps) { 
        alert("Please fill all fields"); 
        return; 
    }
    toggleLoader(true);
    
    try {
        const usersRef = collection(dbA, "users");
        const q = query(usersRef, where("emailPhone", "==", ep), where("password", "==", ps));
        const qSnap = await getDocs(q);
        
        if(!qSnap.empty) {
            const userData = qSnap.docs[0].data();
            localStorage.setItem('user', JSON.stringify(userData)); 
            window.location.reload(); 
        } else { 
            toggleLoader(false); 
            alert("Wrong Email/Phone or Password!"); 
        }
    } catch (error) {
        toggleLoader(false);
        console.error("Login Error Details: ", error);
        alert("Login system failed. Please check internet or Firebase rules.");
    }
}

window.registerUser = async function() {
    const ep = document.getElementById('regEmailPhone').value.trim();
    const ps = document.getElementById('regPass').value.trim();
    
    if(!ep || !ps) { 
        alert("Please fill all fields"); 
        return; 
    }
    toggleLoader(true);
    
    try {
        const usersRef = collection(dbA, "users");
        const q = query(usersRef, where("emailPhone", "==", ep));
        const qSnap = await getDocs(q);
        
        if(!qSnap.empty) { 
            toggleLoader(false); 
            alert("This Email or Phone is already registered!"); 
            return; 
        }
        
        const id = 'user_' + Date.now();
        const user = { 
            id: id, 
            emailPhone: ep, 
            username: ep.split('@')[0], 
            password: ps, 
            profilePic: defaultPic 
        };
        
        await setDoc(doc(dbA, "users", id), user);
        localStorage.setItem('user', JSON.stringify(user));
        window.location.reload();
    } catch (error) {
        toggleLoader(false);
        console.error("Registration Error Details: ", error);
        alert("Registration failed. Make sure Firestore rules are set to public.");
    }
}

window.toggleAuth = function(reg) {
    document.getElementById('login-form').style.display = reg ? 'none' : 'block';
    document.getElementById('reg-form').style.display = reg ? 'block' : 'none';
}

window.logout = function() { 
    localStorage.clear(); 
    window.location.reload(); 
}

// ==========================================
// OTHER APP FEATURES (WINDOW BOUND)
// ==========================================
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

window.visitProfile = async (uid) => {
    toggleLoader(true);
    if(currentProfileListener) { currentProfileListener(); currentProfileListener = null; } 
    if(currentVisitorsListener) { currentVisitorsListener(); currentVisitorsListener = null; }

    const dSnap = await getDoc(doc(dbA, "users", uid)); if(!dSnap.exists()) { toggleLoader(false); return; }
    const userData = dSnap.data();
    
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

window.openInbox = (user) => {
    toggleLoader(true); activeChatPartner = user;
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

window.uploadPhoto = (event) => {
    const file = event.target.files[0]; if (!file) return; toggleLoader(true);
    const sRefProf = sRef(storageA, `profiles/${currentUser.id}_avatar`);
    uploadBytes(sRefProf, file).then(async () => {
        const downloadURL = await getDownloadURL(sRefProf);
        await updateDoc(doc(dbA, "users", currentUser.id), { profilePic: downloadURL });
        currentUser.profilePic = downloadURL; localStorage.setItem('user', JSON.stringify(currentUser)); window.location.reload();
    });
};

window.changeName = async () => {
    const newName = prompt("Enter new name:", currentUser.username);
    if (newName && newName.trim() !== "") {
        toggleLoader(true);
        await updateDoc(doc(dbA, "users", currentUser.id), { username: newName.trim() });
        currentUser.username = newName.trim(); localStorage.setItem('user', JSON.stringify(currentUser)); window.location.reload();
    }
};

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

// ==========================================
// KICKSTART & EXPLICIT EVENT BINDING
// ==========================================
function initApp() {
    // বাইন্ডিং সরাসরি ফাংশনের সাথে ম্যাপ করা হলো
    document.getElementById("loginBtn")?.addEventListener("click", () => window.loginUser());
    document.getElementById("registerBtn")?.addEventListener("click", () => window.registerUser());
    document.getElementById("switchToRegister")?.addEventListener("click", () => window.toggleAuth(true));
    document.getElementById("switchToLogin")?.addEventListener("click", () => window.toggleAuth(false));
    
    document.getElementById("logoutBtn")?.addEventListener("click", () => window.logout());
    document.getElementById("feedTabBtn")?.addEventListener("click", () => window.showNewsfeed());
    document.getElementById("myPic")?.addEventListener("click", () => window.visitProfile(currentUser.id));
    document.getElementById("postMyPic")?.addEventListener("click", () => window.visitProfile(currentUser.id));
    document.getElementById("backToFeedBtn")?.addEventListener("click", () => window.showNewsfeed());
    
    document.getElementById("chat-toggle-btn")?.addEventListener("click", () => { document.getElementById('users-page').classList.remove('hidden'); });
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
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('app-interface').style.display = 'flex';
        document.getElementById('myPic').src = currentUser.profilePic || defaultPic;
        document.getElementById('postMyPic').src = currentUser.profilePic || defaultPic;
        
        onSnapshot(query(collection(dbB, "posts"), orderBy("timestamp", "desc")), (snap) => {
            const feed = document.getElementById('feed-container'); feed.innerHTML = "";
            snap.forEach(docBox => {
                const p = docBox.data(); feed.innerHTML += window.generatePostHTML(p);
            });
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
                }
            });
        });
    } else {
        document.getElementById('auth-container').style.display = 'flex';
        document.getElementById('app-interface').style.display = 'none';
        toggleLoader(false);
    }
}

// ডোমে কোনো লেট না রেখে সরাসরি রান করানো
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}
