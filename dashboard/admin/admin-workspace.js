/* Zad Al-Maarefa admin workspace: real independent tabs, responsive data tables */
(() => {
  const main = document.querySelector('main');
  const quickNav = document.querySelector('#adminQuickNav');
  if (!main || !quickNav) return;

  const groups = [
    {id:'home',label:'نظرة عامة',icon:'🏠',sections:['platformAnalytics','studentCounterManagement']},
    {id:'users',label:'المستخدمون',icon:'👥',sections:['usersManagement']},
    {id:'teachers',label:'إعداد المعلمين',icon:'👨‍🏫',sections:['saadAlaaAdminPanel']},
    {id:'bookings',label:'الحجوزات',icon:'📅',sections:['bookingsManagement']},
    {id:'exams',label:'الامتحانات',icon:'📝',sections:['codeExamsManagement','adminCertificatesSection','codeExamResultsSection','teacherExamAccessAdmin','zadSpecialExamResults','unitOneExamsAdmin']},
    {id:'library',label:'المكتبة',icon:'📚',sections:['librarySubscriptionsAdminPanel','libraryDownloadTracking']},
    {id:'lessons',label:'الحضور والغياب',icon:'✅',sections:['attendanceManagement']},
    {id:'payroll',label:'مرتبات المعلمين',icon:'💼',sections:['teacherPayrollManagement']},
    {id:'payments',label:'المدفوعات',icon:'💳',sections:['zadVodafoneAdminPanel','manualPaymentLedger']},
    {id:'content',label:'المحتوى',icon:'⚙️',sections:['contentManagement']},
    {id:'logs',label:'سجلات وتقارير',icon:'📊',sections:['loginLogsManagement']},
    {id:'reviews',label:'التقييمات',icon:'⭐',sections:['weeklyReviewsAdmin']},
    {id:'other',label:'الإشعارات',icon:'🔔',sections:['zadActivityAlerts','adminNotificationsManagement']}
  ];
  const tabs = document.createElement('nav');
  tabs.className='zad-admin-tabs';
  tabs.setAttribute('aria-label','أقسام لوحة إدارة زاد المعرفة');
  const container = document.createElement('div');
  container.className='zad-admin-panels';
  const mapped=new Map();
  for(const group of groups){
    const btn=document.createElement('button');
    btn.type='button';btn.className='zad-admin-tab';btn.dataset.adminTab=group.id;
    btn.textContent=`${group.icon} ${group.label}`;
    tabs.append(btn);
    const panel=document.createElement('div');
    panel.className='zad-admin-panel'; panel.id=`zad-admin-panel-${group.id}`;
    panel.setAttribute('role','region'); panel.setAttribute('aria-label',group.label);
    container.append(panel);
    group.panel=panel;
    for (const id of group.sections) mapped.set(id,group);
  }
  // Move every existing top-level management section without cloning elements/listeners.
  const managed = [...main.children].filter(el=> el.matches('section') && el !== quickNav && !el.classList.contains('hero'));
  for(const el of managed){
    if(el.id==='liveLessonsManagement' || el.id==='lessonFollowUpManagement'){el.hidden=true;el.style.display='none';}
    let group=mapped.get(el.id);
    if(!group) {
      // Unclassified administrative cards remain under notifications only as a fallback.
      // All current visible cards are assigned explicitly above.
      group=groups.find(x=>x.id==='other');
    }
    group.panel.append(el);
  }
  quickNav.insertAdjacentElement('afterend',tabs);
  tabs.insertAdjacentElement('afterend',container);

  // Separate financial accounts, payment reviews, and manually entered receipts.
  // Move existing nodes, never clone them: Firebase event handlers and DOM IDs stay intact.
  let showPaymentMode=()=>{};
  let manualPaymentTools=null;
  function preparePayments(){
    const mainCard=document.getElementById('zadVodafoneAdminPanel');
    const manualCard=document.getElementById('manualPaymentLedger');
    if(!mainCard||!manualCard)return;
    mainCard.classList.add('zad-finance-workspace');
    const accounts=mainCard.querySelector('.zad-student-accounts');
    const reviewMetrics=mainCard.querySelector('.zad-pay-admin-status');
    const reviewFilters=mainCard.querySelector('.actions');
    const reviewMsg=document.getElementById('zadVodafoneAdminMessage');
    const reviewArchive=mainCard.querySelector('.zad-pay-archived-notice');
    const reviewRequests=document.getElementById('zadVodafoneRequests');
    const originalIntro=mainCard.querySelector(':scope > p');
    if(!accounts||!reviewMetrics||!reviewFilters||!reviewRequests)return;
    const hint=document.createElement('p');
    hint.className='zad-admin-muted-intro';
    hint.textContent='اختَر نوع العمل أولًا؛ كشف الحساب لا يظهر إلا بعد اختيار الطالب، وطلبات التحويل لها شاشة مراجعة منفصلة.';
    mainCard.querySelector('h2')?.insertAdjacentElement('afterend',hint);
    const selector=document.createElement('div');
    selector.className='zad-finance-modes';
    selector.setAttribute('aria-label','اختر شاشة المدفوعات');
    const choices=[
      {id:'account',icon:'👤',title:'كشف حساب طالب',desc:'المحول والمعتمد، المدفوع، المقدم، المؤخر وتفاصيل الحصص'},
      {id:'review',icon:'💳',title:'مراجعة وسجل المدفوعات',desc:'قيد المراجعة، المعتمدة، المرفوضة، والأرشيف والدفعات اليدوية'}
    ];
    for(const x of choices){
      const b=document.createElement('button');b.type='button';b.className='zad-finance-mode';
      b.dataset.financeMode=x.id;b.setAttribute('aria-pressed','false');
      b.innerHTML=`<span class="zad-finance-mode-icon" aria-hidden="true">${x.icon}</span><strong>${x.title}</strong><small>${x.desc}</small>`;
      selector.append(b);
    }
    const viewAccount=document.createElement('section');
    viewAccount.id='zadFinanceAccountView';viewAccount.className='zad-finance-view';
    viewAccount.setAttribute('aria-label','تفاصيل حساب طالب محدد');viewAccount.hidden=true;
    const viewReview=document.createElement('section');
    viewReview.id='zadFinanceReviewView';viewReview.className='zad-finance-view';
    viewReview.setAttribute('aria-label','مراجعة وسجل المدفوعات');viewReview.hidden=true;
    viewAccount.append(accounts);
    const reviewHeading=document.createElement('div');
    reviewHeading.className='zad-finance-subhead';
    reviewHeading.innerHTML='<h3>💳 طلبات التحويل والمراجعة</h3><p>ابدأ بالطلبات المنتظرة، ثم استخدم حالة الطلب للانتقال إلى التحويلات المعتمدة أو المرفوضة والأرشيف.</p>';
    viewReview.append(reviewHeading);
    if(originalIntro)viewReview.append(originalIntro);
    for(const node of [reviewMetrics,reviewFilters,reviewMsg,reviewArchive,reviewRequests])if(node)viewReview.append(node);
    manualPaymentTools=document.createElement('details');
    manualPaymentTools.className='zad-finance-manual-tools';
    manualPaymentTools.id='zadFinanceManualTools';
    const summary=document.createElement('summary');
    summary.textContent='➕ تسجيل أو تعديل دفعة يدوية (سجل إداري منفصل)';
    manualPaymentTools.append(summary,manualCard);
    viewReview.append(manualPaymentTools);
    mainCard.append(selector,viewAccount,viewReview);
    const choose=document.createElement('p');
    choose.className='zad-finance-start-hint';choose.id='zadFinanceChooseHint';
    choose.textContent='👆 اختر «كشف حساب طالب» أو «مراجعة وسجل المدفوعات» للبدء.';
    mainCard.append(choose);
    showPaymentMode=id=>{
      const valid=['account','review'].includes(id);
      viewAccount.hidden=id!=='account';viewReview.hidden=id!=='review';choose.hidden=valid;
      selector.querySelectorAll('button').forEach(b=>{
        const active=b.dataset.financeMode===id;
        b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
      });
    };
    selector.addEventListener('click',e=>{
      const b=e.target.closest('[data-finance-mode]');
      if(b)showPaymentMode(b.dataset.financeMode);
    });
    showPaymentMode(null);
  }
  // Registration, recorded lessons, attendance reports, and the legacy teacher tools
  // are isolated into four screens without rewriting existing attendance logic.
  let showAttendanceMode=()=>{};
  function prepareAttendance(){
    const section=document.getElementById('attendanceManagement');
    if(!section)return;
    section.classList.add('zad-attendance-workspace');
    const header=section.querySelector(':scope > h2');
    if(header)header.textContent='✅ إدارة الحضور والغياب والمعلمين';
    const originalIntro=section.querySelector(':scope > p');
    if(originalIntro)originalIntro.textContent='كل مهمة في شاشة مستقلة: تسجيل الحصة، متابعة حضور المعلمين والطلاب، التقارير، وأدوات ربط السجلات القديمة.';
    const nav=document.createElement('nav');nav.className='zad-attendance-modes';
    nav.setAttribute('aria-label','خيارات قسم الحضور والغياب');
    const specs=[
      ['register','➕ تسجيل حصة'],['log','📚 سجلات الحصص'],
      ['reports','📊 ملخصات وتقارير'],['teachers','👨‍🏫 أدوات المعلمين']
    ];
    const views=new Map();
    for(const [key,label] of specs){
      const button=document.createElement('button');button.type='button';
      button.className='zad-attendance-mode';button.dataset.attendanceMode=key;button.textContent=label;
      button.setAttribute('aria-pressed','false');nav.append(button);
      const panel=document.createElement('div');panel.className='zad-attendance-view';panel.hidden=true;
      panel.id='zad-attendance-view-'+key;views.set(key,panel);
    }
    const heading=document.createElement('h3');heading.textContent='➕ تسجيل حضور أو غياب جديد';
    views.get('register').append(heading);
    const form=document.getElementById('manualAttendanceForm');
    if(form)views.get('register').append(form);
    const log=views.get('log');
    const logHeader=[...section.children].find(x=>x.tagName==='H3'&&x.textContent.includes('سجل الحضور'));
    if(logHeader)log.append(logHeader);
    const note=document.createElement('p');note.className='zad-attendance-note';
    note.textContent='حدد المعلم أو الطالب والمادة والتاريخ لإظهار الحصص المطلوبة فقط. تعديل أجر المعلم والإضافي يتم من زر الحصة نفسها.';
    log.append(note);
    const logNodes=[document.getElementById('attendanceLogFilters'),document.getElementById('attendanceLogCount'),section.querySelector(':scope > .table-wrap'),section.querySelector(':scope > .zad-pay-archive-history'),document.getElementById('attendanceReportTools')];
    logNodes.filter(Boolean).forEach(node=>log.append(node));
    const reports=views.get('reports');
    const reportsTitle=document.createElement('h3');reportsTitle.textContent='📊 تقارير ومراجعة حركة الحضور';
    reports.append(reportsTitle);
    const reportsHint=document.createElement('p');reportsHint.className='zad-attendance-note';
    reportsHint.textContent='ملخص الحضور والأرصدة للطلاب. لطباعة تقرير لفترة أو معلم معين، استخدم فلاتر «سجلات الحصص» ثم زر الطباعة هناك.';
    reports.append(reportsHint);
    const summary=document.getElementById('attendanceStudentSummary');if(summary)reports.append(summary);
    const teacherView=views.get('teachers');
    const teacherTitle=document.createElement('h3');teacherTitle.textContent='👨‍🏫 ربط المعلمين ومراجعة الحصص القديمة';teacherView.append(teacherTitle);
    const teacherNote=document.createElement('p');teacherNote.className='zad-attendance-note';
    teacherNote.textContent='أدوات إدارية لتصحيح الربط القديم فقط؛ لا تغيّر سعر الحصة أو مستحق الطالب عند مجرد المراجعة.';
    teacherView.append(teacherNote);
    for(const id of ['zadTeacherLinker','zadStudentUidRepairPanel']){
      const node=document.getElementById(id);if(node)teacherView.append(node);
    }
    const anchor=section.querySelector(':scope > p') || header;
    anchor?.insertAdjacentElement('afterend',nav);
    for(const view of views.values())section.append(view);
    showAttendanceMode=id=>{
      const selected=views.has(id)?id:'log';
      for(const [key,view] of views)view.hidden=key!==selected;
      for(const b of nav.querySelectorAll('button')){
        const active=b.dataset.attendanceMode===selected;
        b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
      }
    };
    nav.addEventListener('click',e=>{
      const button=e.target.closest('[data-attendance-mode]');
      if(button)showAttendanceMode(button.dataset.attendanceMode);
    });
    showAttendanceMode('log');
  }
  preparePayments();
  prepareAttendance();

  function activate(id,updateHash=true){
    const target=groups.some(g=>g.id===id)?id:'home';
    for(const g of groups){
      const active=g.id===target;
      g.panel.hidden=!active;
      g.panel.classList.toggle('active',active);
    }
    for(const button of tabs.querySelectorAll('button')){
      const active=button.dataset.adminTab===target;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    }
    if(updateHash) history.replaceState(null,'',`#panel-${target}`);
  }
  window.addEventListener('zad:open-admin-tab', event => { activate(event.detail?.tab || 'exams'); });
  tabs.addEventListener('click',e=>{
    const b=e.target.closest('[data-admin-tab]');
    if(b){activate(b.dataset.adminTab);tabs.scrollIntoView({block:'start',behavior:'smooth'});}
  });
  const findGroup = id => groups.find(g => g.sections.includes(id)) || groups.find(g=>g.id==='other');
  document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{
    const id=decodeURIComponent(a.hash.slice(1));
    const el=document.getElementById(id);
    if(el && container.contains(el)){
      e.preventDefault();activate(findGroup(id).id,false);
      if(id==='manualPaymentLedger'){showPaymentMode('review');if(manualPaymentTools)manualPaymentTools.open=true;}
      if(id==='attendanceManagement')showAttendanceMode('log');
      if(id==='zadVodafoneAdminPanel')showPaymentMode(null);
      setTimeout(()=>el.scrollIntoView({behavior:'smooth',block:'start'}),0);
    }
  }));
  const initial=location.hash.startsWith('#panel-')?location.hash.slice(7):null;
  activate(initial,false);
  if(location.hash==='#manualPaymentLedger'){
    activate('payments',false);showPaymentMode('review');if(manualPaymentTools)manualPaymentTools.open=true;
  } else if(location.hash==='#zadVodafoneAdminPanel'){
    activate('payments',false);showPaymentMode(null);
  } else if(location.hash==='#attendanceManagement'){
    activate('lessons',false);showAttendanceMode('log');
  }

  // Label cells for compact cards; keep original tables and existing actions intact.
  function labelTable(table){
    if(table.closest('.users-table-wrap')) return;
    const headers=[...table.querySelectorAll('thead tr:first-child th')].map(th=>th.textContent.trim());
    if(!headers.length)return;
    table.querySelectorAll('tbody tr').forEach(tr=>{
      [...tr.children].forEach((cell,i)=>{
        if(cell.tagName!=='TD')return;
        if(cell.colSpan>1){cell.classList.add('zad-table-empty');return;}
        cell.dataset.colLabel=headers[i]||'البيانات';
      });
    });
  }
  let scheduled=false;
  const refresh=()=>{
    if(scheduled)return;scheduled=true;
    requestAnimationFrame(()=>{
      scheduled=false;
      document.querySelectorAll('.zad-admin-panels .table-wrap table').forEach(labelTable);
    });
  };
  refresh();
  const observer=new MutationObserver(mutations=>{
    if(mutations.some(m=>m.type==='childList'))refresh();
  });
  observer.observe(container,{subtree:true,childList:true});
})();
