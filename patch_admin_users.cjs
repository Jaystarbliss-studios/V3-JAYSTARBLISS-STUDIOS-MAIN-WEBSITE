const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/AdminUsers.tsx', 'utf8');

// We need to add an invite button and a modal.
const imports = `import { collection, getDocs, doc, updateDoc, addDoc, query, where } from 'firebase/firestore';`;
code = code.replace(`import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';`, imports);
const lucideImports = `import { Shield, User, Download, Plus, X } from 'lucide-react';`;
code = code.replace(`import { Shield, User, Download } from 'lucide-react';`, lucideImports);

const modalState = `
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('STUDENT');
  const [inviteName, setInviteName] = useState('');
  const [inviting, setInviting] = useState(false);
`;
code = code.replace(`  const [users, setUsers] = useState<any[]>([]);\n  const [loading, setLoading] = useState(true);`, modalState);

const handleInvite = `
  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    try {
      await addDoc(collection(db, 'invites'), {
        email: inviteEmail.toLowerCase(),
        name: inviteName,
        role: inviteRole,
        createdAt: new Date().toISOString()
      });
      alert('User invited! When they sign in with Google, they will receive this role.');
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteName('');
    } catch (err) {
      console.error(err);
      alert('Failed to invite user.');
    } finally {
      setInviting(false);
    }
  };
`;

code = code.replace(`  const exportToCSV = () => {`, handleInvite + `\n  const exportToCSV = () => {`);

const onboardBtn = `
        <div className="flex gap-2">
          <button 
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 bg-brand-red text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-700 transition-colors shadow-sm"
          >
            <Plus size={16} /> Onboard User
          </button>
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            <Download size={16} /> Export CSV
          </button>
        </div>
`;

code = code.replace(`<button \n           onClick={exportToCSV}`, onboardBtn + `<!--`);
code = code.replace(`Export CSV\n        </button>`, `-->`);

const modalJSX = `
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Onboard New User</h2>
              <button onClick={() => setShowInviteModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name (Optional)</label>
                <input 
                  type="text" 
                  value={inviteName} 
                  onChange={e => setInviteName(e.target.value)} 
                  className="w-full border rounded p-2 dark:bg-slate-800 dark:border-slate-700" 
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input 
                  type="email" 
                  required
                  value={inviteEmail} 
                  onChange={e => setInviteEmail(e.target.value)} 
                  className="w-full border rounded p-2 dark:bg-slate-800 dark:border-slate-700" 
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select 
                  value={inviteRole} 
                  onChange={e => setInviteRole(e.target.value)} 
                  className="w-full border rounded p-2 dark:bg-slate-800 dark:border-slate-700"
                >
                  <option value="USER">User (Default)</option>
                  <option value="STUDENT">Student</option>
                  <option value="PARENT">Parent</option>
                  <option value="TUTOR">Tutor</option>
                  <option value="STAFF">Staff</option>
                  <option value="SCHOOL">School Admin</option>
                  <option value="CONTENT_ADMIN">Content Admin</option>
                  <option value="EDUCATION_ADMIN">Education Admin</option>
                  <option value="SERVICES_ADMIN">Services Admin</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>
              <button 
                type="submit" 
                disabled={inviting}
                className="w-full bg-brand-red text-white py-2 rounded-lg font-bold disabled:opacity-50"
              >
                {inviting ? 'Sending...' : 'Add User Invite'}
              </button>
            </form>
          </div>
        </div>
      )}
`;

code = code.replace(`  return (\n    <div>`, `  return (\n    <div>` + modalJSX);

fs.writeFileSync('src/pages/admin/AdminUsers.tsx', code);
