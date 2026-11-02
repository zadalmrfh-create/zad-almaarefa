/* Zad Al-Maarefa - Arabic/English name search (read-only matching).
 * Does not modify account names, Firestore documents or permissions.
 * Egyptian transliteration is approximate; exact aliases can be added later.
 */
(function (root) {
  'use strict';
  const AR_LETTERS = /[ء-ي]/u;
  const LATIN_LETTERS = /[a-z]/i;
  const transliterations = {
    'ب':'b','ت':'t','ث':'t','ج':'j','ح':'h','خ':'x',
    'د':'d','ذ':'z','ر':'r','ز':'z','س':'s','ش':'sh',
    'ص':'s','ض':'d','ط':'t','ظ':'z','ع':'','غ':'g',
    'ف':'f','ق':'k','ك':'k','ل':'l','م':'m','ن':'n',
    'ه':'h','و':'w','ي':'y','ى':'y','ة':'',
    'ا':'','أ':'','إ':'','آ':'','ء':'','ؤ':'w','ئ':'y','ٱ':''
  };
  function normalize(value) {
    return String(value == null ? '' : value).normalize('NFKD')
      .replace(/[\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g,'')
      .replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
      .replace(/[٠-٩]/g, ch => String(ch.charCodeAt(0)-0x660))
      .replace(/[۰-۹]/g, ch => String(ch.charCodeAt(0)-0x6f0))
      .replace(/[\u0300-\u036f]/g,'').toLowerCase()
      .replace(/\s+/g,' ').trim();
  }
  function keyOfToken(token) {
    token = normalize(token);
    if (!token || !/[a-zء-ي]/u.test(token)) return '';
    let out='';
    // Latin spellings -> approximate Arabic consonant key.
    if (LATIN_LETTERS.test(token) && !AR_LETTERS.test(token)) {
      token=token.replace(/sh|ch|kh|gh|th|dh|ph|ck|qu|ee|ei|ie|ai|ay|ou|oo|aw|au/g, m => ({
        sh:'$',ch:'$',kh:'X',gh:'G',th:'t',dh:'z',ph:'f',ck:'k',qu:'k',
        ee:'Y',ei:'Y',ie:'Y',ai:'Y',ay:'Y',ou:'W',oo:'W',aw:'W',au:'W'
      }[m]));
      const letters={a:'',e:'',o:'',u:'',i:'y',y:'y',
        b:'b',p:'b',c:'k',k:'k',q:'k',j:'j',g:'j',h:'h',t:'t',d:'d',
        r:'r',z:'z',s:'s',f:'f',v:'f',l:'l',m:'m',n:'n',w:'w',x:'x',
        '$':'sh','X':'x','G':'g','Y':'y','W':'w'};
      for (const ch of token) out += letters[ch] ?? '';
    } else {
      for(const ch of token) out += transliterations[ch] ?? (/[a-z]/.test(ch) ? ch : '');
    }
    // Repeated consonants commonly differ between English and Arabic spellings.
    return out.replace(/(sh|[a-z])\1+/g,'$1').replace(/hh/g,'h');
  }
  const tokenReg = /[a-z]+|[ء-ي]+/gu;
  function keys(value) {
    const text=normalize(value);
    return (text.match(tokenReg)||[]).map(keyOfToken).filter(Boolean);
  }
  function relatedToken(a,b) {
    if(a===b) return true;
    // Egyptian spellings often omit final alif-maqsura / taa-marbuta sounds.
    const trimEnding = value => value.length > 3 ? value.replace(/[hy]$/, '') : value;
    return (a.length>=3 && b.length>=3 && trimEnding(a)===trimEnding(b)) ||
      (b.length>=3 && a.startsWith(b));
  }
  function matches(haystack, query) {
    const q=normalize(query);
    if(!q) return true;
    const text=normalize(Array.isArray(haystack)?haystack.filter(v=>v!=null).join(' '):haystack);
    if(text.includes(q)) return true;
    // Do not invent phonetic matches for phone numbers or email/domain fragments.
    if(!/[a-zء-ي]/u.test(q) || q.includes('@') || /\d/.test(q)) return false;
    const needle=keys(q);
    const hay=keys(text);
    if(!needle.length || !hay.length) return false;
    const flat=needle.join('');
    if(flat.length<2) return false;
    if(needle.length===1 && flat.length===2) return hay.some(k=>k===flat);
    // Allows "عبد الرحمن" to match Abdelrahman, while maintaining name order.
    const joined=hay.join('');
    if(joined.includes(flat)) return true;
    // Allow intervening middle names in multiword searches.
    let at=0;
    for(const word of needle) {
      while(at<hay.length && !(word.length===2 ? hay[at]===word : relatedToken(hay[at],word))) at++;
      if(at===hay.length) return false;
      at++;
    }
    return true;
  }
  root.ZadNameSearch=Object.freeze({normalize, phoneticKey:keyOfToken, matches});
})(typeof window !== 'undefined' ? window : globalThis);
