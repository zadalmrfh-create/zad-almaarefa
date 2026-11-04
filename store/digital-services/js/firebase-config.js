// إعدادات Firebase العامة لتطبيق الويب الخاص بمشروع malek-digital-services.
// تم ربطها بكود الموقع مباشرةً؛ لا تلصق import من "firebase/app" داخل هذا الملف.
// لا تضع هنا مفاتيح service account أو رموز إدارة سرية.
export const firebaseConfig = {
  apiKey: 'AIzaSyDyKQXnJE28eBxLw4ggLOlN9YnNxw-I8Vo',
  authDomain: 'malek-digital-services.firebaseapp.com',
  projectId: 'malek-digital-services',
  storageBucket: 'malek-digital-services.firebasestorage.app',
  messagingSenderId: '59980548465',
  appId: '1:59980548465:web:a08c6e309d42b3dd208ed0',
  measurementId: 'G-YVGLS7XZHC'
};

// هذا يعني اكتمال إعدادات الاتصال فقط؛ يجب تفعيل Firestore وAuthentication.
export const configured = !Object.values(firebaseConfig).some(v => String(v).includes('REPLACE_WITH_'));
