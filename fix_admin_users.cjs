const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/AdminUsers.tsx', 'utf8');

// I will just rewrite the entire header div.
const headerDivRegex = /<div className="mb-8 flex justify-between items-start sm:items-center flex-col sm:flex-row gap-4">[\s\S]*?<\/div>\s*<div className="bg-white/;

const properHeader = `<div className="mb-8 flex justify-between items-start sm:items-center flex-col sm:flex-row gap-4">
        <div>
          <h1 className="text-2xl font-bold">Users & Roles</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Manage user access and administrative roles.</p>
        </div>
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
      </div>
      <div className="bg-white`;

code = code.replace(headerDivRegex, properHeader);

fs.writeFileSync('src/pages/admin/AdminUsers.tsx', code);
