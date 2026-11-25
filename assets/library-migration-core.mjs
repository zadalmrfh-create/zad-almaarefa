/** Pure routing/schema helpers. No Firebase calls and no private URLs in public indexes. */
export const MIGRATION_COLLECTION = 'libraryMigrationMappings';
export const MIGRATION_VERSION = 1;
export const MAX_LIBRARY_PDF_BYTES = 30 * 1024 * 1024;
export const INTERNAL_LIBRARY_BASE = 'https://zad-library.invalid/';
export const ACCESS_LABELS = Object.freeze({unclassified:'غير مصنّف',free:'مجاني',protected:'مدفوع محمي'});
const KEY_PATTERN = /^[a-f0-9]{64}$/;
const BOOK_PATTERN = /^[a-zA-Z0-9_-]{6,150}$/;

export function isLibraryOwner(user, ownerEmail) {
  return Boolean(user && !user.isAnonymous && user.emailVerified === true
    && typeof ownerEmail === 'string' && ownerEmail.trim()
    // Match the existing Storage token comparison exactly; an admin role alone
    // must not unlock an upload form that Storage would reject.
    && String(user.email || '') === ownerEmail);
}

export function safeLegacyUrl(value, baseUrl) {
  if (typeof value !== 'string' || !value.trim() || value.length > 4096) throw new Error('رابط المصدر غير صالح.');
  let url;
  try { url = new URL(value.trim(), baseUrl); } catch { throw new Error('رابط المصدر غير صالح.'); }
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password) throw new Error('الرابط يجب أن يكون HTTP أو HTTPS دون بيانات دخول.');
  return url.href;
}

export function normalizeLegacyUrl(value, baseUrl) {
  const base = new URL(baseUrl || INTERNAL_LIBRARY_BASE);
  const url = new URL(safeLegacyUrl(value, base));
  url.hash = '';
  if (url.hostname.toLowerCase() === 'drive.google.com') {
    const pathId = url.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1];
    const queryId = /^\/(?:open|uc)$/.test(url.pathname) ? url.searchParams.get('id') : null;
    const id = pathId || queryId;
    if (id && /^[A-Za-z0-9_-]+$/.test(id)) return `https://drive.google.com/file/d/${id}`;
  }
  // Static PDFs keep the same identity with page fragments and tracking queries.
  // The original URL is kept only by the owner / legacy request, not by this key.
  if (/\.pdf$/i.test(url.pathname)) url.search = '';
  // The key of a project-relative path must survive localhost, custom domains,
  // and a GitHub Pages project prefix. The sentinel is an identity, never opened.
  if (url.origin === base.origin) {
    const rootPath = base.pathname.endsWith('/') ? base.pathname : new URL('.',base).pathname;
    const relativePath = url.pathname.startsWith(rootPath) ? url.pathname.slice(rootPath.length) : url.pathname.replace(/^\//,'');
    const canonical = new URL(relativePath,INTERNAL_LIBRARY_BASE);
    canonical.search = url.search;
    return canonical.href;
  }
  return url.href;
}

export async function legacyKeyForUrl(value, baseUrl, cryptoApi = globalThis.crypto) {
  if (!cryptoApi?.subtle) throw new Error('يلزم HTTPS أو localhost لحساب معرّف المصدر الآمن.');
  const bytes = new TextEncoder().encode(normalizeLegacyUrl(value, baseUrl));
  const digest = await cryptoApi.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2,'0')).join('');
}

export function validLegacyKey(value) { return KEY_PATTERN.test(String(value || '')); }
export function validProtectedBookId(value) { return BOOK_PATTERN.test(String(value || '')); }

export function validateMigrationMapping(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('تصنيف المصدر غير صالح.');
  const allowed = ['version','kind','bookId','freeTarget','title','updatedAt','updatedBy'];
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error('يحتوي التصنيف على حقول غير مسموح بها.');
  if (allowed.some(key => !Object.hasOwn(value,key)) || typeof value.updatedBy !== 'string' || !value.updatedBy || value.updatedAt == null) throw new Error('بيانات حفظ التصنيف غير مكتملة.');
  if (value.version !== MIGRATION_VERSION || !Object.hasOwn(ACCESS_LABELS,value.kind)) throw new Error('إصدار التصنيف أو نوعه غير صالح.');
  if (typeof value.title !== 'string' || value.title.trim().length < 2 || value.title.length > 180) throw new Error('عنوان الكتاب يجب أن يكون من حرفين إلى 180 حرفًا.');
  if (typeof value.bookId !== 'string' || typeof value.freeTarget !== 'string') throw new Error('حقول الربط غير مكتملة.');
  if (value.kind === 'protected') {
    if (!validProtectedBookId(value.bookId) || value.freeTarget !== '') throw new Error('الكتاب المحمي يحتاج معرّفًا صالحًا، ولا يقبل رابط ملف مباشر.');
  } else if (value.kind === 'free') {
    if (value.bookId !== '' || value.freeTarget.length > 2048) throw new Error('بيانات المورد المجاني غير صالحة.');
    const target = new URL(safeLegacyUrl(value.freeTarget));
    if (/\/sections\/(?:book-access|book)\.html$/i.test(target.pathname)) throw new Error('اختر رابط المصدر المجاني، وليس صفحة التحقق نفسها.');
  } else if (value.bookId !== '' || value.freeTarget !== '') {
    throw new Error('الكتاب غير المصنّف لا يقبل رابطًا عامًا أو معرّف كتاب محمي.');
  }
  return value;
}

export function buildMigrationMapping({kind,title,bookId='',freeTarget=''}, updatedBy, updatedAt) {
  const value = {version:MIGRATION_VERSION,kind,title:String(title || '').trim(),
    bookId:kind === 'protected' ? String(bookId).trim() : '',
    freeTarget:kind === 'free' ? safeLegacyUrl(String(freeTarget).trim()) : '',
    updatedBy:String(updatedBy || ''),updatedAt};
  validateMigrationMapping(value);
  if (!value.updatedBy) throw new Error('يلزم حساب المالك لحفظ التصنيف.');
  return value;
}

export function assertMigrationTransition(previous, next) {
  validateMigrationMapping(next);
  if (previous?.kind === 'protected' && next.kind === 'unclassified') {
    throw new Error('لا يمكن إعادة كتاب محمي إلى غير مصنّف. اترك الربط المحمي أو صنّفه مجانيًا بقرار صريح.');
  }
}

/** A lookup error must be handled by the caller; never pass errors as null mappings. */
export function resolveLibraryRoute({mapping=null,legacyUrl='',bookId='',hasSession=false,isSubscribed=false}) {
  if (!hasSession) return {kind:'login'};
  if (bookId) {
    if (!validProtectedBookId(bookId)) return {kind:'denied',reason:'invalid-book'};
    return isSubscribed ? {kind:'protected',bookId} : {kind:'payment'};
  }
  if (mapping) {
    try { validateMigrationMapping(mapping); } catch { return {kind:'denied',reason:'invalid-mapping'}; }
    if (mapping.kind === 'protected') return isSubscribed ? {kind:'protected',bookId:mapping.bookId} : {kind:'payment'};
    if (mapping.kind === 'free') return {kind:'free',url:mapping.freeTarget};
  }
  // Unclassified legacy links keep the previous subscription requirement.
  // A hash-only link cannot reconstruct an unpublished/private source URL.
  if (!legacyUrl) return {kind:'denied',reason:'unclassified'};
  let safe;
  try { safe = safeLegacyUrl(legacyUrl); } catch { return {kind:'denied',reason:'invalid-url'}; }
  return isSubscribed ? {kind:'legacy',url:safe} : {kind:'payment'};
}

export async function validateLibraryPdf(file) {
  if (!file || !Number.isFinite(file.size) || file.size < 5 || file.size > MAX_LIBRARY_PDF_BYTES
      || !/\.pdf$/i.test(String(file.name || '')) || typeof file.slice !== 'function') {
    throw new Error('اختر ملف PDF صالحًا بحجم لا يتجاوز 30 ميجابايت.');
  }
  const bytes = new Uint8Array(await file.slice(0,5).arrayBuffer());
  if (String.fromCharCode(...bytes) !== '%PDF-') throw new Error('محتوى الملف لا يبدو PDF صالحًا.');
}

export async function buildLegacyInventory(records, baseUrl, cryptoApi = globalThis.crypto) {
  const groups = new Map();
  let skipped = 0;
  for (const record of records) {
    const title = String(record?.title || record?.name || '').trim().slice(0,180);
    if (!title) {skipped++;continue;}
    try {
      const url = safeLegacyUrl(String(record.url || record.link || ''),baseUrl || INTERNAL_LIBRARY_BASE);
      const key = await legacyKeyForUrl(url,baseUrl || INTERNAL_LIBRARY_BASE,cryptoApi);
      const source = String(record.source || 'مصدر محلي').slice(0,100);
      const existing = groups.get(key);
      if (existing) {
        if (!existing.titles.includes(title)) existing.titles.push(title);
        if (!existing.sources.includes(source)) existing.sources.push(source);
      } else groups.set(key,{key,title,url,titles:[title],sources:[source]});
    } catch {skipped++;}
  }
  return {items:[...groups.values()],skipped};
}

/** Safe export / dry-run metadata: intentionally omits URLs and full source text. */
export function inventoryMetadata(items, mappings = new Map(), mappingSnapshotComplete = false) {
  return items.map(item => {
    const mapping = mappings.get(item.key);
    return {legacyKey:item.key,title:item.title,aliases:[...item.titles],sources:[...item.sources],
      classification:mapping?.kind || (mappingSnapshotComplete?'unclassified':'not-checked'),bookId:mapping?.kind==='protected'?mapping.bookId:''};
  });
}
