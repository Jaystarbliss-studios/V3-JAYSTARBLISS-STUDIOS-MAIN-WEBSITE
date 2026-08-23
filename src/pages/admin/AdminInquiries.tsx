import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { X, Download } from 'lucide-react';

const AdminInquiries: React.FC = () => {
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInquiry, setSelectedInquiry] = useState<any | null>(null);

  useEffect(() => {
    getDocs(collection(db, 'inquiries')).then(snapshot => {
      setInquiries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
  }, []);

  const updateStatus = async (id: string, status: string) => {
    await updateDoc(doc(db, 'inquiries', id), { status, updatedAt: new Date().toISOString() });
    setInquiries(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  };

  const exportToCSV = () => {
    if (inquiries.length === 0) return;
    const headers = Object.keys(inquiries[0]).filter(k => typeof inquiries[0][k] !== 'object');
    const csvContent = [
      headers.join(','),
      ...inquiries.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'inquiries_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div className="mb-8 flex justify-between items-start sm:items-center flex-col sm:flex-row gap-4">
        <div>
          <h1 className="text-2xl font-bold">Inquiries & Leads</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Manage contact requests, applications, and school partnerships.</p>
        </div>
        <button 
          onClick={exportToCSV}
          className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
        >
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 dark:bg-slate-950">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Contact</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type / Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? <tr><td colSpan={4} className="px-6 py-12 text-center">Loading...</td></tr> :
              inquiries.length === 0 ? <tr><td colSpan={4} className="px-6 py-12 text-center">No inquiries found.</td></tr> :
             inquiries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(i => (
               <tr key={i.id} className="hover:bg-gray-50 dark:bg-slate-950">
                 <td className="px-6 py-4">
                   <div className="font-medium text-gray-900 dark:text-white">{i.name}</div>
                   <div className="text-sm text-gray-500 dark:text-gray-400">{i.email}</div>
                 </td>
                 <td className="px-6 py-4 text-sm max-w-xs">
                   <span className="font-bold text-brand-slate dark:text-white text-xs mb-1 block uppercase tracking-wider">{i.type?.replace('_', ' ')}</span>
                   <div className="text-gray-500 dark:text-gray-400 text-xs">
                     {new Date(i.createdAt).toLocaleDateString()}
                   </div>
                 </td>
                 <td className="px-6 py-4">
                   <select
                      value={i.status || 'NEW'}
                      onChange={(e) => updateStatus(i.id, e.target.value)}
                     className="text-sm border border-slate-200 rounded-lg p-1.5 bg-white dark:bg-slate-900 dark:border-slate-800 focus:ring-brand-red focus:border-brand-red"
                   >
                     <option value="NEW">New</option>
                     <option value="REVIEWING">Reviewing</option>
                     <option value="RESPONDED">Responded</option>
                     <option value="CLOSED">Closed</option>
                   </select>
                 </td>
                 <td className="px-6 py-4 text-right">
                   <button
                      onClick={() => setSelectedInquiry(i)}
                     className="text-brand-red font-semibold text-sm hover:text-red-700"
                   >
                     View Details
                   </button>
                 </td>
               </tr>
             ))}
          </tbody>
        </table>
      </div>

      {selectedInquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-slate-900 px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between z-10">
              <div>
                <h3 className="text-xl font-bold text-brand-slate dark:text-white uppercase tracking-wider text-sm">
                  {selectedInquiry.type?.replace('_', ' ')}
                </h3>
                <p className="text-xs text-gray-500 mt-1">{new Date(selectedInquiry.createdAt).toLocaleString()}</p>
              </div>
              <button 
                onClick={() => setSelectedInquiry(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Name</div>
                  <div className="font-medium">{selectedInquiry.name}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Email</div>
                  <div className="font-medium"><a href={`mailto:${selectedInquiry.email}`} className="text-brand-red hover:underline">{selectedInquiry.email}</a></div>
                </div>
                {selectedInquiry.phone && (
                  <div>
                    <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Phone</div>
                    <div className="font-medium">{selectedInquiry.phone}</div>
                  </div>
                )}
                {selectedInquiry.schoolName && (
                  <div>
                    <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">School Name</div>
                    <div className="font-medium">{selectedInquiry.schoolName}</div>
                  </div>
                )}
                {selectedInquiry.role && (
                  <div>
                    <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Role / Position</div>
                    <div className="font-medium">{selectedInquiry.role}</div>
                  </div>
                )}
              </div>

              {selectedInquiry.programsOfInterest && selectedInquiry.programsOfInterest.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Programs of Interest</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedInquiry.programsOfInterest.map((p: string, i: number) => (
                      <span key={i} className="bg-slate-100 dark:bg-slate-800 text-brand-slate dark:text-white px-3 py-1 rounded-full text-xs font-semibold">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedInquiry.message && (
                <div>
                  <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Message</div>
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl text-sm leading-relaxed whitespace-pre-wrap border border-slate-100 dark:border-slate-800">
                    {selectedInquiry.message}
                  </div>
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 bg-gray-50 dark:bg-slate-950 border-t border-gray-100 dark:border-slate-800 flex justify-end">
              <button 
                onClick={() => setSelectedInquiry(null)}
                className="px-6 py-2 bg-brand-slate text-white rounded-lg font-bold text-sm hover:bg-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminInquiries;
