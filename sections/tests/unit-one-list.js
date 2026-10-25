const box=document.getElementById('unitOneExams');
if(box){try{
 const bank=await fetch('../../exams/unit1/bank.json').then(r=>{if(!r.ok)throw Error('تعذر تحميل بنك الوحدة الأولى');return r.json()});
 for(const x of bank.exams){const card=document.createElement('article');card.className='card';const title=document.createElement('h2');title.textContent=x.title;const p=document.createElement('p');p.textContent=x.scope+' · 30 سؤالًا · 60 دقيقة';const a=document.createElement('a');a.textContent='ابدأ امتحان الوحدة الأولى ←';a.href='unit-one-exam.html?id='+encodeURIComponent(x.id);card.append(title,p,a);box.appendChild(card);}
}catch(e){box.textContent='تعذر تحميل امتحانات الوحدة الأولى: '+e.message}}
