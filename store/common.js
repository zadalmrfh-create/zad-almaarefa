import {auth,db,ADMIN_EMAIL,firebaseConfig} from '../firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {doc,getDoc} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
export {auth,db,firebaseConfig};
export const $ = s=>document.querySelector(s);
export const esc = x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const fmt = n=>new Intl.NumberFormat('ar-EG',{maximumFractionDigits:2}).format(Number(n)||0)+' ج.م';
export const dateText = t=>{try{return (t?.toDate?t.toDate():t instanceof Date?t:new Date(t)).toLocaleString('ar-EG')}catch{return '—'}};
export const types={summary:'ملخص',exam:'امتحان',evaluation:'تقييم',book:'كتاب',lesson:'حصة',course:'كورس',service:'خدمة تعليمية'};
export const emoji={summary:'📚',exam:'📝',evaluation:'📋',book:'📖',lesson:'👨‍🏫',course:'🎓',service:'✨'};
export function toast(message){let t=$('#toast');if(t){t.textContent=message;t.style.display='block';setTimeout(()=>t.style.display='none',4500)}}
export async function session(){return new Promise(resolve=>{const u=onAuthStateChanged(auth,user=>{u();resolve(user)},()=>resolve(null))})}
export async function adminCheck(u){if(!u)return false;if(u.email?.toLowerCase()===ADMIN_EMAIL.toLowerCase() && u.emailVerified)return true;try{const [a,b]=await Promise.all([getDoc(doc(db,'admins',u.uid)),getDoc(doc(db,'users',u.uid))]);return a.exists()||b.data()?.role==='admin'}catch{return false}}
export function navActive(name){document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===name))}
export function printReceipt(order){
  const w=window.open('','_blank');
  if(!w){toast('اسمح بفتح النافذة لطباعة الإيصال');return}
  const lines=(order.items||[]).map(x=>`<tr><td>${esc(x.title)}</td><td>${esc(types[x.type]||x.type)}</td><td>${fmt(x.price||0)}</td></tr>`).join('');
  const logoUrl=new URL('../images/logo.png',window.location.href).href;
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>إيصال متجر زاد المعرفة</title><style>
  body{font-family:Tahoma,Arial,sans-serif;padding:26px;max-width:820px;margin:auto;color:#1a1a1a}
  .head{display:flex;align-items:center;justify-content:space-between;gap:18px;border-bottom:2px solid #d7b54a;padding-bottom:16px;margin-bottom:18px}
  .brand{display:flex;align-items:center;gap:16px}.brand img{width:78px;height:78px;object-fit:contain;border-radius:50%;border:2px solid #d7b54a;padding:4px;background:#fff}
  .brand h1{margin:0;color:#13345c;font-size:1.9rem}.brand p{margin:6px 0 0;color:#555}
  .receipt-tag{background:#f6e5a8;border:1px solid #d7b54a;color:#13345c;padding:10px 14px;border-radius:14px;font-weight:700}
  .meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:16px 0 18px}.meta div{background:#f6f8fb;border:1px solid #d7dce6;border-radius:12px;padding:10px 12px}
  table{width:100%;border-collapse:collapse;margin-top:8px}td,th{padding:11px;border:1px solid #c9d0db;text-align:right}th{background:#eef3f8}
  .totals{margin-top:18px;background:#f9fbfd;border:1px solid #d9e0ea;border-radius:16px;padding:14px 16px}.totals h2{margin:10px 0 0;color:#13345c}
  .foot{margin-top:20px;border-top:1px dashed #bbb;padding-top:12px;color:#555;font-size:.95rem}.muted{color:#666}
  </style>
  <div class="head"><div class="brand"><img src="${logoUrl}" alt="شعار زاد المعرفة"><div><h1>متجر زاد المعرفة</h1><p>إيصال دفع طلب معتمد بعد مراجعة الإدارة</p></div></div><div class="receipt-tag">إيصال طلب متجر زاد المعرفة</div></div>
  <div class="meta"><div><strong>رقم الإيصال:</strong> ${esc(order.id)}</div><div><strong>الطالب:</strong> ${esc(order.buyerName||order.buyerEmail||'')}</div><div><strong>تاريخ الاعتماد:</strong> ${esc(dateText(order.approvedAt||order.updatedAt))}</div><div><strong>وسيلة الدفع:</strong> ${esc(order.paymentMethod||'')}</div></div>
  <table><tr><th>المنتج</th><th>النوع</th><th>القيمة</th></tr>${lines}</table>
  <div class="totals"><div><strong>إجمالي الخصم:</strong> ${fmt(order.discountTotal||0)}</div><h2>الإجمالي المعتمد: ${fmt(order.approvedTotal??order.quotedTotal??0)}</h2><div class="muted" style="margin-top:10px"><strong>الرقم المرجعي:</strong> ${esc(order.paymentReference||'لم يُسجل رقم مرجعي')}</div></div>
  <div class="foot">هذا الإيصال صادر إلكترونيًا من متجر زاد المعرفة التعليمية بعد اعتماد الدفع من الإدارة.</div>`);
  w.document.close();w.focus();w.print()
}
