import {SEARCH_TYPES,prepareSearchRecords,searchRecords,searchFacets} from './search-core.js';
const root=document.getElementById('zadGlobalSearch');
if(root)mountSearch(root);
export function mountSearch(container){
  const dialog=container.closest('dialog'),launcher=document.getElementById('globalSearchBtn');
  let records=null,loading=false,limit=24,timer=0,opener=null;
  const node=(tag,content,className)=>{const element=document.createElement(tag);if(content!==undefined)element.textContent=content;if(className)element.className=className;return element;};
  container.classList.add('zad-discovery');
  const header=node('header',undefined,'zad-discovery-head'),heading=node('div');
  const kicker=node('p','ابحث داخل زاد المعرفة','zad-discovery-kicker');const title=node('h2','كل ما تحتاجه في مكان واحد');title.id='zadGlobalSearchTitle';
  const subtitle=node('p','ابحث بالعنوان أو المادة، ثم اختَر الصف ونوع المحتوى.','zad-discovery-description');heading.append(kicker,title,subtitle);
  const close=node('button','إغلاق','zad-discovery-button secondary');close.type='button';close.setAttribute('aria-label','إغلاق البحث');close.addEventListener('click',()=>dialog?.close());header.append(heading,close);
  const form=node('form',undefined,'zad-discovery-form');form.setAttribute('role','search');
  const searchLabel=node('label','كلمات البحث');searchLabel.htmlFor='zadDiscoveryQuery';
  const input=node('input');input.type='search';input.id='zadDiscoveryQuery';input.maxLength=180;input.autocomplete='off';input.placeholder='مثال: فيزياء الثاني الثانوي';
  const searchRow=node('div',undefined,'zad-discovery-query');const submit=node('button','بحث','zad-discovery-button');submit.type='submit';searchRow.append(input,submit);
  const filters=node('div',undefined,'zad-discovery-filters');
  function select(labelText,id,allLabel){const label=node('label',labelText),control=node('select');control.id=id;label.htmlFor=id;const all=node('option',allLabel);all.value='';control.append(all);label.append(control);filters.append(label);return control;}
  const subject=select('المادة','zadDiscoverySubject','كل المواد'),grade=select('الصف','zadDiscoveryGrade','كل الصفوف'),type=select('نوع المحتوى','zadDiscoveryType','كل الأنواع');
  for(const [value,label] of Object.entries(SEARCH_TYPES)){const option=node('option',label);option.value=value;type.append(option);}
  const clear=node('button','مسح البحث والفلاتر','zad-discovery-reset');clear.type='reset';form.append(searchLabel,searchRow,filters,clear);
  const status=node('p','اكتب كلمات البحث لعرض المحتوى المفهرس.','zad-discovery-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const results=node('div',undefined,'zad-discovery-results');results.id='zadDiscoveryResults';
  const more=node('button','عرض المزيد','zad-discovery-button secondary');more.type='button';more.hidden=true;
  const retry=node('button','إعادة تحميل الفهرس','zad-discovery-button secondary');retry.type='button';retry.hidden=true;
  const note=node('p','نتائج من محتوى المنصة المنشور في ملفاتها. تفاصيل الإتاحة والاشتراك تظهر في صفحة المحتوى.','zad-discovery-note');
  container.replaceChildren(header,form,status,retry,results,more,note);
  function draw(){if(!records)return;const found=searchRecords(records,{query:input.value,subject:subject.value,grade:grade.value,type:type.value});results.replaceChildren();status.textContent=found.length?`${found.length.toLocaleString('ar-EG')} نتيجة مطابقة${found.length>limit?' — يُعرض أول '+limit.toLocaleString('ar-EG'):''}`:'لا توجد نتائج مطابقة. جرّب كلمات أقل أو غيّر الفلاتر.';more.hidden=found.length<=limit;
    const visible=found.slice(0,limit);
    for(const [kind,label] of Object.entries(SEARCH_TYPES)){const items=visible.filter(x=>x.type===kind);if(!items.length)continue;const section=node('section',undefined,'zad-discovery-group');section.append(node('h3',label));const grid=node('div',undefined,'zad-discovery-grid');
      for(const item of items){const card=node('a',undefined,'zad-discovery-result');card.href=item.href;card.append(node('span',label,'zad-discovery-tag'),node('h4',item.title));const meta=[...new Set([item.subject,item.grade].filter(Boolean))].join(' · ');if(meta)card.append(node('p',meta,'zad-discovery-meta'));if(item.description)card.append(node('p',item.description,'zad-discovery-description'));const action=item.access==='store'?'عرض في المتجر':item.access==='protected-gateway'?'فتح بوابة الملف':item.access==='teacher'?'عرض المعلم والحجز':'فتح الاختبار';card.append(node('span',action,'zad-discovery-result-action'));grid.append(card);}
      section.append(grid);results.append(section);
    }
  }
  async function load(){if(loading)return;if(records){draw();return;}loading=true;retry.hidden=true;container.setAttribute('aria-busy','true');status.textContent='جارٍ تحميل فهرس المحتوى…';
    const request=new AbortController(),timeout=setTimeout(()=>request.abort(),15000);
    try{const response=await fetch(new URL('./search-index.json',import.meta.url),{cache:'no-cache',signal:request.signal});if(!response.ok)throw Error('Index unavailable');const data=await response.json();if(data.version!==1||!Array.isArray(data.records))throw Error('Invalid index');records=prepareSearchRecords(data.records);const facets=searchFacets(records);for(const [control,values]of [[subject,facets.subjects],[grade,facets.grades]]){for(const value of values){const option=node('option',value);option.value=value;control.append(option);}}draw();}
    catch{status.textContent='تعذر تحميل فهرس البحث. تحقق من الاتصال ثم أعد المحاولة.';retry.hidden=false;results.replaceChildren();more.hidden=true;}
    finally{clearTimeout(timeout);loading=false;container.removeAttribute('aria-busy');}
  }
  function open(){
    const mobile=document.getElementById('mobile-overlay');
    const inDrawer=mobile?.classList.contains('open');
    opener=inDrawer?document.getElementById('hamBtn'):document.activeElement;
    const reveal=()=>{if(dialog&&!dialog.open)dialog.showModal();launcher?.setAttribute('aria-expanded','true');load();input.focus();};
    if(inDrawer&&typeof window.closeMob==='function'){window.closeMob();queueMicrotask(reveal);}else reveal();
  }
  if(launcher){launcher.setAttribute('aria-controls','zadGlobalSearchDialog');launcher.setAttribute('aria-haspopup','dialog');launcher.setAttribute('aria-expanded','false');}
  launcher?.addEventListener('click',open);
  window.addEventListener('zad:open-search',open);
  dialog?.addEventListener('close',()=>{launcher?.setAttribute('aria-expanded','false');if(opener instanceof HTMLElement&&opener.isConnected)opener.focus();});
  dialog?.addEventListener('click',event=>{if(event.target===dialog){const bounds=dialog.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dialog.close();}});
  document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();open();}});
  form.addEventListener('submit',event=>{event.preventDefault();limit=24;records?draw():load();});
  input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{limit=24;draw();},150);});
  for(const control of [subject,grade,type])control.addEventListener('change',()=>{limit=24;draw();});
  form.addEventListener('reset',()=>{queueMicrotask(()=>{limit=24;draw();input.focus();});});
  more.addEventListener('click',()=>{limit+=24;draw();});retry.addEventListener('click',load);
  if(!dialog)load();
  return {open};
}
