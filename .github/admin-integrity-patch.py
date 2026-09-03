from pathlib import Path

students = Path('src/pages/admin/AdminStudents.tsx')
s = students.read_text()
s = s.replace(
'''  // Update Access Code
  const handleUpdateCode = async (studentId: string) => {
    if (!tempCode.trim()) {
      toast.error('Access code cannot be blank.');
      return;
    }
    try {
      await setDoc(doc(db, 'individualStudents', studentId), {
        accessCode: tempCode.trim().toUpperCase()
      }, { merge: true });

      toast.success(`Access code updated to ${tempCode.trim().toUpperCase()}!`);
      setEditingCodeId(null);
      setTempCode('');
      fetchData();
    } catch (err: any) {
      toast.error('Failed to update code: ' + err.message);
    }
  };
''',
'''  // Update Access Code across current and legacy student records.
  const handleUpdateCode = async (studentId: string) => {
    const nextCode = tempCode.trim().toUpperCase();
    if (!nextCode) {
      toast.error('Access code cannot be blank.');
      return;
    }
    try {
      const student = students.find((item) => item.id === studentId);
      const writes: Promise<unknown>[] = [
        setDoc(doc(db, 'individualStudents', studentId), { accessCode: nextCode }, { merge: true }),
      ];
      if (student?.username) {
        const legacySnap = await getDocs(query(collection(db, 'students'), where('username', '==', student.username)));
        legacySnap.forEach((studentDoc) => writes.push(setDoc(studentDoc.ref, { accessCode: nextCode }, { merge: true })));
      }
      await Promise.all(writes);
      toast.success(`Access code updated to ${nextCode} across linked student records.`);
      setEditingCodeId(null);
      setTempCode('');
      fetchData();
    } catch (err: any) {
      toast.error('Failed to update code: ' + err.message);
    }
  };
''', 1)
s = s.replace(
'''  // Delete Student
  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    if (!window.confirm(`Are you sure you want to delete student "${studentName}" and all their assigned resources?`)) return;
    try {
      await deleteDoc(doc(db, 'individualStudents', studentId));

      // Also clean up personal resources and links
      const [rSnap, lSnap] = await Promise.all([
        getDocs(query(collection(db, 'personalResources'), where('studentId', '==', studentId))),
        getDocs(query(collection(db, 'personalLinks'), where('studentId', '==', studentId)))
      ]);

      const deletions: Promise<void>[] = [];
      rSnap.forEach(d => deletions.push(deleteDoc(d.ref)));
      lSnap.forEach(d => deletions.push(deleteDoc(d.ref)));
      await Promise.all(deletions);

      toast.success(`Student "${studentName}" and personal files deleted.`);
      fetchData();
    } catch (err: any) {
      toast.error('Error deleting student: ' + err.message);
    }
  };
''',
'''  // Delete Student and clean up current and legacy student records.
  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    if (!window.confirm(`Are you sure you want to delete student "${studentName}" and all their assigned resources?`)) return;
    try {
      const student = students.find((item) => item.id === studentId);
      const legacyRefs = student?.username
        ? (await getDocs(query(collection(db, 'students'), where('username', '==', student.username)))).docs.map((studentDoc) => studentDoc.ref)
        : [];

      await deleteDoc(doc(db, 'individualStudents', studentId));
      await Promise.all(legacyRefs.map((studentRef) => deleteDoc(studentRef)));

      const [rSnap, lSnap] = await Promise.all([
        getDocs(query(collection(db, 'personalResources'), where('studentId', '==', studentId))),
        getDocs(query(collection(db, 'personalLinks'), where('studentId', '==', studentId)))
      ]);
      const deletions: Promise<void>[] = [];
      rSnap.forEach(d => deletions.push(deleteDoc(d.ref)));
      lSnap.forEach(d => deletions.push(deleteDoc(d.ref)));
      await Promise.all(deletions);
      toast.success(`Student "${studentName}" and linked student records deleted.`);
      fetchData();
    } catch (err: any) {
      toast.error('Error deleting student: ' + err.message);
    }
  };
''', 1)
students.write_text(s)

staff = Path('src/pages/admin/AdminStaff.tsx')
s = staff.read_text()
s = s.replace(
'''  // Delete Staff Member
  const handleDeleteStaff = async (id: string, name: string) => {
    if (!window.confirm(`Revoke staff privileges and remove "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'users', id));
      toast.success(`Staff member "${name}" removed.`);
      fetchStaffData();
    } catch (err: any) {
      toast.error('Error removing staff: ' + err.message);
    }
  };
''',
'''  // Disable Staff Member without deleting the authoritative user record.
  const handleDeleteStaff = async (id: string, name: string) => {
    if (!window.confirm(`Disable staff access for "${name}"? This preserves the account record for audit history.`)) return;
    try {
      await setDoc(doc(db, 'users', id), {
        accountStatus: 'DISABLED',
        disabledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setStaffList((prev) => prev.map((member) => member.id === id ? { ...member, accountStatus: 'DISABLED' } : member));
      toast.success(`Staff member "${name}" has been disabled.`);
    } catch (err: any) {
      toast.error('Error disabling staff: ' + err.message);
    }
  };
''', 1)
staff.write_text(s)

rules = Path('firestore.rules')
text = rules.read_text()
old_rules = '''    // Global settings can contain privileged integration values. Keep them admin-only.
    match /settings/{document=**} {
      allow read, write: if isAnyAdmin();
    }
'''
new_rules = '''    // The global settings collection may contain privileged integration values.
    // Only the public banner document is intentionally readable without auth.
    match /settings/banner {
      allow read: if true;
      allow write: if isAnyAdmin();
    }

    match /settings/{document=**} {
      allow read, write: if isAnyAdmin();
    }
'''
if old_rules in text:
    rules.write_text(text.replace(old_rules, new_rules, 1))
