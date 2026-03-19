import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, push, onValue, query, orderByChild, equalTo, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// আপনার Firebase Config
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let currentUser = null;

// --- ১. রেজিস্ট্রেশন ও ডেটা সেভ ---
document.getElementById('registerBtn').onclick = () => {
    const user = {
        username: document.getElementById('username').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value
    };

    if(!user.username || !user.phone) return alert("Fill all fields!");

    // ডাটাবেসে ইউজার সেভ (ফোনের মাধ্যমে আইডি করা হয়েছে সহজ করার জন্য)
    set(ref(db, 'users/' + user.phone), user);
    
    currentUser = user;
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('chat-container').style.display = 'block';
    document.getElementById('welcome-user').innerText = "Hello, " + user.username;
    
    listenForMessages();
};

// --- ২. মেসেজ পাঠানো ---
document.getElementById('sendBtn').onclick = () => {
    const msg = document.getElementById('messageInput').value;
    if(!msg) return;

    push(ref(db, 'messages/'), {
        sender: currentUser.username,
        text: msg,
        timestamp: Date.now()
    });
    document.getElementById('messageInput').value = "";
};

// --- ৩. রিয়েলটাইম মেসেজ দেখানো ---
function listenForMessages() {
    onValue(ref(db, 'messages/'), (snapshot) => {
        const chatBox = document.getElementById('chat-box');
        chatBox.innerHTML = "";
        snapshot.forEach((child) => {
            const data = child.val();
            const div = document.createElement('div');
            div.classList.add('msg');
            div.classList.add(data.sender === currentUser.username ? 'my-msg' : 'other-msg');
            div.innerText = `${data.sender}: ${data.text}`;
            chatBox.appendChild(div);
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

// --- ৪. ইউজার সার্চ করার লজিক ---
document.getElementById('searchBtn').onclick = async () => {
    const queryVal = document.getElementById('searchUser').value;
    const userRef = ref(db, 'users/' + queryVal); // এখানে সরাসরি ফোন নম্বর দিয়ে সার্চ হচ্ছে
    
    const snapshot = await get(userRef);
    if (snapshot.exists()) {
        alert("User Found: " + snapshot.val().username);
    } else {
        alert("No user found with this number!");
    }
};
