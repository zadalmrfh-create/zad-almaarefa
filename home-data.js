import { auth, db, FIREBASE_READY } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { collection, doc, getDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

/**
 * عرض العدد العام للطلاب دون كشف أي بيانات شخصية.
 * يعتمد على publicStats/students ويتم تحديثه لحظيًا.
 */
export function watchStudentCount(elementOrId) {
  const element = typeof elementOrId === 'string'
    ? document.getElementById(elementOrId)
    : elementOrId;

  if (!element) return () => {};

  element.textContent = '—';

  if (!FIREBASE_READY || !db) {
    return () => {};
  }

  const counterRef = doc(db, 'publicStats', 'students');

  return onSnapshot(
    counterRef,
    (snapshot) => {
      const rawTotal = snapshot.exists() ? snapshot.data()?.total : undefined;
      const total = Number(rawTotal);
      element.textContent = rawTotal !== undefined && rawTotal !== null && Number.isFinite(total) && total >= 0
        ? Math.floor(total).toLocaleString('ar-EG')
        : '—';
    },
    (error) => {
      console.warn('تعذر تحميل عداد الطلاب:', error);
      if (!element.textContent || element.textContent === '—') {
        element.textContent = '—';
      }
    }
  );
}

watchStudentCount('studentCount');

const buttons = document.querySelectorAll('.login-nav-btn,.login-mobile-btn');
const dashLinks = document.querySelectorAll('.account-dashboard-link');
const heroAccount = document.querySelector('.zad-home-hero__account');
const ADMIN_EMAIL = 'maleksameh121@gmail.com';

function pathFor(role, status) {
  if (role === 'admin') return './dashboard/admin/index.html';
  if (role === 'teacher' && status === 'active') return './dashboard/teacher/index.html';
  return './dashboard/student/index.html';
}

const escapeText = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

if (FIREBASE_READY && auth) {
  onAuthStateChanged(auth, async user => {
    if (!user) {
      if (heroAccount) heroAccount.textContent = 'تسجيل الدخول';
      dashLinks.forEach(link => { link.href = './login/index.html'; });
      buttons.forEach(button => {
        button.href = './login/index.html';
        if (button.classList.contains('login-nav-btn')) {
          button.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> تسجيل الدخول';
        }
      });
      return;
    }

    const isPrimaryAdmin = user.email?.toLowerCase() === ADMIN_EMAIL;
    let role = isPrimaryAdmin ? 'admin' : 'student';
    let profile = {};
    try {
      const snapshot = await getDoc(doc(db, 'users', user.uid));
      if (snapshot.exists()) {
        profile = snapshot.data();
        if (!isPrimaryAdmin) role = profile.role || role;
      }
    } catch {}
    try {
      const snapshot = await getDoc(doc(db, 'admins', user.uid));
      if (snapshot.exists()) role = 'admin';
    } catch {}

    const dashboard = pathFor(role, profile.status);
    const displayName = (profile.fullName || user.displayName || '').trim();
    const name = profile.fullName || user.displayName || user.email?.split('@')[0] || 'حسابي';
    const shortName = displayName.length > 14 ? displayName.split(/\s+/)[0] || name : name;
    const initial = (name.trim()[0] || 'ح').toUpperCase();

    if (heroAccount) heroAccount.textContent = 'افتح حسابي';
    dashLinks.forEach(link => { link.href = dashboard; });
    buttons.forEach(button => {
      if (button.classList.contains('login-mobile-btn')) {
        button.href = dashboard;
        return;
      }
      const wrapper = document.createElement('div');
      wrapper.className = 'smart-account-wrap';
      wrapper.innerHTML = `<button type="button" class="smart-account-trigger">
        <span class="account-avatar">${escapeText(initial)}</span><span class="account-name">${escapeText(shortName)}</span><span class="account-caret">⌄</span>
      </button><div class="smart-account-menu">
        <a href="${dashboard}">🏠 لوحتي</a>
        <a href="${dashboard}#profileCard">👤 الملف الشخصي</a>
        <a href="${dashboard}?tab=notifications">🔔 الإشعارات</a>
        <button type="button" class="smart-logout">↪ تسجيل الخروج</button>
      </div>`;
      button.replaceWith(wrapper);
      wrapper.querySelector('.smart-account-trigger').onclick = () => wrapper.classList.toggle('open');
      wrapper.querySelector('.smart-logout').onclick = async () => {
        await signOut(auth);
        location.href = './index.html';
      };
    });
  });
}

export function redirectAfterLogin(userData) {
  window.location.href = pathFor(userData?.role, userData?.status);
}

async function loadHomeExtras(){
  const sg=document.getElementById('homeStatsGrid');
  if(!sg)return;
  let st={};
  sg.innerHTML=Array.from({length:4},()=>'<div class="home-stat-skeleton"></div>').join('');
  const cards=[['students','👨‍🎓','الطلاب'],['books','📚','كتب المكتبة'],['teachers','👨‍🏫','المعلمون'],['categories','📚','الأقسام']];
  const draw=()=>{sg.innerHTML=cards.map(x=>`<div class="card text-center p-6"><div class="text-3xl">${x[1]}</div><div class="text-3xl font-black mt-2">${(st[x[0]]===undefined?'—':Number(st[x[0]]).toLocaleString('ar-EG'))}</div><div>${x[2]}</div></div>`).join('');};
  draw();
  // حساب عدد الأقسام من بطاقات الأقسام المعروضة فعلًا.
  const categoryGrid=document.getElementById('cats-grid');
  if(categoryGrid){
    const updateCategories=()=>{const total=categoryGrid.querySelectorAll('.cat-card').length;if(total){st.categories=total;draw();}};
    updateCategories();
    new MutationObserver(updateCategories).observe(categoryGrid,{childList:true});
  }
  // محتويات المكتبة القديمة انتقلت إلى كتالوج المتجر؛ لا تعتمد على صفحة المكتبة المحذوفة.
  try {
    const {baseProducts}=await import('./store/catalog-data.js?v=20261103-home-stats');
    const baseBooks=baseProducts.filter(p=>p.type==='book'&&p.deleted!==true&&p.published!==false).length;
    st.books=baseBooks;
    draw();
    onSnapshot(collection(db,'storeProducts'),snapshot=>{
      const overrides=new Map(snapshot.docs.map(d=>[d.id,d.data()]));
      const ids=new Set(baseProducts.map(p=>p.id));
      const existing=baseProducts.filter(p=>{
        const x={...p,...(overrides.get(p.id)||{})};
        return x.type==='book'&&!x.deleted&&x.published!==false;
      }).length;
      const extra=snapshot.docs.filter(d=>!ids.has(d.id)&&d.data().type==='book'&&!d.data().deleted&&d.data().published!==false).length;
      st.books=existing+extra;draw();
    },error=>console.info('تعذر تحديث عدد كتب المتجر لحظيًا',error));
  }catch(error){console.warn('تعذر قراءة كتالوج المتجر',error);}
  // بقية الإحصائيات تُقرأ بصورة مستقلة، ولا تستطيع استبدال عداد الكتب.
  // قراءة عدّاد الطلاب والمعلمين كمستندين معروفين، ومتابعة تغيّرهما دون إعادة فتح الصفحة.
  // لو المستند غير موجود أو تعذرت القراءة نعرض «—» بدل قيمة غير مؤكدة.
  for(const id of ['students','teachers']){
    onSnapshot(doc(db,'publicStats',id),snap=>{
      if(!snap.exists()){delete st[id];draw();return;}
      const raw=snap.data().total??snap.data().count;
      if(Number.isFinite(Number(raw))&&Number(raw)>=0)st[id]=Number(raw);
      else delete st[id];
      draw();
    },error=>{delete st[id];draw();console.info('تعذر تحميل إحصائية '+id,error);});
  }
}
if (FIREBASE_READY && db) {
  loadHomeExtras().catch(error => console.warn('تعذر تحميل إحصائيات الرئيسية:', error));
}

if (FIREBASE_READY && auth) {
  onAuthStateChanged(auth, async user => {
    const box = document.getElementById('personalHome');
    if (!box) return;
    box.hidden = !user;
    if (!user) return;

    let name = user.displayName || user.email?.split('@')[0] || 'طالبنا';
    try {
      const snapshot = await getDoc(doc(db, 'users', user.uid));
      if (snapshot.exists()) name = snapshot.data().fullName || name;
    } catch {}
    document.getElementById('personalWelcome').textContent = `مرحبًا ${name}، ماذا تريد أن تكمل اليوم؟`;
  });
}
