import fs from 'node:fs';

const replaceOnce = (path, needle, replacement, label) => {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(needle)) throw new Error(`Patch pattern missing (${label}) in ${path}`);
  fs.writeFileSync(path, source.replace(needle, replacement), 'utf8');
};

replaceOnce(
  'src/pages/portal/ParentDashboard.tsx',
  `        const allStudentsMap = new Map<string, ChildRecord>();
        const collectChildren = (snap: any) => {
          snap.forEach((studentDoc: any) => {
            const data = studentDoc.data();
            const matchesParent = data.parentId === userUid || data.parentId === userEmail || data.parentEmail?.toLowerCase() === userEmail;
            if (matchesParent) allStudentsMap.set(studentDoc.id, { id: studentDoc.id, ...data } as ChildRecord);
          });
        };`,
  `        const allStudentsMap = new Map<string, ChildRecord>();
        const studentIdentityKey = (studentDoc: any, data: any) => String(
          data.firebaseUid || data.studentUid || data.username || data.accessCode || data.email || data.parentChildId || studentDoc.id
        ).trim().toLowerCase();
        const collectChildren = (snap: any) => {
          snap.forEach((studentDoc: any) => {
            const data = studentDoc.data();
            const matchesParent = data.parentId === userUid || data.parentId === userEmail || data.parentEmail?.toLowerCase() === userEmail;
            if (!matchesParent) return;
            const key = studentIdentityKey(studentDoc, data);
            const existing = allStudentsMap.get(key);
            if (!existing || (String(data.status || '').toLowerCase() === 'active' && String(existing.status || '').toLowerCase() !== 'active')) {
              allStudentsMap.set(key, { id: studentDoc.id, ...data } as ChildRecord);
            }
          });
        };`,
  'parent student deduplication'
);

replaceOnce('src/pages/portal/PortalSettings.tsx', `import { doc, getDoc, updateDoc } from 'firebase/firestore';`, `import { collection, doc, getDocs, getDoc, limit, query, updateDoc, where } from 'firebase/firestore';`, 'settings firestore imports');
replaceOnce('src/pages/portal/PortalSettings.tsx', `  const [fullName, setFullName] = useState('');\n  const [email, setEmail] = useState('');`, `  const [fullName, setFullName] = useState('');\n  const [username, setUsername] = useState('');\n  const [email, setEmail] = useState('');`, 'settings username state');
replaceOnce('src/pages/portal/PortalSettings.tsx', `        if (data.name) setFullName(String(data.name));\n        if (data.phone) setPhone(String(data.phone));`, `        if (data.name) setFullName(String(data.name));\n        if (data.username) setUsername(String(data.username));\n        if (data.phone) setPhone(String(data.phone));`, 'settings username load');
replaceOnce('src/pages/portal/PortalSettings.tsx', `      const cleanName = fullName.trim();\n      const cleanEmail = email.trim().toLowerCase();`, `      const cleanName = fullName.trim();\n      const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');\n      const cleanEmail = email.trim().toLowerCase();`, 'settings username sanitize');
replaceOnce('src/pages/portal/PortalSettings.tsx', `      if (!cleanName || !cleanEmail) throw new Error('Full name and email are required.');`, `      if (!cleanName || !cleanEmail) throw new Error('Full name and email are required.');\n      if (role === 'student' && (cleanUsername.length < 3 || cleanUsername.length > 30)) throw new Error('Student username must be 3–30 characters.');`, 'settings username validation');
replaceOnce('src/pages/portal/PortalSettings.tsx', `      await updateDoc(doc(db, 'users', user.uid), {\n        name: cleanName,\n        email: cleanEmail,`, `      if (role === 'student') {\n        const studentDocId = sessionStorage.getItem('studentDocId') || '';\n        if (studentDocId) {\n          const duplicate = await getDocs(query(collection(db, 'individualStudents'), where('username', '==', cleanUsername), limit(1)));\n          if (!duplicate.empty && duplicate.docs[0].id !== studentDocId) throw new Error('That username is already in use. Please choose another.');\n          await updateDoc(doc(db, 'individualStudents', studentDocId), { username: cleanUsername, updatedAt: new Date().toISOString() }).catch(() => undefined);\n          await updateDoc(doc(db, 'students', studentDocId), { username: cleanUsername, updatedAt: new Date().toISOString() }).catch(() => undefined);\n          sessionStorage.setItem('studentUsername', cleanUsername);\n        }\n      }\n\n      await updateDoc(doc(db, 'users', user.uid), {\n        name: cleanName,\n        username: role === 'student' ? cleanUsername : undefined,\n        email: cleanEmail,`, 'settings username persistence');
replaceOnce('src/pages/portal/PortalSettings.tsx', `              <label className="block"><span className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Email Address</span>`, `              {role === 'student' && <label className="block"><span className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Student Username</span><input required minLength={3} maxLength={30} value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))} placeholder="your_username" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-red" /><span className="block mt-1 text-[10px] text-slate-500">Use this username with your student access code.</span></label>}\n              <label className="block"><span className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Email Address</span>`, 'settings username field');

replaceOnce('src/components/portal/PortalLayout.tsx', `import { auth } from '../../lib/firebase';`, `import { auth, db } from '../../lib/firebase';\nimport { doc, getDoc } from 'firebase/firestore';`, 'portal layout firestore imports');
replaceOnce('src/components/portal/PortalLayout.tsx', `  const [impersonation, setImpersonation] = useState<any>(() => getActiveImpersonation());`, `  const [impersonation, setImpersonation] = useState<any>(() => getActiveImpersonation());\n  const [studentFeatures, setStudentFeatures] = useState<{ assessments?: boolean; edgeClub?: boolean }>({});`, 'portal layout feature state');
replaceOnce('src/components/portal/PortalLayout.tsx', `  const navLinks: NavItem[] = (() => {`, `  useEffect(() => {\n    if (role !== 'student') return;\n    const studentDocId = sessionStorage.getItem('studentDocId') || '';\n    if (!studentDocId) return;\n    void getDoc(doc(db, 'students', studentDocId)).then(snap => {\n      if (snap.exists()) setStudentFeatures((snap.data() as any).featureAccess || {});\n    }).catch(() => undefined);\n  }, [role, location.pathname]);\n\n  const navLinks: NavItem[] = (() => {`, 'portal layout feature loader');
replaceOnce('src/components/portal/PortalLayout.tsx', `        { name: 'Assessments & Quizzes', path: '/portal/student/assessments', icon: <ClipboardCheck size={18} />, desc: 'CBT assessments & quizzes' }`, `        ...(studentFeatures.assessments ? [{ name: 'Assessments & Quizzes', path: '/portal/student/assessments', icon: <ClipboardCheck size={18} />, desc: 'CBT assessments & quizzes' }] : [])`, 'portal layout assessment gate');

fs.rmSync('scripts/one-off-student-portal-fix.mjs');
fs.rmSync('.github/workflows/one-off-student-portal-fix.yml');
