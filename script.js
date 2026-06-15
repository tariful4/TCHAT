import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { initializeFirestore, getFirestore, doc, setDoc, getDoc, getDocs, collection, query, orderBy, limit, startAfter, onSnapshot, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const APP_VERSION = "2.0.3"; 
const savedVersion = localStorage.getItem('app_version');
if (savedVersion !== APP_VERSION) {
    localStorage.setItem('app_version', APP_VERSION);
    window.location.reload(true); 
}

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

const dbAuth = getFirestore(appAuth); 
const dbApp = getFirestore(appApp);   
const dbChat = getDatabase(appChat);  

let currentUser = JSON.parse(localStorage.getItem('user')) || null;
let currentChatId = null;
let activeChatPartner = null; 
let currentProfileListener = null; 
let currentVisitorsListener = null; 
let selectedPostMediaRaw = null; 
let selectedPostMediaType = null; 

let lastVisiblePost = null;
let isFetchingPosts = false;
const POSTS_LIMIT = 15;

const defaultPic = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
let globalChatListeners = {};

// Loader Toggle
function toggleLoader(show) {
    const loader = document.getElementById('loader-overlay');
    if (loader) {
        if (show) loader.classList.remove('hidden');
        else loader.classList.add('hidden');
    }
}

// Global HTML Feed Generator with Lazy Loading Image
function generatePostHTML(p) {
    const likeCount = (p.likes && typeof p.likes === 'object') ? Object.keys(p.likes).length : 0;
    const cmtCount = (p.comments && typeof p.comments === 'object') ? Object.keys(p.comments).length : 0;
    const isLiked = p.likes && p.likes[currentUser.id];
    let cmtHtml = "";
    if(p.comments) {
        Object.keys(p.comments).forEach(cid => {
            const c = p.comments[cid];
            cmtHtml += `<div class="comment-item"><span class="comment-user" data-uid="${c.uid}">${c.name}:</span> ${c.text}${c.uid === currentUser.id ? `<div class="cmt-actions"><i class="fas fa-trash" data-pid="${p.id}" data-cid="${cid}"></i></div>` : ''}</div>`;
        });
    }
    let mediaMarkup = p.media ? (p.mediaType === 'video' ? `<div class="post-media-container"><video src="${p.media}" controls preload="metadata"></video></div>` : `<div class="post-media-container"><img src="${p.media}" loading="lazy"></div>`) : "";

    return `<div class="post-card" id="post-card-${p.id}"><div class="post-header"><img src="${p.pic || defaultPic}" class="post-avatar profile-click" data-uid="${p.uid}"><div><div class="post-user profile-click" data-uid="${p.uid}">${p.name}</div><div class="post-time">${new Date(p.timestamp).toLocaleString()}</div></div>${p.uid === currentUser.id ? `<i class="fas fa-trash-alt del-btn post-delete" data-pid="${p.id}"></i>` : ''}</div><div class="post-content">${p.text || ""}</div>${mediaMarkup}<div class="post-stats"><span><i class="fas fa-thumbs-up"></i> <span id="like-count-${p.id}">${likeCount}</span></span><span><span id="cmt-count-${p.id}">${cmtCount}</span> Comments</span></div><div class="post-actions"><span id="like-btn-${p.id}" class="like-toggle-action ${isLiked?'liked':''}" data-pid="${p.id}"><i class="fas fa-thumbs-up"></i> Like</span><span class="comment-toggle-action" data-pid="${p.id}"><i class="fas fa-comment"></i> Comment</span></div><div class="comment-section" id="comments-${p.id}"><div id="comment-list-${p.id}">${cmtHtml}</div><div class="comment-input-row"><input type="text" id="cmt-inp-${p.id}" placeholder="Write a comment..."><i class="fas fa-paper-plane comment-submit" data-pid="${p.id}" style="color:#8c442c; margin-top:5px; cursor:pointer;"></i></div></div></div>`;
}

// Compress Image Logic
function compressImage(base64Str, maxWidth = 600, maxHeight = 600) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            if (width > height) {
                if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
            } else {
                if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.6)); 
        };
    });
}

// Navigation & Auth Flow Actions
const toggleAuth = (showReg) => {
    if(showReg) {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('reg-form').style.display = 'block';
    } else {
        document.getElementById('login-form').style.display = 'block';
        document.getElementById('reg-form').style.display = 'none';
    }
}

const login = async () => {
    const ep = document.getElementById('loginEmailPhone').value.trim();
    const ps = document.getElementById('loginPass').value.trim();
    if(!ep || !ps) return;
    toggleLoader(true);
    try {
        const querySnapshot = await getDocs(collection(dbAuth, "users"));
        let found = null;
        querySnapshot.forEach((doc) => {
            if(doc.data().emailPhone === ep && doc.data().password === ps) found = doc.data();
        });
        if(found) { localStorage.setItem('user', JSON.stringify(found)); location.reload(); }
        else { toggleLoader(false); alert("Invalid login!"); }
    } catch(e) { toggleLoader(false); alert("Error logging in: " + e.message); }
}

const register = async () => {
    const ep = document.getElementById('regEmailPhone').value.trim();
    const ps = document.getElementById('regPass').value.trim();
    if(!ep || !ps) { alert("Please enter both Email/Phone and Password!"); return; }
    toggleLoader(true);
    try {
        const querySnapshot = await getDocs(collection(dbAuth, "users"));
        let alreadyExists = false;
        querySnapshot.forEach((doc) => {
            if(doc.data().emailPhone === ep) alreadyExists = true;
        });
        if(alreadyExists) { toggleLoader(false); alert("This Email or Phone is already registered!"); return; }
        
        const id = 'user_' + Date.now();
        const user = { id, emailPhone: ep, username: ep.split('@')[0], password: ps, profilePic: defaultPic };
        await setDoc(doc(dbAuth, "users", id), user);
        localStorage.setItem('user', JSON.stringify(user));
        toggleLoader(false);
        location.reload();
    } catch(e) { toggleLoader(false); alert("Error registering: " + e.message); }
}

const logout = () => { localStorage.clear(); location.reload(); }

// Media Selector
const handlePostMediaSelect = (event) => {
    const file = event.target.files[0]; if (!file) return;
    if (file.size > 0.5 * 1024 * 1024) { alert("File size too large! Select under 500KB."); event.target.value = ""; return; }
    selectedPostMediaType = file.type.startsWith('video/') ? 'video' : 'image';
    const reader = new FileReader();
    reader.onload = async (e) => {
        let rawData = e.target.result;
        if(selectedPostMediaType === 'image') {
            rawData = await compressImage(rawData);
        }
        selectedPostMediaRaw = rawData;
        const container = document.getElementById('mediaPreviewContainer');
        const oldMedia = container.querySelector('img, video'); if (oldMedia) oldMedia.remove();
        const mediaEl = document.createElement(selectedPostMediaType === 'image' ? 'img' : 'video');
        mediaEl.src = selectedPostMediaRaw; if(selectedPostMediaType === 'video') mediaEl.controls = true;
        container.appendChild(mediaEl); container.style.display = 'block';
    };
    reader.readAsDataURL(file);
};

const clearSelectedMedia = () => {
    selectedPostMediaRaw = null; selectedPostMediaType = null;
    document.getElementById('postMediaInput').value = "";
    const container = document.getElementById('mediaPreviewContainer'); container.style.display = 'none';
    const oldMedia = container.querySelector('img, video'); if (oldMedia) oldMedia.remove();
};

// Profile Sync Dashboard
const visitProfile = async (uid) => {
    toggleLoader(true);
    if(currentProfileListener) { currentProfileListener(); currentProfileListener = null; } 
    if(currentVisitorsListener) { currentVisitorsListener(); currentVisitorsListener = null; }

    const snap = await getDoc(doc(dbAuth, "users", uid));
    if(!snap.exists()) { toggleLoader(false); return; }
    const userData = snap.data();
    
    document.getElementById('newsfeed-page').classList.add('hidden');
    document.getElementById('load-more-container').classList.add('hidden');
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
        msgBtn.style.display = 'block'; msgBtn.onclick = () => openInbox(userData);
        themeBtn.style.display = 'none'; visitorsDashboard.classList.add('hidden');
        
        await setDoc(doc(dbApp, `profile_visitors/${uid}/recent`, currentUser.id), {
            uid: currentUser.id, name: currentUser.username, pic: currentUser.profilePic || defaultPic, timestamp: Date.now()
        });
    } else {
        msgBtn.style.display = 'none'; themeBtn.style.display = 'inline-flex';
        updateThemeButton(localStorage.getItem('theme') || 'dark');
        visitorsDashboard.classList.remove('hidden');
        
        const visitorsQuery = query(collection(dbApp, `profile_visitors/${currentUser.id}/recent`), orderBy("timestamp", "desc"));
        currentVisitorsListener = onSnapshot(visitorsQuery, (vSnap) => {
            const listContainer = document.getElementById('visitors-list-container'); listContainer.innerHTML = "";
            let count = 0;
            vSnap.forEach(child => {
                const v = child.data(); count++;
                listContainer.innerHTML += `
                    <div class="visitor-item">
                        <img src="${v.pic || defaultPic}" class="visitor-img">
                        <div class="visitor-info">
                            <span class="visitor-name" data-uid="${v.uid}">${v.name}</span>
                            <div class="visitor-time">Visited: ${new Date(v.timestamp).toLocaleString()}</div>
                        </div>
                    </div>`;
            });
            if (count === 0) listContainer.innerHTML = `<p style="font-size:12px; opacity:0.5; padding:10px;">No recent visitors yet.</p>`;
        });
    }

    const userPostsQuery = query(collection(dbApp, "posts"), orderBy("timestamp", "desc"));
    currentProfileListener = onSnapshot(userPostsQuery, (snap) => {
        const userFeed = document.getElementById('user-posts-container'); userFeed.innerHTML = "";
        snap.forEach(c => { 
            const p = c.data(); p.id = c.id;
            if(p.uid === uid) userFeed.innerHTML += generatePostHTML(p);
        });
        toggleLoader(false);
    });
}

const showNewsfeed = () => {
    if(currentProfileListener) { currentProfileListener(); currentProfileListener = null; }
    if(currentVisitorsListener) { currentVisitorsListener(); currentVisitorsListener = null; }
    document.getElementById('profile-page').classList.add('hidden');
    document.getElementById('newsfeed-page').classList.remove('hidden');
    if(lastVisiblePost) {
        document.getElementById('load-more-container').classList.remove('hidden');
    }
}

// Optimized Actions
const createPost = async () => {
    const txt = document.getElementById('postText').value.trim();
    if(!txt && !selectedPostMediaRaw) return;
    toggleLoader(true);
    const pId = 'post_' + Date.now();
    const postObj = { id: pId, uid: currentUser.id, name: currentUser.username, pic: currentUser.profilePic || defaultPic, text: txt, timestamp: Date.now(), likes: {}, comments: {} };
    if (selectedPostMediaRaw) { postObj.media = selectedPostMediaRaw; postObj.mediaType = selectedPostMediaType; }
    
    await setDoc(doc(dbApp, "posts", pId), postObj);
    document.getElementById('postText').value = ""; clearSelectedMedia(); toggleLoader(false);
}

// Optimistic Update Implementation For Like System
const toggleLike = async (pid) => {
    const likeBtn = document.getElementById(`like-btn-${pid}`);
    const likeCountEl = document.getElementById(`like-count-${pid}`);
    if (!likeBtn || !likeCountEl) return;

    const isAlreadyLiked = likeBtn.classList.contains('liked');
    let currentCount = parseInt(likeCountEl.innerText);

    // Instant UI Sync
    if (isAlreadyLiked) {
        likeBtn.classList.remove('liked');
        likeCountEl.innerText = currentCount - 1;
    } else {
        likeBtn.classList.add('liked');
        likeCountEl.innerText = currentCount + 1;
    }

    // Network Sync in Background
    try {
        const postRef = doc(dbApp, "posts", pid); const snap = await getDoc(postRef);
        if(snap.exists()) {
            let likes = snap.data().likes || {};
            if(likes[currentUser.id]) delete likes[currentUser.id]; else likes[currentUser.id] = true;
            await updateDoc(postRef, { likes: likes });
        }
    } catch(err) {
        // Rollback UI State if sync fails
        if (isAlreadyLiked) { likeBtn.classList.add('liked'); likeCountEl.innerText = currentCount; }
        else { likeBtn.classList.remove('liked'); likeCountEl.innerText = currentCount; }
    }
}

const addComment = async (pid) => {
    const inp = document.getElementById(`cmt-inp-${pid}`); const txt = inp.value.trim(); if(!txt) return;
    const postRef = doc(dbApp, "posts", pid); const snap = await getDoc(postRef);
    if(snap.exists()) {
        let comments = snap.data().comments || {}; const cId = 'cmt_' + Date.now();
        comments[cId] = { cid: cId, uid: currentUser.id, name: currentUser.username, text: txt, timestamp: Date.now() };
        await updateDoc(postRef, { comments: comments }); inp.value = "";
    }
}

const fetchInitialPosts = async () => {
    toggleLoader(true);
    isFetchingPosts = true;
    const feedContainer = document.getElementById('feed-container');
    feedContainer.innerHTML = "";

    const qRef = query(collection(dbApp, "posts"), orderBy("timestamp", "desc"), limit(POSTS_LIMIT));
    onSnapshot(qRef, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            const p = change.doc.data(); p.id = change.doc.id;
            const existingCard = document.getElementById(`post-card-${p.id}`);
            if (change.type === "added" && !existingCard) {
                const wrapper = document.createElement('div');
                wrapper.innerHTML = generatePostHTML(p);
                feedContainer.insertBefore(wrapper.firstChild, feedContainer.firstChild);
            } else if (change.type === "modified" && existingCard) {
                const likeCount = p.likes ? Object.keys(p.likes).length : 0;
                const cmtCount = p.comments ? Object.keys(p.comments).length : 0;
                const isLiked = p.likes && p.likes[currentUser.id];
                
                document.getElementById(`like-count-${p.id}`).innerText = likeCount;
                document.getElementById(`cmt-count-${p.id}`).innerText = cmtCount;
                
                const btn = document.getElementById(`like-btn-${p.id}`);
                if(isLiked) btn.classList.add('liked'); else btn.classList.remove('liked');
                
                let cmtHtml = "";
                if(p.comments) {
                    Object.keys(p.comments).forEach(cid => {
                        const c = p.comments[cid];
                        cmtHtml += `<div class="comment-item"><span class="comment-user" data-uid="${c.uid}">${c.name}:</span> ${c.text}${c.uid === currentUser.id ? `<div class="cmt-actions"><i class="fas fa-trash" data-pid="${p.id}" data-cid="${cid}"></i></div>` : ''}</div>`;
                    });
                }
                document.getElementById(`comment-list-${p.id}`).innerHTML = cmtHtml;
            } else if (change.type === "removed" && existingCard) {
                existingCard.remove();
            }
        });

        if (snapshot.docs.length > 0 && !lastVisiblePost) {
            lastVisiblePost = snapshot.docs[snapshot.docs.length - 1];
            document.getElementById('load-more-container').classList.remove('hidden');
        }
        toggleLoader(false); isFetchingPosts = false;
    });
}

const loadMorePosts = async () => {
    if (!lastVisiblePost || isFetchingPosts) return;
    toggleLoader(true); isFetchingPosts = true;
    const nextQuery = query(collection(dbApp, "posts"), orderBy("timestamp", "desc"), startAfter(lastVisiblePost), limit(POSTS_LIMIT));
    const snapshot = await getDocs(nextQuery);
    const feedContainer = document.getElementById('feed-container');

    if (snapshot.docs.length > 0) {
        snapshot.docs.forEach(docSnap => {
            const p = docSnap.data(); p.id = docSnap.id;
            if(!document.getElementById(`post-card-${p.id}`)) {
                const wrapper = document.createElement('div');
                wrapper.innerHTML = generatePostHTML(p);
                feedContainer.appendChild(wrapper.firstChild);
            }
        });
        lastVisiblePost = snapshot.docs[snapshot.docs.length - 1];
        if(snapshot.docs.length < POSTS_LIMIT) document.getElementById('load-more-container').classList.add('hidden');
    } else {
        document.getElementById('load-more-container').classList.add('hidden');
    }
    toggleLoader(false); isFetchingPosts = false;
};

// Chat Engine Room
const openInbox = (user) => {
    toggleLoader(true); activeChatPartner = user;
    document.getElementById('users-page').classList.add('hidden');
    document.getElementById('profile-page').classList.add('hidden');
    document.getElementById('inbox-page').classList.remove('hidden');
    document.getElementById('pName').innerText = user.username;
    document.getElementById('pPic').src = user.profilePic || defaultPic;
    
    const ids = [currentUser.id, user.id].sort(); currentChatId = ids[0] + '_' + ids[1];
    onValue(ref(dbChat, 'chats/'+currentChatId), (snap) => {
        const box = document.getElementById('chat-box'); box.innerHTML = "";
        snap.forEach(c => {
            const m = c.val(); const isSent = m.sender === currentUser.id;
            box.innerHTML += `<div class="message-wrapper ${isSent?'sent':'received'}"><div class="message-bubble ${isSent?'sent':'received'}">${m.text}</div></div>`;
        });
        box.scrollTop = box.scrollHeight; toggleLoader(false);
    });
}

const sendMessage = async () => {
    const input = document.getElementById('messageInput'); if(!input.value.trim()) return;
    await push(ref(dbChat, 'chats/'+currentChatId), { sender: currentUser.id, text: input.value, timestamp: Date.now() });
    input.value = "";
}

// User Actions
const uploadPhoto = (event) => {
    const file = event.target.files[0]; if (!file) return;
    if (file.size > 0.5 * 1024 * 1024) { alert("File size too large! Select under 500KB."); return; }
    toggleLoader(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
        const img = await compressImage(e.target.result, 300, 300);
        await updateDoc(doc(dbAuth, "users", currentUser.id), { profilePic: img });
        currentUser.profilePic = img; localStorage.setItem('user', JSON.stringify(currentUser)); location.reload();
    };
    reader.readAsDataURL(file);
};

const changeName = async () => {
    const newName = prompt("Enter new name:", currentUser.username);
    if (newName && newName.trim() !== "") {
        toggleLoader(true);
        await updateDoc(doc(dbAuth, "users", currentUser.id), { username: newName.trim() });
        currentUser.username = newName.trim(); localStorage.setItem('user', JSON.stringify(currentUser)); location.reload();
    }
};

const toggleTheme = () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const targetTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', targetTheme);
    localStorage.setItem('theme', targetTheme);
    updateThemeButton(targetTheme);
};

function updateThemeButton(theme) {
    const btn = document.getElementById('theme-toggle-btn'); if(!btn) return;
    btn.innerHTML = theme === 'light' ? `<i class="fas fa-sun"></i> <span>Light Mode</span>` : `<i class="fas fa-moon"></i> <span>Dark Mode</span>`;
}

// Global Event Delegation for Dynamic Elements
document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('profile-click') || e.target.classList.contains('visitor-name') || e.target.classList.contains('comment-user')) {
        const uid = e.target.getAttribute('data-uid'); if(uid) visitProfile(uid);
    }
    if (e.target.classList.contains('like-toggle-action')) {
        const pid = e.target.getAttribute('data-pid'); if(pid) toggleLike(pid);
    }
    if (e.target.classList.contains('comment-toggle-action')) {
        const pid = e.target.getAttribute('data-pid'); const el = document.getElementById(`comments-${pid}`);
        if(el) el.style.display = el.style.display === 'block' ? 'none' : 'block';
    }
    if (e.target.classList.contains('comment-submit')) {
        const pid = e.target.getAttribute('data-pid'); if(pid) addComment(pid);
    }
    if (e.target.classList.contains('post-delete')) {
        const pid = e.target.getAttribute('data-pid');
        if(pid && confirm("Delete this post?")) {
            await deleteDoc(doc(dbApp, "posts", pid)); const el = document.getElementById(`post-card-${pid}`); if(el) el.remove();
        }
    }
    if (e.target.getInnerHTML === 'fa-trash' || e.target.classList.contains('fa-trash')) {
        const pid = e.target.getAttribute('data-pid'); const cid = e.target.getAttribute('data-cid');
        if(pid && cid && confirm("Delete comment?")) {
            const postRef = doc(dbApp, "posts", pid); const snap = await getDoc(postRef);
            if(snap.exists()){
                let comments = snap.data().comments || {}; delete comments[cid];
                await updateDoc(postRef, { comments: comments });
            }
        }
    }
});

// Bind UI Static Listeners
document.getElementById('toRegTxt').addEventListener('click', () => toggleAuth(true));
document.getElementById('toLoginTxt').addEventListener('click', () => toggleAuth(false));
document.getElementById('loginBtn').addEventListener('click', login);
document.getElementById('regBtn').addEventListener('click', register);
document.getElementById('logoutBtn').addEventListener('click', logout);
document.getElementById('postMediaInput').addEventListener('change', handlePostMediaSelect);
document.getElementById('clearMediaBtn').addEventListener('click', clearSelectedMedia);
document.getElementById('createPostBtn').addEventListener('click', createPost);
document.getElementById('myPic').addEventListener('click', () => visitProfile(currentUser.id));
document.getElementById('postMyPic').addEventListener('click', () => visitProfile(currentUser.id));
document.getElementById('feedHomeLink').addEventListener('click', showNewsfeed);
document.getElementById('profileBackBtn').addEventListener('click', showNewsfeed);
document.getElementById('theme-toggle-btn').addEventListener('click', toggleTheme);
document.getElementById('loadMoreBtn').addEventListener('click', loadMorePosts);
document.getElementById('chat-toggle-btn').addEventListener('click', () => document.getElementById('users-page').classList.remove('hidden'));
document.getElementById('chatListCloseBtn').addEventListener('click', () => document.getElementById('users-page').classList.add('hidden'));
document.getElementById('inboxCloseBtn').addEventListener('click', () => { document.getElementById('inbox-page').classList.add('hidden'); activeChatPartner = null; });
document.getElementById('sendMessageBtn').addEventListener('click', sendMessage);
document.getElementById('fileInput').addEventListener('change', uploadPhoto);
document.getElementById('edit-name-icon').addEventListener('click', changeName);
document.getElementById('pPic').addEventListener('click', () => { if(activeChatPartner) visitProfile(activeChatPartner.id); });
document.getElementById('pName').addEventListener('click', () => { if(activeChatPartner) visitProfile(activeChatPartner.id); });

// App Init Trigger
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

if(currentUser) {
    toggleLoader(true);
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('app-interface').style.display = 'flex';
    document.getElementById('myPic').src = currentUser.profilePic || defaultPic;
    document.getElementById('postMyPic').src = currentUser.profilePic || defaultPic;
    
    fetchInitialPosts();

    onSnapshot(collection(dbAuth, "users"), (snap) => {
        const list = document.getElementById('users-list'); list.innerHTML = "";
        snap.forEach(c => {
            const u = c.data();
            if(u.id !== currentUser.id) {
                const div = document.createElement('div'); div.className = 'chat-item';
                div.innerHTML = `<img src="${u.profilePic || defaultPic}"><div><h4>${u.username}</h4><small>Tap to chat</small></div>`;
                div.onclick = () => openInbox(u); list.appendChild(div);

                const ids = [currentUser.id, u.id].sort(); const chatRoomId = ids[0] + '_' + ids[1];
                if (!globalChatListeners[chatRoomId]) {
                    let lastMsgTime = Date.now();
                    globalChatListeners[chatRoomId] = onValue(ref(dbChat, 'chats/' + chatRoomId), (chatSnap) => {
                        chatSnap.forEach(msgNode => {
                            const m = msgNode.val();
                            if(m.timestamp > lastMsgTime) { lastMsgTime = m.timestamp; }
                        });
                    });
                }
            }
        });
    });
}
