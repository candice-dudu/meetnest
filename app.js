import { initializeApp } from
  "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from
  "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";

import { firebaseConfig } from "./firebase-config.js";

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const googleProvider = new GoogleAuthProvider();

const signInButton = document.getElementById("google-sign-in");
const message = document.getElementById("app-message");

function showMessage(text, type = "") {
  message.textContent = text;
  message.className = `message ${type}`.trim();
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    showMessage(
      `你好，${user.displayName || "MeetNest 成員"}！登入成功，下一步將建立你的群組空間。`,
      "success"
    );

    signInButton.textContent = "已登入";
    signInButton.disabled = true;
  } else {
    signInButton.disabled = false;
    signInButton.innerHTML =
      '<span class="google-mark" aria-hidden="true">G</span> 使用 Google 登入';

    showMessage("登入後即可建立自己的私人群組。");
  }
});

signInButton.addEventListener("click", async () => {
  signInButton.disabled = true;
  showMessage("正在開啟 Google 登入…");

  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error("Google sign-in error:", error);

    if (error.code === "auth/popup-closed-by-user") {
      showMessage("你已關閉登入視窗，可以再次嘗試。");
    } else if (error.code === "auth/unauthorized-domain") {
      showMessage("此網站網域尚未獲 Firebase 授權，請檢查 Authorized domains。", "error");
    } else {
      showMessage(
        `登入未能完成：${error.message || error.code}`,
        "error"
      );
    }

    signInButton.disabled = false;
  }
});
