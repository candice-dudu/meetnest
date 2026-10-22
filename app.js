
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

import {
  getFirestore,
  collection,
  doc,
  getDocs,
  writeBatch,
  serverTimestamp
} from
  "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

// ========================================
// 1. Firebase 初始化
// ========================================

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

const $ = (id) => document.getElementById(id);

let isSigningIn = false;
let isSigningOut = false;
let isCreatingGroup = false;
let currentUser = null;
let activeGroupId = null;
let groups = [];

// ========================================
// 2. 登入提示及按鈕
// ========================================

function showMessage(text, type = "") {
  const message = $("app-message");
  if (!message) return;

  message.textContent = text;
  message.className = `message ${type}`.trim();
}

function setLoginButton(loading) {
  const button = $("google-sign-in");
  if (!button) return;

  button.disabled = loading;
  button.innerHTML = loading
    ? "正在登入，請稍候…"
    : '<span class="google-mark" aria-hidden="true">G</span> 使用 Google 登入';
}

function showToast(text) {
  const toast = $("toast");
  if (!toast) {
    window.alert(text);
    return;
  }

  toast.textContent = text;
  toast.hidden = false;

  // 不使用計時器；提示會在下一次操作時更新或保留。
}

function showInfo(title, text) {
  if (window.meetNestUI?.showInfo) {
    window.meetNestUI.showInfo(title, text);
  } else {
    window.alert(`${title}\n\n${text}`);
  }
}

// ========================================
// 3. Google 登入
// ========================================

async function handleGoogleSignIn() {
  if (isSigningIn) return;

  isSigningIn = true;
  setLoginButton(true);
  showMessage("正在開啟 Google 登入視窗…");

  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error("Google sign-in error:", error);

    const messages = {
      "auth/popup-closed-by-user": "你已關閉登入視窗，可以再次嘗試。",
      "auth/popup-blocked": "瀏覽器封鎖了登入視窗，請允許彈出視窗後再試。",
      "auth/unauthorized-domain": "此網站網域尚未加入 Firebase Authorized domains。",
      "auth/network-request-failed": "網絡連線失敗，請檢查網絡後再試。"
    };

    showMessage(
      messages[error.code] || `登入未能完成：${error.message || error.code}`,
      "error"
    );
  } finally {
    isSigningIn = false;
    if (!auth.currentUser) setLoginButton(false);
  }
}

$("google-sign-in")?.addEventListener("click", handleGoogleSignIn);

// ========================================
// 4. 讀取自己的群組索引
// 每個索引代表一個已加入的群組
// ========================================

async function loadGroups() {
  if (!currentUser) return;

  const list = $("group-list");
  if (list) {
    list.replaceChildren();
    const loading = document.createElement("p");
    loading.className = "empty-state";
    loading.textContent = "正在載入群組…";
    list.append(loading);
  }

  try {
    const indexRef = collection(db, "users", currentUser.uid, "groups");
    const snapshot = await getDocs(indexRef);

    groups = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    groups.sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant")
    );

    renderGroups();

    if (activeGroupId && groups.some(g => g.id === activeGroupId)) {
      selectGroup(activeGroupId);
    } else if (groups.length > 0) {
      selectGroup(groups[0].id);
    } else {
      activeGroupId = null;
      renderNoGroupSelected();
    }
  } catch (error) {
    console.error("Load groups error:", error);

    if (list) {
      list.replaceChildren();
      const errorText = document.createElement("p");
      errorText.className = "empty-state";
      errorText.textContent =
        "無法載入群組。請確認 Firestore Rules 已發布，然後重新整理。";
      list.append(errorText);
    }

    showToast("載入群組失敗，請查看瀏覽器 Console 的錯誤訊息。");
  }
}

// ========================================
// 5. 顯示群組清單
// 使用 textContent，避免把群組名稱當成 HTML
// ========================================

function renderGroups() {
  const list = $("group-list");
  if (!list) return;

  list.replaceChildren();

  if (groups.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "你還沒有群組，按上方按鈕建立第一個群組。";
    list.append(empty);
    return;
  }

  groups.forEach((group) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      `group-item${group.id === activeGroupId ? " active" : ""}`;

    const avatar = document.createElement("span");
    avatar.className = "group-avatar";
    avatar.textContent = (group.name || "群").slice(0, 1);

    const details = document.createElement("span");
    details.style.minWidth = "0";

    const name = document.createElement("strong");
    name.textContent = group.name || "未命名群組";

    const role = document.createElement("small");
    role.textContent = group.role === "owner" ? "群主" : "群組成員";

    details.append(name, role);
    button.append(avatar, details);
    button.addEventListener("click", () => selectGroup(group.id));
    list.append(button);
  });
}

// ========================================
// 6. 選擇群組
// ========================================

function selectGroup(groupId) {
  const group = groups.find(item => item.id === groupId);
  if (!group) return;

  activeGroupId = groupId;

  $("active-group-name").textContent = group.name || "未命名群組";
  $("active-group-description").textContent =
    group.description || "這是你的私人群組。";

  renderGroups();

  // 此階段尚未載入日曆、活動及成員詳細資料。
  $("calendar-month-label").textContent = "日曆功能待開發";
  $("selected-date-label").textContent = "下一階段將加入日期選擇";
  $("best-date-result").textContent = "加入成員日程後，便可推薦最佳日期。";

  const inviteButton = $("invite-button");
  if (inviteButton) inviteButton.disabled = false;
}

function renderNoGroupSelected() {
  $("active-group-name").textContent = "選擇一個群組";
  $("active-group-description").textContent =
    "建立群組，或在下一階段加入朋友的私人群組。";

  $("calendar-month-label").textContent = "尚未選擇群組";
  $("selected-date-label").textContent = "尚未選擇日期";
  $("best-date-result").textContent = "建立群組後，這裡會顯示推薦日期。";
}

// ========================================
// 7. 建立私人群組
// 三份資料使用同一個 writeBatch 原子寫入
// ========================================

async function createGroup(name, description) {
  if (!currentUser) {
    throw new Error("請先使用 Google 登入。");
  }

  const cleanName = name.trim();
  const cleanDescription = description.trim();

  if (!cleanName || cleanName.length > 60) {
    throw new Error("群組名稱必須為 1 至 60 個字。");
  }

  if (cleanDescription.length > 200) {
    throw new Error("群組簡介不可超過 200 個字。");
  }

  // 只在本機建立文件參考，不會額外讀取資料庫。
  const groupRef = doc(collection(db, "groups"));
  const memberRef = doc(db, "groups", groupRef.id, "members", currentUser.uid);
  const indexRef = doc(db, "users", currentUser.uid, "groups", groupRef.id);

  const batch = writeBatch(db);

  batch.set(groupRef, {
    name: cleanName,
    description: cleanDescription,
    ownerId: currentUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    visibility: "private"
  });

  batch.set(memberRef, {
    role: "owner",
    status: "active",
    joinedAt: serverTimestamp()
  });

  batch.set(indexRef, {
    name: cleanName,
    description: cleanDescription,
    role: "owner",
    createdAt: serverTimestamp()
  });

  // 成功則三份資料一起寫入；失敗則整個批次不會部分成功。
  await batch.commit();

  return {
    id: groupRef.id,
    name: cleanName,
    description: cleanDescription,
    role: "owner"
  };
}

// ========================================
// 8. 攔截建立群組表單
// 使用 capture，避免 index.html 舊提示先彈出
// ========================================

document.addEventListener("submit", async (event) => {
  if (event.target?.id !== "create-group-form") return;

  event.preventDefault();
  event.stopImmediatePropagation();

  if (isCreatingGroup) return;

  if (!currentUser) {
    showInfo("尚未登入", "請先使用 Google 登入，再建立群組。");
    return;
  }

  const form = event.target;
  const nameInput = $("group-name-input");
  const descriptionInput = $("group-description-input");
  const submitButton = form.querySelector('button[type="submit"]');

  const name = nameInput?.value || "";
  const description = descriptionInput?.value || "";

  if (!name.trim()) {
    nameInput?.focus();
    showInfo("請輸入群組名稱", "群組名稱不可留空。");
    return;
  }

  isCreatingGroup = true;
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "正在建立…";
  }

  try {
    const newGroup = await createGroup(name, description);

    groups = [...groups, newGroup];
    activeGroupId = newGroup.id;

    renderGroups();
    selectGroup(newGroup.id);

    form.reset();
    $("create-group-dialog")?.close();

    showToast(`「${newGroup.name}」已成功建立！`);
  } catch (error) {
    console.error("Create group error:", error);

    const permissionError = error.code === "permission-denied";

    showInfo(
      "群組建立失敗",
      permissionError
        ? "Firestore 拒絕這次寫入。請確認已發布最新 Rules，並檢查規則是否與程式一致。"
        : `暫時無法建立群組。${error.message || "請稍後再試。"}`
    );
  } finally {
    isCreatingGroup = false;

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "建立群組";
    }
  }
}, true);

// ========================================
// 9. 加入群組及邀請：下一階段實作
// ========================================

document.addEventListener("submit", (event) => {
  if (event.target?.id !== "join-group-form") return;

  event.preventDefault();
  event.stopImmediatePropagation();

  showInfo(
    "加入群組功能待開發",
    "下一階段會加入安全的私人邀請連結及加入群組功能。"
  );
}, true);

$("invite-button")?.addEventListener("click", () => {
  showInfo(
    "邀請成員功能待開發",
    "下一階段會建立私人邀請連結，讓朋友加入這個群組。"
  );
});

// ========================================
// 10. 登出
// ========================================

async function handleSignOut() {
  if (isSigningOut) return;

  if (!window.confirm("確定要登出 MeetNest 嗎？")) return;

  isSigningOut = true;
  const button = $("sign-out-button");

  if (button) {
    button.disabled = true;
    button.textContent = "正在登出…";
  }

  try {
    await signOut(auth);
  } catch (error) {
    console.error("Sign-out error:", error);
    showToast("登出失敗，請稍後再試。");
  } finally {
    isSigningOut = false;

    if (button) {
      button.disabled = false;
      button.textContent = "登出";
    }
  }
}

$("sign-out-button")?.addEventListener("click", handleSignOut);

// ========================================
// 11. 登入狀態監聽
// ========================================

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (!user) {
    groups = [];
    activeGroupId = null;

    window.meetNestUI?.showLanding();
    setLoginButton(false);

    if (!isSigningIn && !isSigningOut) {
      showMessage("登入後即可建立自己的私人群組。");
    }

    return;
  }

  window.meetNestUI?.showDashboard(user);

  const avatar = $("user-avatar");
  if (avatar) {
    if (user.photoURL) {
      const image = document.createElement("img");
      image.src = user.photoURL;
      image.alt = "";
      image.width = 38;
      image.height = 38;
      image.style.borderRadius = "50%";
      image.style.objectFit = "cover";
      avatar.replaceChildren(image);
    } else {
      avatar.textContent = (user.displayName || "M").slice(0, 1);
    }
  }

  showMessage(`你好，${user.displayName || "MeetNest 成員"}！`, "success");

  const loginButton = $("google-sign-in");
  if (loginButton) {
    loginButton.disabled = true;
    loginButton.textContent = "已登入";
  }

  await loadGroups();
});

console.log("MeetNest group system initialized.");
