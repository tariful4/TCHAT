import { ref, push, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { initializeFirestore, doc, setDoc, getDoc, getDocs, collection, query, orderBy, limit, startAfter, onSnapshot, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// database.js theke instances gulo import kora holo
import { dbAuth, dbApp, dbChat } from "./database.js";

// ========================================================
// VERSION CONTROL SYSTEM (FIXED FOR REALTIME REFRESH)
// ========================================================
const APP_VERSION = "2.0.1"; 
const savedVersion = localStorage.getItem('app_version');

if (savedVersion !== APP_VERSION) {
    localStorage.setItem('app_version', APP_VERSION);
    
    // ব্রাউজারের সমস্ত ক্যাশ (Cache Storage) ক্লিয়ার করার জন্য
    if ('caches' in window) {
        caches.keys().then((names) => {
            for (let name of names) caches.delete(name);
        });
    }
    
    // হার্ড রিফ্রেশ নিশ্চিত করার জন্য ক্যাশ-কন্ট্রোল মেথড
    setTimeout(() => {
        window.location.replace(window.location.href.split('?')[0] + '?v=' + APP_VERSION);
    }, 200);
}

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

// নতুন ইনবক্স ফিল্টারিং ও ব্যাজের জন্য গ্লোবাল ভেরিয়েবল
let allUsersData = [];
let activeChatsMetadata = {};

// Loader Toggle
function toggleLoader(show) {
    const loader = document.getElementById('loader-overlay');
    if (loader) {
        if (show) loader.classList.remove('hidden');
        else loader.classList.add('hidden');
    }
}

// Global HTML Feed Generator with Lazy Loading Image & Timestamp Tracking Attribute
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

    return `<div class="post-card" id="post-card-${p.id}" data-timestamp="${p.timestamp}"><div class="post-header"><img src="${p.pic || defaultPic}" class="post-avatar profile-click" data-uid="${p.uid}"><div><div class="post-user profile-click" data-uid="${p.uid}">${p.name}</div><div class="post-time">${new Date(p.timestamp).toLocaleString()}</div></div>${p.uid === currentUser.id ? `<i class="fas fa-trash-alt del-btn post-delete" data-pid="${p.id}"></i>` : ''}</div><div class="post-content">${p.text || ""}</div>${mediaMarkup}<div class="post-stats"><span><i class="fas fa-thumbs-up"></i> <span id="like-count-${p.id}">${likeCount}</span></span><span><span id="cmt-count-${p.id}">${cmtCount}</span> Comments</span></div><div class="post-actions"><span id="like-btn-${p.id}" class="like-toggle-action ${isLiked?'liked':''}" data-pid="${p.id}"><i class="fas fa-thumbs-up"></i> Like</span><span class="comment-toggle-action" data-pid="${p.id}"><i class="fas fa-comment"></i> Comment</span></div><div class="comment-section" id="comments-${p.id}"><div id="comment-list-${p.id}">${cmtHtml}</div><div class="comment-input-row"><input type="text" id="cmt-inp-${p.id}" placeholder="Write a comment..."><i class="fas fa-paper-plane comment-submit" data-pid="${p.id}" style="color:#8c442c; margin-top:5px; cursor:pointer;"></i></div></div></div>`;
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

// Media Selector (Size limits applied strictly)
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

    window.history.pushState({ page: 'profile' }, 'Profile');
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

    if (isAlreadyLiked) {
        likeBtn.classList.remove('liked');
        likeCountEl.innerText = currentCount - 1;
    } else {
        likeBtn.classList.add('liked');
        likeCountEl.innerText = currentCount + 1;
    }

    try {
        const postRef = doc(dbApp, "posts", pid); const snap = await getDoc(postRef);
        if(snap.exists()) {
            let likes = snap.data().likes || {};
            if(likes[currentUser.id]) delete likes[currentUser.id]; else likes[currentUser.id] = true;
            await updateDoc(postRef, { likes: likes });
        }
    } catch(err) {
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

// ফিক্সড: স্ক্রিন খালি হওয়া বা অতিরিক্ত লোড হওয়া ছাড়াই একদম নিখুঁত রিয়েলটাইম ফিড হ্যান্ডলিং
const fetchInitialPosts = async () => {
    toggleLoader(true);
    isFetchingPosts = true;
    const feedContainer = document.getElementById('feed-container');
    
    // প্রথম বার ইনিশিয়াল লোডের জন্য শুধুমাত্র কন্টেইনার একবার ক্লিয়ার হবে
    if(feedContainer.children.length === 0) {
        feedContainer.innerHTML = "";
    }

    const qRef = query(collection(dbApp, "posts"), orderBy("timestamp", "desc"), limit(POSTS_LIMIT));
    onSnapshot(qRef, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            const p = change.doc.data(); p.id = change.doc.id;
            const existingCard = document.getElementById(`post-card-${p.id}`);
            
            if (change.type === "added") {
                if (!existingCard) {
                    const wrapper = document.createElement('div');
                    wrapper.innerHTML = generatePostHTML(p);
                    const newPostEl = wrapper.firstChild;
                    
                    // নতুন বা পুরানো সমস্ত পোস্টকে নিখুঁতভাবে টাইমস্ট্যাম্প অনুযায়ী ফিডে সাজানো হচ্ছে (কোনো ইনভার্সন বা রিলোড ছাড়া)
                    const children = feedContainer.children;
                    let inserted = false;
                    for (let i = 0; i < children.length; i++) {
                        const childTime = parseInt(children[i].getAttribute('data-timestamp') || 0);
                        if (p.timestamp > childTime) {
                            feedContainer.insertBefore(newPostEl, children[i]);
                            inserted = true;
                            break;
                        }
                    }
                    if (!inserted) {
                        feedContainer.appendChild(newPostEl);
                    }
                }
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

// চ্যাট লিস্ট ইন্টারফেস আপডেট ও সর্টিং মেথড
function updateChatListUI() {
    const list = document.getElementById('users-list');
    list.innerHTML = "";

    // চ্যাট করা আইডি গুলো সর্বশেষ মেসেজের টাইম অনুযায়ী সর্ট করা হচ্ছে (সবার আগে আসবে)
    const sortedChats = Object.values(activeChatsMetadata)
        .filter(chat => chat.hasMessages)
        .sort((a, b) => b.lastTimestamp - a.lastTimestamp);

    sortedChats.forEach(chat => {
        const u = chat.userObj;
        const div = document.createElement('div');
        div.className = 'chat-item';
        div.style.position = 'relative';
        
        // ইউজারের প্রোফাইলে ছোট লাল ব্যাজ (যদি আনরিড মেসেজ থাকে)
        let badgeHtml = chat.unreadCount > 0 ? `<span class="user-chat-badge" style="background: red; color: white; font-size: 11px; font-weight: bold; padding: 2px 6px; border-radius: 50%; position: absolute; right: 15px; top: 50%; transform: translateY(-50%);">${chat.unreadCount}</span>` : '';
        
        div.innerHTML = `<img src="${u.profilePic || defaultPic}"><div><h4>${u.username}</h4><small>${chat.lastText || 'Tap to chat'}</small></div>${badgeHtml}`;
        div.onclick = () => openInbox(u);
        list.appendChild(div);
    });

    // মেইন মেসেজ আইকনে টোটাল লাল নোটিফিকেশন ব্যাজ সংখ্যা আপডেট
    let totalUnread = Object.values(activeChatsMetadata).reduce((sum, chat) => sum + chat.unreadCount, 0);
    const mainBadge = document.getElementById('main-chat-badge');
    if (totalUnread > 0) {
        mainBadge.innerText = totalUnread;
        mainBadge.style.display = 'block';
    } else {
        mainBadge.style.display = 'none';
    }
}

// Chat Engine Room
const openInbox = (user) => {
    toggleLoader(true); activeChatPartner = user;
    document.getElementById('users-page').classList.add('hidden');
    document.getElementById('profile-page').classList.add('hidden');
    document.getElementById('inbox-page').classList.remove('hidden');
    document.getElementById('pName').innerText = user.username;
    document.getElementById('pPic').src = user.profilePic || defaultPic;
    
    const ids = [currentUser.id, user.id].sort(); currentChatId = ids[0] + '_' + ids[1];
    
    // মেসেজ রিড হিসেবে মার্ক করা
    localStorage.setItem('last_read_' + currentChatId, Date.now());
    if (activeChatsMetadata[currentChatId]) {
        activeChatsMetadata[currentChatId].unreadCount = 0;
        updateChatListUI();
    }

    onValue(ref(dbChat, 'chats/'+currentChatId), (snap) => {
        const box = document.getElementById('chat-box'); box.innerHTML = "";
        snap.forEach(c => {
            const m = c.val(); const isSent = m.sender === currentUser.id;
            box.innerHTML += `<div class="message-wrapper ${isSent?'sent':'received'}"><div class="message-bubble ${isSent?'sent':'received'}">${m.text}</div></div>`;
        });
        box.scrollTop = box.scrollHeight; toggleLoader(false);
        
        localStorage.setItem('last_read_' + currentChatId, Date.now());
        if (activeChatsMetadata[currentChatId]) {
            activeChatsMetadata[currentChatId].unreadCount = 0;
            updateChatListUI();
        }
    });

    window.history.pushState({ page: 'inbox' }, 'Inbox');
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

// DEVICE BACK BUTTON HANDLER LOGIC
// ========================================================
window.addEventListener('popstate', (event) => {
    const inboxPage = document.getElementById('inbox-page');
    const usersPage = document.getElementById('users-page');
    const profilePage = document.getElementById('profile-page');

    if (!inboxPage.classList.contains('hidden')) {
        inboxPage.classList.add('hidden');
        activeChatPartner = null;
        window.history.pushState({ page: 'home' }, 'Home');
    } else if (!usersPage.classList.contains('hidden')) {
        usersPage.classList.add('hidden');
        window.history.pushState({ page: 'home' }, 'Home');
    } else if (!profilePage.classList.contains('hidden')) {
        showNewsfeed();
        window.history.pushState({ page: 'home' }, 'Home');
    } else {
        if (confirm("Do you want to exit TCHAT?")) {
            navigator.app ? navigator.app.exitApp() : window.close();
        } else {
            window.history.pushState({ page: 'home' }, 'Home');
        }
    }
});
// ========================================================

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
document.getElementById('profileBackBtn').addEventListener('click', () => { showNewsfeed(); window.history.back(); });
document.getElementById('theme-toggle-btn').addEventListener('click', toggleTheme);
document.getElementById('loadMoreBtn').addEventListener('click', loadMorePosts);
document.getElementById('chat-toggle-btn').addEventListener('click', () => { document.getElementById('users-page').classList.remove('hidden'); window.history.pushState({ page: 'users' }, 'Users'); });
document.getElementById('chatListCloseBtn').addEventListener('click', () => { document.getElementById('users-page').classList.add('hidden'); window.history.back(); });
document.getElementById('inboxCloseBtn').addEventListener('click', () => { document.getElementById('inbox-page').classList.add('hidden'); activeChatPartner = null; window.history.back(); });
document.getElementById('sendMessageBtn').addEventListener('click', sendMessage);
document.getElementById('fileInput').addEventListener('change', uploadPhoto);
document.getElementById('edit-name-icon').addEventListener('click', changeName);
document.getElementById('pPic').addEventListener('click', () => { if(activeChatPartner) visitProfile(activeChatPartner.id); });
document.getElementById('pName').addEventListener('click', () => { if(activeChatPartner) visitProfile(activeChatPartner.id); });

// রেজিস্ট্রেশন ইমেইল বা ফোন দিয়ে সার্চ করার ইভেন্ট লিসেনার
document.getElementById('chat-search-btn').addEventListener('click', () => {
    const queryStr = document.getElementById('chat-search-input').value.trim().toLowerCase();
    if (!queryStr) return;
    
    // হুবহু ইমেইল বা ফোন নাম্বার ম্যাচ করানো হচ্ছে
    const targetUser = allUsersData.find(u => u.emailPhone && u.emailPhone.toLowerCase() === queryStr);
    if (targetUser) {
        openInbox(targetUser);
        document.getElementById('chat-search-input').value = "";
    } else {
        alert("No user found with this Email or Phone number!");
    }
});

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

    window.history.pushState({ page: 'home' }, 'Home');

    // ইনবক্স রিয়েলটাইম স্ন্যাপশট ও রিয়েলটাইম মেসেজ লিসেনার ট্রিপল হ্যান্ডলিং
    onSnapshot(collection(dbAuth, "users"), (snap) => {
        allUsersData = [];
        snap.forEach(c => {
            const u = c.data();
            if(u.id !== currentUser.id) {
                allUsersData.push(u);

                const ids = [currentUser.id, u.id].sort(); const chatRoomId = ids[0] + '_' + ids[1];
                if (!globalChatListeners[chatRoomId]) {
                    globalChatListeners[chatRoomId] = onValue(ref(dbChat, 'chats/' + chatRoomId), (chatSnap) => {
                        let lastTimestamp = 0;
                        let unreadCount = 0;
                        let hasMessages = false;
                        let lastText = "";

                        let lastReadTime = parseInt(localStorage.getItem('last_read_' + chatRoomId) || '0');
                        
                        if (activeChatPartner && activeChatPartner.id === u.id) {
                            lastReadTime = Date.now();
                            localStorage.setItem('last_read_' + chatRoomId, lastReadTime);
                        }

                        chatSnap.forEach(msgNode => {
                            const m = msgNode.val();
                            hasMessages = true;
                            if (m.timestamp > lastTimestamp) {
                                lastTimestamp = m.timestamp;
                                lastText = m.text;
                            }
                            if (m.sender !== currentUser.id && m.timestamp > lastReadTime) {
                                unreadCount++;
                            }
                        });

                        activeChatsMetadata[chatRoomId] = {
                            chatRoomId,
                            lastTimestamp,
                            unreadCount,
                            hasMessages,
                            lastText,
                            userObj: u
                        };

                        updateChatListUI();
                    });
                }
            }
        });
    });
}
