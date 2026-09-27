import { auth, db } from "../firebase-config.js";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

let cachedUid = "";
let cachedProfile = null;

async function getCurrentProfile() {
  const user = auth.currentUser;
  if (!user) return null;

  if (cachedUid === user.uid && cachedProfile) {
    return cachedProfile;
  }

  let data = {};
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) data = snap.data() || {};
  } catch (error) {
    console.warn("تعذر قراءة بيانات المستخدم لتسجيل تحميل الكتاب:", error);
  }

  cachedUid = user.uid;
  cachedProfile = {
    uid: user.uid,
    name:
      data.fullName ||
      data.name ||
      data.displayName ||
      user.displayName ||
      "مستخدم زاد المعرفة",
    email: data.email || user.email || "",
    role: data.role || "student",
    grade: data.grade || data.studyGrade || data.className || ""
  };

  return cachedProfile;
}

export function hasSignedInUser() {
  return Boolean(auth.currentUser);
}

export async function trackBookDownload(book = {}) {
  const profile = await getCurrentProfile();
  if (!profile) {
    const error = new Error("AUTH_REQUIRED");
    error.code = "auth-required";
    throw error;
  }

  const title = String(book.title || "").trim();
  const url = String(book.url || "").trim();
  if (!title || !url) return;

  await addDoc(collection(db, "libraryDownloads"), {
    userId: profile.uid,
    userName: profile.name,
    userEmail: profile.email,
    userRole: profile.role,
    userGrade: profile.grade,
    bookTitle: title,
    bookUrl: url,
    source: String(book.source || "general"),
    sourceLabel: String(book.sourceLabel || "المكتبة العامة"),
    bookGrade: String(book.grade || ""),
    bookCategory: String(book.category || ""),
    downloadedAt: serverTimestamp(),
    clientDownloadedAt: new Date().toISOString()
  });
}
