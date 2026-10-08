document.addEventListener("DOMContentLoaded", () => {
 const API_BASE = (location.hostname === "zadalmrfh-create.github.io") ? "https://zad-almaarefa.vercel.app" : "";
 const $=id=>document.getElementById(id), panel=$("chat-box"),toggle=$("chat-toggle-btn"),messages=$("chat-messages"),form=$("chat-form"),input=$("chat-input"),submit=$("chat-submit");
 if(!panel||!toggle||!messages||!form||!input)return;
 let history=[],busy=false,controller=null,typingTimer=null;
 const bottom=()=>{messages.scrollTop=messages.scrollHeight;};
 function bubble(text,who="bot"){
   const line=document.createElement("div");line.className="zad-chat-line "+(who==="user"?"zad-chat-user":"zad-chat-bot");
   const block=document.createElement("div");block.className="zad-chat-bubble";block.dir="auto";block.textContent=text;
   line.append(block);messages.append(line);bottom();return {line,block};
 }
 function sources(items,heading){
  if(!items?.length)return;
  const wrap=document.createElement("div");wrap.className="zad-chat-sources";
  const title=document.createElement("strong");title.textContent=heading;wrap.append(title);
  for(const item of items){
   if(!item.url || !(item.url.startsWith("/sections/")||item.url.startsWith("https://drive.google.com/")||item.url.startsWith("https://docs.google.com/")))continue;
   const a=document.createElement("a");a.href=item.url;a.textContent="📖 "+item.title;a.target="_blank";a.rel="noopener noreferrer";wrap.append(a);
  }messages.append(wrap);bottom();
 }
 function setBusy(v){busy=v;submit.disabled=v;input.disabled=v;document.querySelectorAll("[data-chat-prompt]").forEach(b=>b.disabled=v);const s=$("chat-status");if(s)s.textContent=v?"جارٍ إعداد الرد…":"مساعد تعليمي — راجع المعلومات المهمة من مصادرك";}
 function reset(){controller?.abort();controller=null;clearInterval(typingTimer);history=[];messages.replaceChildren();bubble("السلام عليكم 👋 أنا مساعد زاد المعرفة. أقدر أشرح، أراجع معاك، أعمل تدريب قصير، وأساعدك تلاقي كتب وخدمات المنصة.");setBusy(false);input.value="";}
 function show(v){panel.classList.toggle("hidden",!v);toggle.setAttribute("aria-expanded",String(v));if(v){input.focus();bottom();}}
 toggle.addEventListener("click",()=>show(panel.classList.contains("hidden")));
 $("close-chat")?.addEventListener("click",()=>show(false));$("chat-new")?.addEventListener("click",()=>{reset();input.focus();});
 $("chat-expand")?.addEventListener("click",()=>{panel.classList.toggle("zad-chat-expanded");$("chat-expand").setAttribute("aria-label",panel.classList.contains("zad-chat-expanded")?"تصغير الشات":"تكبير الشات");});
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!panel.classList.contains("hidden"))show(false);});
 document.querySelectorAll("[data-chat-prompt]").forEach(b=>b.addEventListener("click",()=>{if(busy)return;input.value=b.dataset.chatPrompt;form.requestSubmit();}));
 // Direct, verified catalogue search without spending a Gemini request.
 async function localLibrary(question){
  const match=question.match(/^(?:ابحث(?: لي)? عن|دور(?: لي)? على)\s+(.+)/);
  if(!match)return false;
  const result=await fetch(API_BASE + "/api/library-search?q="+encodeURIComponent(match[1])).then(r=>r.ok?r.json():Promise.reject(new Error("تعذر البحث في فهرس المكتبة")));
  bubble(result.results.length?"لقيت الكتب دي في فهرس المنصة. اضغط على أي عنوان لفتحه:":"ملقتش كتاب مطابق في فهرس المنصة. جرّب اسم المادة أو الصف.");
  sources(result.results,"نتائج المكتبة");return true;
 }
 form.addEventListener("submit",async e=>{
  e.preventDefault();if(busy)return;const q=input.value.trim();if(!q||q.length>2000)return;
  bubble(q,"user");input.value="";setBusy(true);controller=new AbortController();const current=controller;const timeout=setTimeout(()=>current.abort(),35000);
  let pending=null;
  try{
   if(await localLibrary(q))return;
   pending=bubble("جارٍ التفكير في إجابتك…");
   const response=await fetch(API_BASE + "/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:q,history:history.slice(-10)}),signal:current.signal});
   const data=await response.json().catch(()=>({}));pending.line.remove();pending=null;
   if(!response.ok||!data.reply)throw new Error(data.error||"تعذر الحصول على رد، حاول مرة أخرى.");
   const reply=String(data.reply).slice(0,14000);const result=bubble("");
   // Progressive readable rendering (no HTML evaluation).
   if(window.matchMedia("(prefers-reduced-motion: reduce)").matches||reply.length>1800){result.block.textContent=reply;bottom();}
   else await new Promise(resolve=>{let n=0;typingTimer=setInterval(()=>{n=Math.min(reply.length,n+Math.max(9,Math.ceil(reply.length/90)));result.block.textContent=reply.slice(0,n);bottom();if(n>=reply.length){clearInterval(typingTimer);typingTimer=null;resolve();}},18);});
   sources(data.sources,"كتب مرتبطة بالسؤال");sources(data.excerpts,"ملخصات مرتبطة");
   history.push({role:"user",text:q},{role:"model",text:reply});if(history.length>10)history=history.slice(-10);
  }catch(err){pending?.line.remove();bubble(err.name==="AbortError"?"الطلب استغرق وقتًا أطول من المتوقع. حاول مجددًا.":err.message==="Failed to fetch"?"تعذر الاتصال بالسيرفر، تأكد إنه شغال.":err.message);}
  finally{clearTimeout(timeout);clearInterval(typingTimer);typingTimer=null;controller=null;setBusy(false);input.focus();}
 });
 reset();toggle.setAttribute("aria-expanded","false");
});
