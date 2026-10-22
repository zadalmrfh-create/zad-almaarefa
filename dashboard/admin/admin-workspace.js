/* Zad Al-Maarefa admin workspace: real independent tabs, responsive data tables */
(() => {
  const main = document.querySelector('main');
  const quickNav = document.querySelector('#adminQuickNav');
  if (!main || !quickNav) return;

  const groups = [
    {id:'home',label:'نظرة عامة',icon:'🏠',sections:['platformAnalytics','studentCounterManagement']},
    {id:'users',label:'المستخدمون',icon:'👥',sections:['usersManagement']},
    {id:'bookings',label:'الحجوزات',icon:'📅',sections:['bookingsManagement']},
    {id:'exams',label:'الامتحانات',icon:'📝',sections:['codeExamsManagement','adminCertificatesSection','codeExamResultsSection']},
    {id:'library',label:'المكتبة',icon:'📚',sections:['libraryDownloadTracking']},
    {id:'lessons',label:'الحضور والغياب',icon:'✅',sections:['attendanceManagement']},
    {id:'payments',label:'المدفوعات',icon:'💳',sections:['zadVodafoneAdminPanel']},
    {id:'content',label:'المحتوى',icon:'⚙️',sections:['contentManagement']},
    {id:'logs',label:'سجلات وتقارير',icon:'📊',sections:['loginLogsManagement']},
    {id:'other',label:'الإشعارات والمزيد',icon:'🔔',sections:[]}
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
      if(el.classList.contains('notifications-admin-card') || el.id==='zad-study-inbox') group=groups.find(x=>x.id==='other');
      else group=groups.find(x=>x.id==='other');
    }
    group.panel.append(el);
  }
  quickNav.insertAdjacentElement('afterend',tabs);
  tabs.insertAdjacentElement('afterend',container);

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
      setTimeout(()=>el.scrollIntoView({behavior:'smooth',block:'start'}),0);
    }
  }));
  const initial=location.hash.startsWith('#panel-')?location.hash.slice(7):null;
  activate(initial,false);

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
