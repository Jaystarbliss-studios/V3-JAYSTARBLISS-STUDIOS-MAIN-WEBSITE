cat src/components/ui/SearchModal.tsx | grep -v 'export default SearchModal;' > src/components/ui/SearchModal.tsx.new
sed -i 's/import { useNavigate } from '"'"'react-router-dom'"'"';/import { useNavigate } from '"'"'react-router-dom'"'"';\nimport { useKeyboardShortcut } from '"'"'..\/..\/hooks\/useKeyboardShortcut'"'"';/' src/components/ui/SearchModal.tsx.new
sed -i 's/const \[docsLoaded, setDocsLoaded\] = useState(false);/const \[docsLoaded, setDocsLoaded\] = useState(false);\n  useKeyboardShortcut("Escape", () => { if (isOpen) onClose(); });/' src/components/ui/SearchModal.tsx.new
echo "export default SearchModal;" >> src/components/ui/SearchModal.tsx.new
mv src/components/ui/SearchModal.tsx.new src/components/ui/SearchModal.tsx
