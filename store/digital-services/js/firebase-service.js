// Loaded only when js/firebase-config.js has been set up.
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth,signInAnonymously,signInWithEmailAndPassword,signOut,onAuthStateChanged,createUserWithEmailAndPassword,EmailAuthProvider,linkWithCredential,GoogleAuthProvider,signInWithPopup,linkWithPopup,sendPasswordResetEmail,sendEmailVerification,updateProfile } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore,doc,collection,getDoc,getDocs,setDoc,updateDoc,addDoc,query,where,orderBy,limit,onSnapshot,writeBatch,serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';
const app=getApps().length?getApp():initializeApp(firebaseConfig);
export const auth=getAuth(app),db=getFirestore(app);
export {signInAnonymously,signInWithEmailAndPassword,signOut,onAuthStateChanged,createUserWithEmailAndPassword,EmailAuthProvider,linkWithCredential,GoogleAuthProvider,signInWithPopup,linkWithPopup,sendPasswordResetEmail,sendEmailVerification,updateProfile,doc,collection,getDoc,getDocs,setDoc,updateDoc,addDoc,query,where,orderBy,limit,onSnapshot,writeBatch,serverTimestamp};
export async function getSettings(){const snap=await getDoc(doc(db,'settings','public'));return snap.exists()?snap.data():null}
export async function getCoupon(code){const snap=await getDoc(doc(db,'coupons',code));return snap.exists()&&snap.data().active===true?snap.data():null}
export async function anonymousUser(){await auth.authStateReady();if(auth.currentUser)return auth.currentUser;const cred=await signInAnonymously(auth);return cred.user}
