import {auth,db,ADMIN_EMAIL,firebaseConfig} from '../firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {doc,getDoc} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
export {auth,db,firebaseConfig};
export const $ = s=>document.querySelector(s);
export const esc = x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const fmt = n=>new Intl.NumberFormat('ar-EG',{maximumFractionDigits:2}).format(Number(n)||0)+' ج.م';
export const dateText = t=>{try{return (t?.toDate?t.toDate():t instanceof Date?t:new Date(t)).toLocaleString('ar-EG')}catch{return '—'}};
export const types={summary:'ملخص',exam:'امتحان',evaluation:'تقييم',book:'كتاب',lesson:'حصة',course:'كورس'};
export const emoji={summary:'📚',exam:'📝',evaluation:'📋',book:'📖',lesson:'👨‍🏫',course:'🎓'};
export function toast(message){let t=$('#toast');if(t){t.textContent=message;t.style.display='block';setTimeout(()=>t.style.display='none',4500)}}
export async function session(){return new Promise(resolve=>{const u=onAuthStateChanged(auth,user=>{u();resolve(user)},()=>resolve(null))})}
export async function adminCheck(u){if(!u)return false;if(u.email?.toLowerCase()===ADMIN_EMAIL.toLowerCase() && u.emailVerified)return true;try{const [a,b]=await Promise.all([getDoc(doc(db,'admins',u.uid)),getDoc(doc(db,'users',u.uid))]);return a.exists()||b.data()?.role==='admin'}catch{return false}}
export function navActive(name){document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===name))}
export function printReceipt(order){const w=window.open('','_blank');if(!w){toast('اسمح بفتح النافذة لطباعة الإيصال');return}const lines=(order.items||[]).map(x=>`<tr><td>${esc(x.title)}</td><td>${esc(x.type)}</td><td>${fmt(x.price||0)}</td></tr>`).join('');w.document.write(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>إيصال زاد المعرفة</title><style>body{font-family:Tahoma,sans-serif;padding:30px;max-width:750px;margin:auto}table{width:100%;border-collapse:collapse}td,th{padding:10px;border:1px solid #bbb}h1{color:#13345c}.row{display:flex;justify-content:space-between;margin:12px 0}</style><h1>أكاديمية زاد المعرفة التعليمية</h1><h2>إيصال دفع معتمد</h2><div>رقم الإيصال: ${esc(order.id)}</div><div>الطالب: ${esc(order.buyerName||order.buyerEmail||'')}</div><div>تاريخ الاعتماد: ${esc(dateText(order.approvedAt||order.updatedAt))}</div><hr><table><tr><th>المنتج</th><th>النوع</th><th>القيمة</th></tr>${lines}</table><div>الخصم: ${fmt(order.discountTotal||0)}</div><h2>الإجمالي المعتمد: ${fmt(order.approvedTotal??order.quotedTotal??0)}</h2><p>وسيلة الدفع: ${esc(order.paymentMethod||'')}</p><p>المرجع: ${esc(order.paymentReference||'غير متاح')}</p><hr><small>إيصال إلكتروني صادر بعد مراجعة الإدارة</small>`);w.document.close();w.focus();w.print()}
