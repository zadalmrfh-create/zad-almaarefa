import {ADMIN_EMAIL,db} from '../firebase-config.js';
import {doc,getDocFromServer} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

export async function isStudentReviewer(user){
 if(!user)return false;
 if(user.emailVerified&&user.email?.toLowerCase()===ADMIN_EMAIL.toLowerCase())return false;

 const account=await getDocFromServer(doc(db,'users',user.uid));
 if(account.data()?.role!=='student')return false;

 // Older admin accounts can retain a student profile with a separate admin record.
 const admin=await getDocFromServer(doc(db,'admins',user.uid));
 return !admin.exists();
}
