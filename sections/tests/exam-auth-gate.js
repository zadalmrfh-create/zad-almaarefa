// توحيد حماية الامتحانات مع الحماية العامة للمكتبة والمحتوى الدراسي.
// لا يبدأ الامتحان إلا بعد تأكيد Firebase Auth لوجود مستخدم فعلي.
export { protectedContentReady as examAuthReady } from '../../assets/content-auth-guard.js';
