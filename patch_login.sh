cat src/pages/admin/Login.tsx | grep -v 'export default Login;' > src/pages/admin/Login.tsx.new
sed -i 's/import { Loader2, Lock } from '"'"'lucide-react'"'"';/import { Loader2, Lock } from '"'"'lucide-react'"'"';\nimport { useToast } from '"'"'..\/..\/contexts\/ToastContext'"'"';/' src/pages/admin/Login.tsx.new
sed -i 's/const navigate = useNavigate();/const navigate = useNavigate();\n  const { success, error: showError } = useToast();/' src/pages/admin/Login.tsx.new
sed -i 's/navigate('"'"'\/admin'"'"');/success('"'"'Successfully logged in!'"'"');\n      navigate('"'"'\/admin'"'"');/' src/pages/admin/Login.tsx.new
sed -i 's/setError(err.message || '"'"'Invalid credentials'"'"');/setError(err.message || '"'"'Invalid credentials'"'"');\n      showError(err.message || '"'"'Invalid credentials'"'"');/' src/pages/admin/Login.tsx.new
echo "export default Login;" >> src/pages/admin/Login.tsx.new
mv src/pages/admin/Login.tsx.new src/pages/admin/Login.tsx
