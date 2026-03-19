// --- রেজিস্ট্রেশন ও ডুপ্লিকেট চেক ---
document.getElementById('registerBtn').onclick = async () => {
    const name = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    const password = document.getElementById('password').value;

    if(!name || !email || !phone || !password) {
        return alert("সবগুলো ঘর পূরণ করুন!");
    }

    // ১. ডাটাবেসে এই ফোন নম্বর দিয়ে কেউ আছে কি না চেক করা
    const userRef = ref(db, 'users/' + phone);
    const snapshot = await get(userRef);

    if (snapshot.exists()) {
        // যদি ইউজার আগে থেকেই থাকে
        const existingUser = snapshot.val();
        
        // পাসওয়ার্ড চেক করে লগইন করানো
        if(existingUser.password === password) {
            currentUser = existingUser;
            alert("Welcome back, " + currentUser.username);
            goToChat();
        } else {
            alert("এই নম্বরটি ইতিমধ্যে নিবন্ধিত। সঠিক পাসওয়ার্ড দিন।");
        }
    } else {
        // ২. যদি নতুন ইউজার হয়, তবে ডাটাবেসে সেভ করা
        const newUser = {
            username: name,
            email: email,
            phone: phone,
            password: password // মনে রাখবেন: আসল প্রোজেক্টে পাসওয়ার্ড এনক্রিপ্ট করা উচিত
        };

        await set(ref(db, 'users/' + phone), newUser);
        currentUser = newUser;
        alert("Registration Successful!");
        goToChat();
    }
};

// চ্যাট স্ক্রিনে যাওয়ার ফাংশন
function goToChat() {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('chat-container').style.display = 'block';
    document.getElementById('welcome-user').innerText = "Logged in as: " + currentUser.username;
}
