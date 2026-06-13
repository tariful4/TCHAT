// --- Automatic Update Version System ---
const APP_VERSION = "1.0.4"; // Bumping version for new schema updates
const savedVersion = localStorage.getItem('app_version');
if (savedVersion !== APP_VERSION) {
    localStorage.setItem('app_version', APP_VERSION);
    window.location.reload(true); 
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, push, onValue, get, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyAT22X04lwGjaneGGW9sKzeO6hWVAA3n6g",
    authDomain: "tchat-a9707.firebaseapp.com",
    databaseURL: "https://tchat-a9707-default-rtdb.firebaseio.com",
    projectId: "tchat-a9707",
    storageBucket: "tchat-a9707.firebasestorage.app",
    messagingSenderId: "324756549796",
    appId: "1:324756549796:web:f557ebab16be9e5545f631"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let currentUser = JSON.parse(localStorage.getItem('user')) || null;
let currentChatId = null;
let activeChatPartner = null; 
let currentProfileListener = null; 
let currentVisitorsListener = null; 
let selectedPostMediaRaw = null; 
let selectedPostMediaType = null; 

const defaultPic = "https://cdn-icons-png.flaticon.com/512/149/149071.png";

// --- Safe Notification Handlers ---
function requestNotificationPermission() {
    try {
        if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission();
        }
    } catch (e) { console.log("Notification request bypassed", e); }
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
    } catch (e) { console.log("Notification trigger bypassed", e); }
}

let lastPostTimestamp = Date.now();
let globalChatListeners = {};

// --- Theme Management ---
window.toggleTheme = () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const targetTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', targetTheme);
    localStorage.setItem('theme', targetTheme);
    updateThemeButton(targetTheme);
};

function updateThemeButton(theme) {
    const btn = document.getElementById('theme-toggle-btn');
    if(!btn) return;
    if(theme === 'light') {
        btn.innerHTML = `<i class="fas fa-sun"></i> <span>Light Mode</span>`;
    } else {
        btn.innerHTML = `<i class="fas fa-moon"></i> <span>Dark Mode</span>`;
    }
}

const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

// --- Loader Logic ---
function toggleLoader(show) {
    const loader = document.getElementById('loader-overlay');
    if (show) loader.classList.remove('hidden');
    else loader.classList.add('hidden');
}

// --- Back Button Logic ---
window.addEventListener('popstate', () => {
    const inbox = document.getElementById('inbox-page');
    const users = document.getElementById('users-page');
    const profile = document.getElementById('profile-page');
    
    if (!inbox.classList.contains('hidden')) {
        inbox.classList.add('hidden');
        activeChatPartner = null;
    } 
    else if (!users.classList.contains('hidden')) {
        users.classList.add('hidden');
    }
    else if (!profile.classList.contains('hidden')) {
        showNewsfeed();
    }
});

function pushState() { if (window.history.state !== "app") history.pushState("app", ""); }

// --- AUTH ---
window.toggleAuth = (reg) => {
    document.getElementById('login-form').style.display = reg ? 'none' : 'block';
    document.getElementById('reg-form').style.display = reg ? 'block' : 'none';
}

window.login = async () => {
    const ep = document.getElementById('loginEmailPhone').value.trim();
    const ps = document.getElementById('loginPass').value.trim();
    if(!ep || !ps) return;
    toggleLoader(true);
    const snap = await get(ref(db, 'users'));
    let found = null;
    snap.forEach(c => { if(c.val().emailPhone === ep && c.val().password === ps) found = c.val(); });
    if(found) { localStorage.setItem('user', JSON.stringify(found)); location.reload(); }
    else { toggleLoader(false); alert("Invalid login!"); }
}

window.register = async () => {
    const ep = document.getElementById('regEmailPhone').value.trim();
    const ps = document.getElementById('regPass').value.trim();
    if(!ep || !ps) return;
    toggleLoader(true);
    const usersSnap = await get(ref(db, 'users'));
    let alreadyExists = false;
    if(usersSnap.exists()) {
        usersSnap.forEach(child => {
            if(child.val().emailPhone === ep) alreadyExists = true;
        });
    }
    if(alreadyExists) {
        toggleLoader(false);
        alert("This Email or Phone is already registered! Please login.");
        return;
    }
    const id = 'user_' + Date.now();
    const user = { id, emailPhone: ep, username: ep.split('@')[0], password: ps, profilePic: defaultPic };
    await set(ref(db, 'users/'+id), user);
    localStorage.setItem('user', JSON.stringify(user));
    location.reload();
}

window.logout = () => { localStorage.clear(); location.reload(); }

// --- MEDIA HANDLING LOGIC FOR RICH POSTS ---
window.handlePostMediaSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    // File Size Warning for Realtime Database (Keeps data packet size secure)
    if (file.size > 2 * 1024 * 1024) { 
        alert("File size too large! Please choose a file under 2MB.");
        event.target.value = "";
        return;
    }

    selectedPostMediaType = file.type.startsWith('video/') ? 'video' : 'image';
    
    const reader = new FileReader();
    reader.onload = (e) => {
        selectedPostMediaRaw = e.target.result;
        const container = document.getElementById('mediaPreviewContainer');
        
        // Dynamic clean slate inside container
        const oldMedia = container.querySelector('img, video');
        if (oldMedia) oldMedia.remove();

        if (selectedPostMediaType === 'image') {
            const img = document.createElement('img');
            img.src = selectedPostMediaRaw;
            container.appendChild(img);
        } else {
            const video = document.createElement('video');
            video.src = selectedPostMediaRaw;
            video.controls = true;
            container.appendChild(video);
        }
        container.style.display = 'block';
    };
    reader.readAsDataURL(file);
};

window.clearSelectedMedia = () => {
    selectedPostMediaRaw = null;
    selectedPostMediaType = null;
    document.getElementById('postMediaInput').value = "";
    const container = document.getElementById('mediaPreviewContainer');
    container.style.display = 'none';
    const oldMedia = container.querySelector('img, video');
    if (oldMedia) oldMedia.remove();
};

// --- PROFILE VISIT SYSTEM & VISITORS LOGIC ---
window.visitProfile = async (uid) => {
    toggleLoader(true);
    if(currentProfileListener) { currentProfileListener(); currentProfileListener = null; } 
    if(currentVisitorsListener) { currentVisitorsListener(); currentVisitorsListener = null; }

    const snap = await get(ref(db, 'users/' + uid));
    if(!snap.exists()) { toggleLoader(false); return; }
    const userData = snap.val();
    pushState();
    
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
        msgBtn.style.display = 'block';
        msgBtn.onclick = () => openInbox(userData);
        themeBtn.style.display = 'none'; 
        visitorsDashboard.classList.add('hidden');
        
        // Track Profile Visit Event silently in DB
        await set(ref(db, `profile_visitors/${uid}/${currentUser.id}`), {
            uid: currentUser.id,
            name: currentUser.username,
            pic: currentUser.profilePic || defaultPic,
            timestamp: Date.now()
        });
    } else {
        msgBtn.style.display = 'none';
        themeBtn.style.display = 'inline-flex';
        updateThemeButton(localStorage.getItem('theme') || 'dark');
        visitorsDashboard.classList.remove('hidden');
        
        // Live Stream profile visitors exclusively onto your own profile
        currentVisitorsListener = onValue(ref(db, `profile_visitors/${currentUser.id}`), (vSnap) => {
            const listContainer = document.getElementById('visitors-list-container');
            listContainer.innerHTML = "";
            let visitors = [];
            vSnap.forEach(child => { visitors.push(child.val()); });
            
            if (visitors.length === 0) {
                listContainer.innerHTML = `<p style="font-size:12px; opacity:0.5; padding:10px;">No recent visitors yet.</p>`;
            } else {
                // Display fresh visitors on top chronologically
                visitors.sort((a,b) => b.timestamp - a.timestamp).forEach(v => {
                    listContainer.innerHTML += `
                        <div class="visitor-item">
                            <img src="${v.pic || defaultPic}" class="visitor-img">
                            <div class="visitor-info">
                                <span class="visitor-name"> ${v.name}</span>
                                <div class="visitor-time">Visited: ${new Date(v.timestamp).toLocaleString()}</div>
                            </div>
                        </div>`;
                });
            }
        });
    }

    currentProfileListener = onValue(ref(db, 'posts'), (snap) => {
        const userFeed = document.getElementById('user-posts-container');
        userFeed.innerHTML = "";
        let posts = [];
        snap.forEach(c => { 
            const p = c.val();
            if(p.uid === uid) posts.push({id: c.key, ...p}); 
        });
        posts.reverse().forEach(p => { userFeed.innerHTML += generatePostHTML(p); });
        toggleLoader(false);
    });
}

// Function assignments to window for inline HTML events
window.visitProfile = visitProfile;
window.showMyProfile = () => visitProfile(currentUser.id);
window.showNewsfeed = () => {
    if(currentProfileListener) { currentProfileListener(); currentProfileListener = null; }
    if(currentVisitorsListener) { currentVisitorsListener(); currentVisitorsListener = null; }
    document.getElementById('profile-page').classList.add('hidden');
    document.getElementById('newsfeed-page').classList.remove('hidden');
}
window.visitFromInbox = () => { if(activeChatPartner) visitProfile(activeChatPartner.id); }

// --- GLOBAL RICH MARKUP RENDER SYSTEM ---
window.generatePostHTML = function(p) {
    const likeCount = p.likes ? Object.keys(p.likes).length : 0;
    const cmtCount = p.comments ? Object.keys(p.comments).length : 0;
    const isLiked = p.likes && p.likes[currentUser.id];
    let cmtHtml = "";
    if(p.comments) {
        Object.keys(p.comments).forEach(cid => {
            const c = p.comments[cid];
            cmtHtml += `<div class="comment-item"><span class="comment-user" onclick="visitProfile('${c.uid}')">${c.name}:</span> ${c.text}${c.uid === currentUser.id ? `<div class="cmt-actions"><i class="fas fa-trash" onclick="deleteComment('${p.id}', '${cid}')"></i></div>` : ''}</div>`;
        });
    }

    // Media attachment conditional injection markup
    let mediaMarkup = "";
    if (p.media) {
        if (p.mediaType === 'video') {
            mediaMarkup = `<div class="post-media-container"><video src="${p.media}" controls preload="metadata"></video></div>`;
        } else {
            mediaMarkup = `<div class="post-media-container"><img src="${p.media}"></div>`;
        }
    }

    return `<div class="post-card"><div class="post-header"><img src="${p.pic || defaultPic}" class="post-avatar" onclick="visitProfile('${p.uid}')"><div><div class="post-user" onclick="visitProfile('${p.uid}')">${p.name}</div><div class="post-time">${new Date(p.timestamp).toLocaleString()}</div></div>${p.uid === currentUser.id ? `<i class="fas fa-trash-alt del-btn" onclick="deletePost('${p.id}')"></i>` : ''}</div><div class="post-content">${p.text || ""}</div>${mediaMarkup}<div class="post-stats"><span><i class="fas fa-thumbs-up"></i> ${likeCount}</span><span>${cmtCount} Comments</span></div><div class="post-actions"><span class="${isLiked?'liked':''}" onclick="toggleLike('${p.id}')"><i class="fas fa-thumbs-up"></i> Like</span><span onclick="showComments('${p.id}')"><i class="fas fa-comment"></i> Comment</span></div><div class="comment-section" id="comments-${p.id}"><div id="comment-list-${p.id}">${cmtHtml}</div><div class="comment-input-row"><input type="text" id="cmt-inp-${p.id}" placeholder="Write a comment..."><i class="fas fa-paper-plane" onclick="addComment('${p.id}')" style="color:#8c442c; margin-top:5px; cursor:pointer;"></i></div></div></div>`;
}

window.createPost = async () => {
    const txt = document.getElementById('postText').value.trim();
    if(!txt && !selectedPostMediaRaw) return; // Prevent raw empty posts
    toggleLoader(true);
    
    const postObj = { 
        uid: currentUser.id, 
        name: currentUser.username, 
        pic: currentUser.profilePic || defaultPic, 
        text: txt, 
        timestamp: Date.now() 
    };

    if (selectedPostMediaRaw) {
        postObj.media = selectedPostMediaRaw;
        postObj.mediaType = selectedPostMediaType;
    }

    await push(ref(db, 'posts'), postObj);
    document.getElementById('postText').value = "";
    window.clearSelectedMedia();
    toggleLoader(false);
}

window.toggleLike = async (pid) => {
    const postRef = ref(db, `posts/${pid}/likes/${currentUser.id}`);
    const snap = await get(postRef);
    if(snap.exists()) await remove(postRef); else await set(postRef, true);
}

window.addComment = async (pid) => {
    const inp = document.getElementById(`cmt-inp-${pid}`);
    const txt = inp.value.trim();
    if(!txt) return;
    await push(ref(db, `posts/${pid}/comments`), { uid: currentUser.id, name: currentUser.username, text: txt, timestamp: Date.now() });
    inp.value = "";
}

window.showComments = (pid) => {
    const el = document.getElementById(`comments-${pid}`);
    el.style.display = el.style.display === 'block' ? 'none' : 'block';
}

window.deletePost = (pid) => { if(confirm("Delete this post?")) remove(ref(db, 'posts/' + pid)); }
window.deleteComment = (pid, cid) => { if(confirm("Delete comment?")) remove(ref(db, `posts/${pid}/comments/${cid}`)); }

window.openChatList = () => { pushState(); document.getElementById('users-page').classList.remove('hidden'); }
window.closeChatList = () => document.getElementById('users-page').classList.add('hidden');
window.closeInbox = () => { document.getElementById('inbox-page').classList.add('hidden'); activeChatPartner = null; }

window.openInbox = (user) => {
    toggleLoader(true); activeChatPartner = user; pushState();
    document.getElementById('users-page').classList.remove('hidden');
    document.getElementById('profile-page').classList.add('hidden');
    document.getElementById('inbox-page').classList.remove('hidden');
    document.getElementById('pName').innerText = user.username;
    document.getElementById('pPic').src = user.profilePic || defaultPic;
    const ids = [currentUser.id, user.id].sort();
    currentChatId = ids[0] + '_' + ids[1];
    onValue(ref(db, 'chats/'+currentChatId), (snap) => {
        const box = document.getElementById('chat-box');
        box.innerHTML = "";
        snap.forEach(c => {
            const m = c.val(); const isSent = m.sender === currentUser.id;
            box.innerHTML += `<div class="message-wrapper ${isSent?'sent':'received'}"><div class="message-bubble ${isSent?'sent':'received'}">${m.text}</div></div>`;
        });
        box.scrollTop = box.scrollHeight;
        toggleLoader(false);
    });
}

window.sendMessage = async () => {
    const input = document.getElementById('messageInput');
    if(!input.value.trim()) return;
    await push(ref(db, 'chats/'+currentChatId), { sender: currentUser.id, text: input.value, timestamp: Date.now() });
    input.value = "";
}

window.uploadPhoto = (event) => {
    const file = event.target.files[0]; if (!file) return;
    toggleLoader(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
        const img = e.target.result;
        await update(ref(db, 'users/' + currentUser.id), { profilePic: img });
        currentUser.profilePic = img;
        localStorage.setItem('user', JSON.stringify(currentUser));
        location.reload();
    };
    reader.readAsDataURL(file);
};

window.changeName = async () => {
    const newName = prompt("Enter new name:", currentUser.username);
    if (newName && newName.trim() !== "") {
        toggleLoader(true);
        await update(ref(db, 'users/' + currentUser.id), { username: newName.trim() });
        currentUser.username = newName.trim();
        localStorage.setItem('user', JSON.stringify(currentUser));
        location.reload();
    }
};

if(currentUser) {
    toggleLoader(true);
    requestNotificationPermission();
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('app-interface').style.display = 'flex';
    document.getElementById('myPic').src = currentUser.profilePic || defaultPic;
    document.getElementById('postMyPic').src = currentUser.profilePic || defaultPic;
    
    // Fixed Newsfeed listener with Push Notification Integration
    onValue(ref(db, 'posts'), (snap) => {
        const feed = document.getElementById('feed-container');
        feed.innerHTML = ""; let posts = [];
        snap.forEach(c => { 
            const p = c.val();
            posts.push({id: c.key, ...p}); 
            
            // Trigger safe notification for new posts
            if (p.uid !== currentUser.id && p.timestamp > lastPostTimestamp) {
                let postText = p.text || "";
                let cleanText = postText.length > 60 ? postText.substring(0, 60) + "..." : postText;
                triggerPushNotification(
                    `New Post from ${p.name || "User"}`, 
                    cleanText, 
                    p.pic,
                    () => { window.showNewsfeed(); }
                );
            }
        });

        if(posts.length > 0) {
            lastPostTimestamp = Math.max(...posts.map(o => o.timestamp || 0));
        }

        posts.reverse().forEach(p => { feed.innerHTML += window.generatePostHTML(p); });
        toggleLoader(false);
    });

    // Users listener with Background Chat Notification Manager
    onValue(ref(db, 'users'), (snap) => {
        const list = document.getElementById('users-list');
        list.innerHTML = "";
        snap.forEach(c => {
            const u = c.val();
            if(u.id !== currentUser.id) {
                const div = document.createElement('div');
                div.className = 'chat-item';
                div.innerHTML = `<img src="${u.profilePic || defaultPic}"><div><h4>${u.username}</h4><small>Tap to chat</small></div>`;
                div.onclick = () => window.openInbox(u);
                list.appendChild(div);

                // Real-time Background Message Listener per user
                const ids = [currentUser.id, u.id].sort();
                const chatRoomId = ids[0] + '_' + ids[1];
                
                if (!globalChatListeners[chatRoomId]) {
                    let lastMsgTime = Date.now();
                    globalChatListeners[chatRoomId] = onValue(ref(db, 'chats/' + chatRoomId), (chatSnap) => {
                        chatSnap.forEach(msgNode => {
                            const m = msgNode.val();
                            if (m.sender === u.id && m.timestamp > lastMsgTime) {
                                if (activeChatPartner === null || activeChatPartner.id !== u.id) {
                                    let msgText = m.text || "";
                                    let cleanMsg = msgText.length > 50 ? msgText.substring(0, 50) + "..." : msgText;
                                    triggerPushNotification(
                                        `New Message from ${u.username}`,
                                        cleanMsg,
                                        u.profilePic,
                                        () => { window.openInbox(u); }
                                    );
                                }
                            }
                            if(m.timestamp > lastMsgTime) { lastMsgTime = m.timestamp; }
                        });
                    });
                }
            }
        });
    });
}
