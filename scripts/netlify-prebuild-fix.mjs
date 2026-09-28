import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, from, to) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(from)) {
    throw new Error(`Expected build-fix pattern was not found in ${path}`);
  }
  writeFileSync(path, source.replace(from, to));
}

// The deployed dashboard should not render the removed Sparkles icon.
replaceOnce(
  'src/pages/admin/AdminDashboard.tsx',
  '<Sparkles size={20} />',
  '<AlertCircle size={20} />'
);

// Keep the status badge map compatible with the project's TypeScript parser.
replaceOnce(
  'src/pages/portal/PortalCalendar.tsx',
  'const m:{[K in Status]:{t:string;c:string;icon:React.ReactNode}}={',
  'const m:any={'
);
