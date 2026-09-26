from pathlib import Path
import re

# Firestore: school admins and tutors must be scoped to their own school/assignments.
p = Path('firestore.rules')
s = p.read_text()
s = re.sub(r"    function isSameSchool\(schoolId\) \{.*?\n    \}\n    function isOwnStudent", """    function isSameSchool(schoolId) {
      return isAuth() && schoolId != null && schoolId != '' && (
        isSuperAdmin() ||
        schoolId == request.auth.uid ||
        schoolId == userSchoolId() ||
        (exists(/databases/$(database)/documents/schools/$(schoolId)) && (
          get(/databases/$(database)/documents/schools/$(schoolId)).data.get('email', '') == request.auth.token.email ||
          get(/databases/$(database)/documents/schools/$(schoolId)).data.get('contactEmail', '') == request.auth.token.email ||
          get(/databases/$(database)/documents/schools/$(schoolId)).data.get('adminUid', '') == request.auth.uid ||
          get(/databases/$(database)/documents/schools/$(schoolId)).data.get('firebaseUid', '') == request.auth.uid ||
          get(/databases/$(database)/documents/schools/$(schoolId)).data.get('userId', '') == request.auth.uid
        )) || hasStaffSchoolAccess(schoolId)
      );
    }
    function isOwnStudent""", s, count=1, flags=re.S)

student_rule = """    match /{collection}/{studentId} {
      allow read: if isSuperAdmin() || isOwnStudent(resource.data) || isOwnParent(resource.data) ||
        (isSchoolUser() && isSameSchool(resource.data.get('schoolId', null))) ||
        (isStaffOrTutor() && (hasStaffSchoolAccess(resource.data.get('schoolId', null)) || isAssignedStaffToStudent(studentId)));
      allow create: if isSuperAdmin() ||
        (isSchoolUser() && isSameSchool(request.resource.data.get('schoolId', null))) ||
        (isStaffOrTutor() && isAssignedStaffToStudent(studentId));
      allow update: if isSuperAdmin() ||
        (isSchoolUser() && isSameSchool(resource.data.get('schoolId', null)) && isSameSchool(request.resource.data.get('schoolId', null))) ||
        (isStaffOrTutor() && isAssignedStaffToStudent(studentId));
      allow delete: if isSuperAdmin() || (isSchoolUser() && isSameSchool(resource.data.get('schoolId', null)));
    }
"""
for collection in ('individualStudents', 'students'):
    s = re.sub(rf"    match /{collection}/\{{studentId\}} \{{.*?\n    \}}\n    match /", student_rule.replace('/{collection}', f'/{collection}') + '    match /', s, count=1, flags=re.S)
p.write_text(s)

# Scoped roster endpoint used by school admins and tutors.
Path('netlify/functions/school-students.ts').write_text(r'''import type { Handler } from '@netlify/functions';
import { adminAuth, adminDb } from '../../api/_lib/firebase-admin';
const json = (statusCode:number, body:Record<string,unknown>) => ({ statusCode, headers:{'Content-Type':'application/json','Cache-Control':'no-store'}, body:JSON.stringify(body) });
const bearer=(e:any)=>{const h=e.headers?.authorization||e.headers?.Authorization||'';return h.startsWith('Bearer ')?h.slice(7):''};
const blocked=(v:unknown)=>['SUSPENDED','BANNED','DISABLED'].includes(String(v||'ACTIVE').toUpperCase());
const adminRoles=['admin','super_admin','content_admin','education_admin','services_admin','marketing_admin','support_admin'];
const staffRoles=['staff','tutor','instructor','teacher'];
const serialise=(d:any)=>({fullName:d.fullName||d.studentName||d.name||'',username:d.username||'',email:d.email||null,class:d.class||d.grade||'',track:d.track||'',schoolId:d.schoolId||null,schoolName:d.schoolName||d.school||'',parentId:d.parentId||null,tutorId:d.tutorId||d.assignedTutorId||d.instructorId||null,staffId:d.staffId||d.assignedStaffId||null,portalAccessEnabled:d.portalAccessEnabled!==false,accountStatus:d.accountStatus||d.status||'ACTIVE'});
export const handler:Handler=async event=>{if(event.httpMethod!=='GET')return json(405,{error:'Method Not Allowed'});try{const token=bearer(event);if(!token)return json(401,{error:'Authentication required.'});const decoded=await adminAuth.verifyIdToken(token);const callerSnap=await adminDb.collection('users').doc(decoded.uid).get();if(!callerSnap.exists)return json(403,{error:'Portal profile not found.'});const caller=callerSnap.data()||{};const role=String(caller.role||'').toLowerCase();if(blocked(caller.accountStatus||caller.status))return json(403,{error:'Your account is not active.'});const isAdmin=adminRoles.includes(role),isSchool=role==='school',isStaff=staffRoles.includes(role);if(!isAdmin&&!isSchool&&!isStaff)return json(403,{error:'Not authorised.'});const requested=String(event.queryStringParameters?.schoolId||'').trim();let schoolIds:string[]=[];
if(isAdmin){schoolIds=requested?[requested]:(await adminDb.collection('schools').limit(500).get()).docs.map(d=>d.id)}
else if(isSchool){let sid=String(caller.schoolId||caller.school_id||caller.schoolDocId||'').trim();if(!sid){const sd=await adminDb.collection('schools').doc(decoded.uid).get();if(sd.exists)sid=sd.id}if(!sid){const email=String(caller.email||decoded.email||'').toLowerCase();if(email){const a=await adminDb.collection('schools').where('contactEmail','==',email).limit(1).get();const b=a.empty?await adminDb.collection('schools').where('email','==',email).limit(1).get():a;if(!b.empty)sid=b.docs[0].id}}if(!sid)return json(403,{error:'School account is not linked to a school.'});if(requested&&requested!==sid)return json(403,{error:'You can only view your school.'});schoolIds=[sid]}
else{const a=await adminDb.collection('staffSchoolAccess').doc(decoded.uid).get();const d=a.exists?a.data()||{}:{};schoolIds=[...(Array.isArray(d.schoolIds)?d.schoolIds.map(String):[]),...(d.schoolId?[String(d.schoolId)]:[]),...(caller.schoolId?[String(caller.schoolId)]:[])];schoolIds=[...new Set(schoolIds.filter(Boolean))];if(requested){if(!schoolIds.includes(requested))return json(403,{error:'You are not assigned to this school.'});schoolIds=[requested]}}
const students=new Map<string,any>();const add=(id:string,d:any,source:string)=>{if(!students.has(id))students.set(id,{id,studentId:id,collection:source,...serialise(d)})};
for(const sid of schoolIds){for(const c of ['individualStudents','students']){const snap=await adminDb.collection(c).where('schoolId','==',sid).limit(500).get();snap.docs.forEach(x=>add(x.id,x.data(),c))}const us=await adminDb.collection('users').where('schoolId','==',sid).limit(500).get();us.docs.forEach(x=>{const d=x.data()||{};if(['STUDENT','SCHOLAR','CADET'].includes(String(d.role||'').toUpperCase())||d.studentDocId)add(String(d.studentDocId||x.id),{...d,firebaseUid:x.id},'users')})}
if(isStaff){for(const c of ['individualStudents','students']){for(const field of ['tutorId','staffId','assignedTutorId','assignedStaffId','instructorId']){const snap=await adminDb.collection(c).where(field,'==',decoded.uid).limit(500).get();snap.docs.forEach(x=>add(x.id,x.data(),c))}}}
return json(200,{schoolIds,count:students.size,students:[...students.values()].filter(x=>!blocked(x.accountStatus)).sort((a,b)=>String(a.fullName).localeCompare(String(b.fullName)))});}catch(e){console.error(e);return json(500,{error:'Unable to load the authorised student roster.'})}};
''')

# Credential issuance: teaching staff may issue for students in assigned school(s) or directly assigned private students.
p=Path('netlify/functions/student-credential-issue.ts');s=p.read_text();s=s.replace("const isAssigned = (student: any, uid: string) => [student.tutorId, student.staffId, student.assignedTutorId, student.assignedStaffId, student.instructorId].some(value => String(value || '') === uid);", "const isAssigned = (student: any, uid: string) => [student.tutorId, student.staffId, student.assignedTutorId, student.assignedStaffId, student.instructorId].some(value => String(value || '') === uid) || (Array.isArray(student.assignedTutors) && student.assignedTutors.some((t:any)=>String(t?.tutorId||'')===uid||String(t?.staffId||'')===uid));\nconst hasSchoolAccess = async (uid:string, schoolId:string) => { if(!schoolId) return false; const snap=await adminDb.collection('staffSchoolAccess').doc(uid).get(); if(!snap.exists) return false; const d=snap.data()||{}; const ids=Array.isArray(d.schoolIds)?d.schoolIds.map(String):[]; if(d.schoolId) ids.push(String(d.schoolId)); return ids.includes(String(schoolId)); };")
s=s.replace("if (isTeachingStaff && !isAssigned(student, decoded.uid)) return json(403, { error: 'You can only issue credentials for students assigned to you.' });", "if (isTeachingStaff && !isAssigned(student, decoded.uid) && !(await hasSchoolAccess(decoded.uid, String(student.schoolId || '').trim()))) return json(403, { error: 'You can only issue credentials for students in your assigned school(s) or students assigned to you.' });")
p.write_text(s)

# Credential UI: never preload the unrestricted billing roster.
p=Path('src/pages/portal/StudentCredentialCenter.tsx');s=p.read_text();s=s.replace("import { billingGet, billingPost } from '../../lib/billing';","import { billingPost } from '../../lib/billing';");s=re.sub(r"      // 1\. Fetch from billing-data.*?      // 2\. Fetch from school-students endpoint if school role or context", "      // Load only the authorised school/tutor roster.\n      // 1. Fetch from scoped school-students endpoint", s, count=1, flags=re.S);s=s.replace("if (combinedMap.size === 0) {","if (combinedMap.size === 0 && isSchool) {");s=re.sub(r',\s*Sparkles(?=\s*[,}])','',s);s=re.sub(r'<Sparkles\b[^>]*/>','',s);p.write_text(s)

# Sidebar: narrower expanded width and stable rows.
p=Path('src/components/portal/PortalLayout.tsx');s=p.read_text();s=s.replace('sidebarExpanded ? 260 : 80','sidebarExpanded ? 220 : 72');s=s.replace('items-center h-10 px-2.5 rounded-xl transition-colors','items-center h-10 shrink-0 px-2.5 rounded-xl transition-colors');s=s.replace('items-center h-10 px-2.5 rounded-xl hover:bg-white/10','items-center h-10 shrink-0 px-2.5 rounded-xl hover:bg-white/10');s=s.replace('items-center h-10 px-2.5 rounded-xl hover:bg-red-500/10','items-center h-10 shrink-0 px-2.5 rounded-xl hover:bg-red-500/10');p.write_text(s)

# Remove sparkle icons from portal TSX without touching other icons.
for root in [Path('src/pages/portal'),Path('src/components/portal')]:
    for p in root.rglob('*.tsx'):
        t=p.read_text()
        if 'Sparkles' not in t: continue
        t=re.sub(r'<Sparkles\b[^>]*/>','',t);t=re.sub(r'<Sparkles\b[^>]*>.*?</Sparkles>','',t,flags=re.S);t=re.sub(r',\s*Sparkles(?=\s*[,}])','',t);t=re.sub(r'\bSparkles\s*,','',t)
        p.write_text(t)
print('final access-control patch applied')
