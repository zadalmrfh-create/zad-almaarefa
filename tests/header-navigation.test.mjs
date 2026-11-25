import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const script = fs.readFileSync(new URL('../assets/header-navigation.js', import.meta.url), 'utf8');
const homepage = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const primary = ['#hero', '#categories', './sections/library.html', './teachers/index.html'];
const secondary = ['./events/events.html', './sections/services/services.html', './students/students.html', './reviews/index.html', './sections/payment-policy.html'];

function fixture() {
  const listeners = new Map();
  function node(tag, href) {
    const n = {tag, href, children: [], dataset: {}, attrs: {}, hidden:false,
      classList:{add(){}}, setAttribute(k,v){this.attrs[k]=v;}, getAttribute(k){return k==='href'?this.href:this.attrs[k];},
      addEventListener(type,fn){listeners.set(this, [...(listeners.get(this)||[]),[type,fn]]);},
      append(...nodes){for(const child of nodes){if(child.parent) child.parent.children=child.parent.children.filter(x=>x!==child); child.parent=this;this.children.push(child);}},
      contains(other){return this===other||this.children.some(x=>x.contains(other));},
      querySelector(sel){return this.children.find(x=>sel==='a'?x.tag==='a':x.tag==='label')||null;},
      focus(){document.activeElement=this;emit(document,'focusin',{target:this});},
      insertBefore(child,ref){child.parent=this;this.children.splice(this.children.indexOf(ref),0,child);}
    };return n;
  }
  function emit(target,type,event={}){for(const [name,fn] of listeners.get(target)||[])if(name===type)fn(event);}
  const header=node('header'), nav=node('nav'), outside=node('button'), body=node('body');
  const links=[...primary,...secondary].map(h=>node('a',h));nav.append(...links,node('label'));header.append(nav);nav.querySelectorAll=()=>nav.children.filter(x=>x.tag==='a');
  const document={...node('document'),readyState:'complete',activeElement:body,getElementById:()=>header,querySelector:s=>s==='#navbar .nav-links'?nav:null,createElement:node};
  vm.runInNewContext(script,{document,window:{matchMedia:()=>({addEventListener(){}})},queueMicrotask});
  const group=nav.children.find(x=>x.className==='zad-nav-more');const [trigger,menu]=group.children;
  return {document,body,group,trigger,menu,outside,emit};
}

test('More links remain visible during a native focus transfer and close on outside interaction', async()=>{
  const {document,body,group,trigger,menu,outside,emit}=fixture();
  assert.deepEqual(menu.children.map(x=>x.href),secondary);
  trigger.focus();emit(trigger,'click');assert.equal(menu.hidden,false);
  for(const link of menu.children){
    document.activeElement=body;
    emit(group,'focusout',{target:trigger,relatedTarget:link});
    await Promise.resolve();
    assert.equal(menu.hidden,false,'must not hide before link focus/click');
    link.focus();emit(document,'click',{target:link});assert.equal(menu.hidden,false);
  }
  outside.focus();assert.equal(menu.hidden,true);
  trigger.focus();emit(trigger,'click');emit(document,'click',{target:outside});assert.equal(menu.hidden,true);
});

test('More keyboard navigation opens, focuses first link and Escape restores trigger',()=>{
  const {document,group,trigger,menu,emit}=fixture();
  emit(trigger,'keydown',{key:'ArrowDown',preventDefault(){}});
  assert.equal(menu.hidden,false);assert.equal(document.activeElement,menu.children[0]);
  emit(group,'keydown',{key:'Escape',preventDefault(){}});
  assert.equal(menu.hidden,true);assert.equal(document.activeElement,trigger);
});

test('all five destinations exist in the original homepage and project',()=>{
  for(const href of secondary){assert.ok(homepage.includes(`href="${href}"`));assert.ok(fs.existsSync(new URL('../'+href.slice(2),import.meta.url)));}
});
