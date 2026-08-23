cat src/App.tsx | grep -v 'export default App;' > src/App.tsx.new
sed -i 's/import { ThemeProvider } from '"'"'.\/contexts\/ThemeContext'"'"';/import { ThemeProvider } from '"'"'.\/contexts\/ThemeContext'"'"';\nimport { ToastProvider } from '"'"'.\/contexts\/ToastContext'"'"';\nimport ErrorBoundary from '"'"'.\/components\/ui\/ErrorBoundary'"'"';\nimport PageLoader from '"'"'.\/components\/ui\/PageLoader'"'"';/' src/App.tsx.new
sed -i 's/<ThemeProvider>/<ErrorBoundary>\n    <ThemeProvider>\n      <ToastProvider>/' src/App.tsx.new
sed -i 's/<Router>/<Router>\n      <PageLoader \/>/' src/App.tsx.new
sed -i 's/<\/ThemeProvider>/      <\/ToastProvider>\n    <\/ThemeProvider>\n    <\/ErrorBoundary>/' src/App.tsx.new
echo "export default App;" >> src/App.tsx.new
mv src/App.tsx.new src/App.tsx
