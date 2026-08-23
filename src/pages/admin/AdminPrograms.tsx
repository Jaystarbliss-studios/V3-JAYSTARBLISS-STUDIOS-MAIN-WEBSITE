import React, { useState, useEffect } from 'react';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Plus, Search, Trash2, Edit } from 'lucide-react';
import { Link } from 'react-router-dom';

const CATEGORY_LABELS: Record<string, string> = {
  ACADEMICS: 'Academics',
  DIGITAL_AND_TECHNOLOGY: 'Digital & Tech',
  CREATIVE: 'Creative',
  MUSIC: 'Music',
  EXAM_PREPARATION: 'Exam Prep',
  PERSONALIZED_LEARNING: 'Personalized',
  SCHOOL_PROGRAMS: 'School Programs'
};

const AdminPrograms: React.FC = () => {
  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPrograms = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'programs'));
      const programsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPrograms(programsData);
    } catch (error) {
      console.error('Error fetching programs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
  }, []);

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this program? This action cannot be undone.')) {
      try {
        await deleteDoc(doc(db, 'programs', id));
        setPrograms(programs.filter(p => p.id !== id));
      } catch (error) {
        console.error('Error deleting program:', error);
        alert('Failed to delete program.');
      }
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Programs</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage your educational programs and courses.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search programs..." 
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-brand-red w-full sm:w-64 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
            />
          </div>
          <Link 
            to="/admin/programs/new" 
            className="flex items-center gap-2 bg-brand-red text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors whitespace-nowrap"
          >
            <Plus size={16} />
            Add Program
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
            <thead className="bg-gray-50 dark:bg-slate-950">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Program Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Category
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-900 dark:border-slate-800 divide-y divide-gray-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                    Loading programs...
                  </td>
                </tr>
              ) : programs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                    No programs found. Click "Add Program" to create one.
                  </td>
                </tr>
              ) : (
                programs.map((program) => (
                  <tr key={program.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{program.title}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{program.slug}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {CATEGORY_LABELS[program.categoryId] || program.categoryId || 'Uncategorized'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        program.status === 'PUBLISHED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-gray-300'
                      }`}>
                        {program.status || 'DRAFT'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-3">
                        <Link to={`/admin/programs/${program.id}`} className="text-brand-red hover:text-red-900 dark:hover:text-red-400 transition-colors" title="Edit">
                          <Edit size={18} />
                        </Link>
                        <button onClick={() => handleDelete(program.id)} className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors" title="Delete">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminPrograms;
