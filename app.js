
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

// ========================================
// 1. 初始化 Firebase Authentication
// ========================================

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account"
});

// ========================================
// 2. 取得 HTML 元素
// ========================================

const signInButton = document.getElementById("google-sign-in");
const signOutButton = document.getElementById("sign-out-button");
const message = document.getElementById("app-message");

let isSigningIn = false;
let isSigningOut = false;

// ========================================
// 3. 顯示登入訊息
// ========================================

function showMessage(text, type = "") {
  if (!message) return;

  message.textContent = text;
  message.className = `message ${type}`.trim();
}

// ========================================
// 4. 登入按鈕狀態
// ========================================

function setSignInButtonState(loading) {
  if (!signInButton) return;

  signInButton.disabled = loading;

  signInButton.innerHTML = loading
    ? "正在登入，請稍候…"
    : '<span class="google-mark" aria-hidden="true">G</span> 使用 Google 登入';
}

// ========================================
// 5. Google 登入
// ========================================

async function handleGoogleSignIn() {
  if (isSigningIn) return;

  isSigningIn = true;
  setSignInButtonState(true);
  showMessage("正在開啟 Google 登入視窗…");

  try {
    await signInWithPopup(auth, googleProvider);
    // 登入成功後由 onAuthStateChanged 處理畫面切換。
  } catch (error) {
    console.error("MeetNest Google sign-in error:", error);

    switch (error.code) {
      case "auth/popup-closed-by-user":
        showMessage("你已關閉登入視窗，可以再次嘗試。");
        break;

      case "auth/popup-blocked":
        showMessage("瀏覽器封鎖了登入視窗，請允許彈出視窗後再試。", "error");
        break;

      case "auth/unauthorized-domain":
        showMessage(
          "此網站網域尚未獲 Firebase 授權。請檢查 Authentication 的 Authorized domains。",
          "error"
        );
        break;

      case "auth/network-request-failed":
        showMessage("網絡連線失敗，請檢查網絡後再試。", "error");
        break;

      default:
        showMessage(
          `登入未能完成：${error.message || error.code || "未知錯誤"}`,
          "error"
        );
    }
  } finally {
    isSigningIn = false;

    if (!auth.currentUser) {
      setSignInButtonState(false);
    }
  }
}

if (signInButton) {
  signInButton.addEventListener("click", handleGoogleSignIn);
}

// ========================================
// 6. Firebase 登入狀態監聽
// ========================================

onAuthStateChanged(
  auth,
  (user) => {
    if (user) {
      // 已登入：切換至 MeetNest 主介面。
      if (window.meetNestUI?.showDashboard) {
        window.meetNestUI.showDashboard(user);
      }

      const displayName = user.displayName || "MeetNest 成員";

      showMessage(`你好，${displayName}！登入成功。`, "success");

      if (signInButton) {
        signInButton.disabled = true;
        signInButton.textContent = "已登入";
      }

      if (signOutButton) {
        signOutButton.disabled = false;
        signOutButton.textContent = "登出";
      }
    } else {
      // 未登入：顯示登入首頁。
      if (window.meetNestUI?.showLanding) {
        window.meetNestUI.showLanding();
      }

      if (!isSigningIn && !isSigningOut) {
        showMessage("登入後即可建立自己的私人群組。");
      }

      setSignInButtonState(isSigningIn);

      if (signOutButton) {
        signOutButton.disabled = false;
      }
    }
  },
  (error) => {
    console.error("MeetNest authentication state error:", error);
    showMessage("暫時無法確認登入狀態，請重新整理網頁再試。", "error");
  }
);

// ========================================
// 7. 登出
// ========================================

async function handleSignOut() {
  if (isSigningOut) return;

  const confirmed = window.confirm("確定要登出 MeetNest 嗎？");

  if (!confirmed) return;

  isSigningOut = true;

  if (signOutButton) {
    signOutButton.disabled = true;
    signOutButton.textContent = "正在登出…";
  }

  try {
    await signOut(auth);

    // 成功登出後，onAuthStateChanged 會返回登入首頁。
    showMessage("你已成功登出。");
  } catch (error) {
    console.error("MeetNest sign-out error:", error);
    showMessage("登出未能完成，請稍後再試。", "error");
  } finally {
    isSigningOut = false;

    if (signOutButton) {
      signOutButton.disabled = false;
      signOutButton.textContent = "登出";
    }
  }
}

if (signOutButton) {
  signOutButton.addEventListener("click", handleSignOut);
}

console.log("MeetNest Authentication initialized.");
