cat src/components/layout/Navbar.tsx | grep -v 'export default Navbar;' > src/components/layout/Navbar.tsx.new
sed -i 's/import { useTheme } from '"'"'..\/..\/hooks\/useTheme'"'"';/import { useTheme } from '"'"'..\/..\/hooks\/useTheme'"'"';\nimport { useKeyboardShortcut } from '"'"'..\/..\/hooks\/useKeyboardShortcut'"'"';/' src/components/layout/Navbar.tsx.new
sed -i 's/const location = useLocation();/const location = useLocation();\n  useKeyboardShortcut("\/", () => setSearchOpen(true));/' src/components/layout/Navbar.tsx.new
echo "export default Navbar;" >> src/components/layout/Navbar.tsx.new
mv src/components/layout/Navbar.tsx.new src/components/layout/Navbar.tsx
