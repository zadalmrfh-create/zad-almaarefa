import {auth,db} from '../firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {collection,getDocs} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {isAdminAccount,getPreviewContext,previewRequested} from './admin-preview-core.js';

const page = location.pathname.includes('/dashboard/admin/') ? 'admin' : location.pathname.includes('/dashboard/teacher/') ? 'teacher' : 'student';
const base = '../';
const urls = {admin:'../admin/index.html', teacher:'../teacher/index.html', student:'../student/index.html'};
let accountFetch = null;

function el(tag,props={},content='') {
  const x=document.createElement(tag);
  for(const [k,v] of Object.entries(props)) k==='className'?x.className=v:k==='title'?x.title=v:x.setAttribute(k,v);
  if(content)x.textContent=content;
  return x;
}
function showNotice(msg){const b=document.getElementById('zad-switch-notice');if(b)b.textContent=msg;}

// المعاينة قراءة فقط: لا يمكن إرسال نماذج أو تنفيذ إجراءات قد تغير البيانات.
// يُثبَّت الاعتراض على مستوى الالتقاط قبل معالجات الحفظ الخاصة باللوحة.
if(previewRequested && page !== 'admin') {
  document.addEventListener('submit',event=>{
    event.preventDefault();event.stopImmediatePropagation();showNotice('🔒 وضع المعاينة: الحفظ والتعديل غير متاحين.');
  },true);
  document.addEventListener('click',event=>{
    const button=event.target.closest('button,input[type="submit"]');
    if(!button || button.closest('#zad-admin-switcher')) return;
    const safe = button.matches('.student-tab,.teacher-tab,.teacher-action-card,[data-go],[data-student-view],#closeStudentDetails,#refreshLiveLessons,#zadVodafoneRefresh,#refreshFullQuizzes,#fullQuizClose,#printTeacherReport,#exportTeacherReport') || button.closest('.student-tabs,.teacher-tabs');
    if(safe) return;
    event.preventDefault();event.stopImmediatePropagation();showNotice('🔒 وضع المعاينة: يمكن المشاهدة فقط؛ لا يمكن إجراء تعديلات.');
  },true);
}

async function loadAccounts(role){
  if(!accountFetch)accountFetch=getDocs(collection(db,'users')).catch(e=>{accountFetch=null;throw e;});
  const snap=await accountFetch;
  return snap.docs.filter(d=>d.data().role===role).map(d=>({id:d.id,name:d.data().fullName||d.data().name||d.data().email||d.id})).sort((a,b)=>a.name.localeCompare(b.name,'ar'));
}
function initSwitcher(user,preview){
  const root=el('div',{id:'zad-admin-switcher',dir:'rtl'});
  root.style.cssText='position:relative;display:inline-flex;gap:7px;align-items:center;flex-wrap:wrap;z-index:210;direction:rtl';
  const button=el('button',{type:'button',id:'zad-open-switch'},'🔁 تبديل اللوحة');
  button.style.cssText='border:1px solid #d4ae4b;color:#0c2341;background:#edc951;padding:10px 14px;border-radius:12px;cursor:pointer;font-weight:900;font-family:inherit';
  root.append(button);
  const nav=el('div',{id:'zad-switch-menu'});
  nav.hidden=true;
  nav.style.cssText='position:absolute;top:calc(100% + 8px);right:0;width:min(345px,90vw);max-height:75vh;overflow:auto;background:#101f35;color:#f7f2dc;padding:14px;border:1px solid #d5b451;border-radius:14px;box-shadow:0 12px 45px #0007;z-index:300;text-align:right';
  nav.append(el('strong',{},'تبديل اللوحة دون تسجيل خروج'));
  const info=el('p',{},'اختر الدور ثم الحساب الذي تريد معاينته. وضع المعاينة للقراءة فقط.');
  info.style.cssText='font-size:12px;line-height:1.7;color:#d9e2f0';nav.append(info);
  const adminLink=el('a',{href:urls.admin},'👑 لوحة الأدمن');
  adminLink.style.cssText='display:block;color:#ffe39a;padding:9px;text-decoration:none;border:1px solid #374862;border-radius:9px;margin:6px 0';nav.append(adminLink);
  for(const role of ['teacher','student']){
    const row=el('div');row.style.marginTop='10px';
    const label=el('label',{},role==='teacher'?'👨‍🏫 معاينة لوحة المعلم':'🎓 معاينة لوحة الطالب');
    label.style.cssText='display:block;margin-bottom:5px;font-weight:bold';
    const select=el('select',{'aria-label':'اختيار '+(role==='teacher'?'معلم':'طالب')});
    select.style.cssText='display:block;width:100%;padding:10px;border:1px solid #657591;border-radius:9px;background:#fff;color:#162033;font-family:inherit';
    select.append(el('option',{value:''},'اختر الحساب...'));
    const go=el('button',{type:'button'},'فتح المعاينة');
    go.style.cssText='margin-top:6px;padding:9px;border-radius:9px;border:1px solid #d9b856;background:#e3bc50;color:#142035;font-weight:700;cursor:pointer';
    go.onclick=()=>{if(select.value) location.href=urls[role]+'?previewRole='+role+'&previewUid='+encodeURIComponent(select.value);else alert('اختر حسابًا من القائمة أولًا.');};
    row.append(label,select,go);nav.append(row);
    row.dataset.role=role;row.dataset.loaded='no';
    async function populate(){if(row.dataset.loaded==='yes')return;select.disabled=true;try{
      const items=await loadAccounts(role);
      items.forEach(x=>select.append(el('option',{value:x.id},x.name)));
      if(!items.length)select.append(el('option',{value:''},'لا توجد حسابات '+(role==='teacher'?'معلمين':'طلاب')));
      if(preview?.active && page===role)select.value=preview.uid;
      row.dataset.loaded='yes';
    }catch(e){console.error('Switch accounts:',e);select.append(el('option',{value:''},'تعذر قراءة قائمة الحسابات'));}
    finally{select.disabled=false;}}
    row.loadAccounts=populate;
  }
  button.onclick=async()=>{nav.hidden=!nav.hidden;if(!nav.hidden){for(const row of nav.querySelectorAll('[data-role]'))await row.loadAccounts();}};
  root.append(nav);
  const header=document.querySelector('.top .actions,header.top .actions,.admin-header .actions,.topbar .actions,.actions');
  if(header)header.prepend(root);
  else {root.style.cssText+='position:fixed;top:12px;left:12px';document.body.prepend(root);}
}
function addPreviewBanner(preview){
  const banner=el('aside',{id:'zad-preview-banner',dir:'rtl'});
  banner.style.cssText='background:#f5e6ab;color:#1f2937;padding:12px 16px;margin:10px auto;border:2px solid #b98e1b;border-radius:12px;max-width:1140px;font:700 14px/1.8 Tahoma,Arial,sans-serif;text-align:right';
  const name=preview.profile?.fullName||preview.profile?.name||'المستخدم';
  banner.append(el('span',{},'👁️ معاينة إدارية للقراءة فقط — '+name+' — بدون تغيير حساب الأدمن أو بيانات المستخدم. '));
  const back=el('a',{href:urls.admin},'↩ العودة للإدارة');back.style.cssText='color:#08294b;text-decoration:underline;white-space:nowrap';banner.append(back);
  const notice=el('p',{id:'zad-switch-notice'});notice.style.margin='4px 0 0';notice.style.color='#883c14';banner.append(notice);
  const wrap=document.querySelector('.wrap')||document.body;
  wrap.prepend(banner);
  document.documentElement.dataset.zadReadOnlyPreview='true';
  if(page==='student') {const p=document.getElementById('smartProgressText');if(p)p.textContent='محلي';const bar=document.getElementById('smartProgressBar');if(bar)bar.style.width='0';}
}
onAuthStateChanged(auth,async user=>{
  if(!user)return;
  if(!await isAdminAccount(user)) return;
  let preview={active:false,uid:user.uid};
  if(page==='teacher'||page==='student') {
    preview=await getPreviewContext(user,page);
    if(previewRequested && !preview.active){
      const banner=el('div',{},'لم يتم فتح المعاينة: '+(preview.reason||'تعذر التحقق من حساب المستخدم المحدد.'));
      banner.style.cssText='padding:16px;background:#fee2e2;color:#831717';document.body.prepend(banner);
    }
    if(preview.active) addPreviewBanner(preview);
  }
  initSwitcher(user,preview);
});
