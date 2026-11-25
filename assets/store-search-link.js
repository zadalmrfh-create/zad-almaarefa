/* Preserve a search result across login; never open a raw paid-content URL. */
const requested=new URL(location.href).searchParams.get('product');
if(requested&&/^[A-Za-z0-9_-]{1,150}$/.test(requested)){
  const banner=document.createElement('aside');banner.className='zad-search-bridge';banner.setAttribute('role','status');banner.style.cssText='padding:16px;margin:16px;border:1px solid #a78a44;border-radius:12px;background:#fff8dc;color:#24334a;line-height:1.8;font-family:inherit';
  banner.textContent='جارٍ التحقق من إتاحة المنتج الذي اخترته من البحث…';(document.querySelector('main')||document.body).prepend(banner);
  let opened=false,observer=null;
  const attempt=()=>{if(opened)return;const button=[...document.querySelectorAll('[data-detail]')].find(element=>element.dataset.detail===requested);if(!button)return;opened=true;observer?.disconnect();banner.remove();button.click();};
  observer=new MutationObserver(attempt);observer.observe(document.body,{childList:true,subtree:true});attempt();
  fetch(new URL('./search-index.json',import.meta.url)).then(response=>response.ok?response.json():null).then(data=>{if(opened)return;const record=data?.records?.find(item=>item.id==='product:'+requested);if(record)banner.textContent='المنتج المطلوب: '+record.title+' — جارٍ التحقق من إتاحته في المتجر.';}).catch(()=>{});
  setTimeout(()=>{if(opened)return;banner.replaceChildren();const text=document.createElement('p');text.textContent='المنتج الذي اخترته لم يظهر في الكتالوج المتاح لحسابك. قد يكون تحت التجهيز أو غير منشور حاليًا. يمكن إعادة تحميل الصفحة أو تصفح المتجر.';const link=document.createElement('a');link.href='index.html#catalog';link.textContent='تصفح المنتجات المتاحة';link.style.cssText='color:#164f8d;text-decoration:underline;font-weight:700';banner.append(text,link);},15000);
  setTimeout(()=>observer?.disconnect(),45000);
}
