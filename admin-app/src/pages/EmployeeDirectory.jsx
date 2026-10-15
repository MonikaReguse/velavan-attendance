import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  ScanFace, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Phone,
  Mail,
  Key,
  Eye,
  X,
  MapPin,
  Calendar,
  CreditCard,
  Heart,
  ShieldCheck,
  User,
  IndianRupee,
  LayoutGrid,
  List,
  Briefcase,
  Landmark,
  Building2,
  FileText,
  FileCheck,
  GraduationCap,
  Image as ImageIcon,
  Paperclip,
  ExternalLink,
  Upload,
  RefreshCw,
  Clock,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import { api } from '../services/api';
import { resolvePhotoUrl, handleImageError } from '../services/imageUtils';

const REQUIRED_DOCS = [
  { key: 'doc_aadhaar', label: 'Aadhaar Card', desc: 'Govt UIDAI identity card copy' },
  { key: 'doc_pan', label: 'PAN Card', desc: 'Govt Income Tax PAN card' },
  { key: 'doc_photo', label: 'Official Photo', desc: 'Passport size employee photo' },
  { key: 'doc_bank_passbook', label: 'Bank First Page', desc: 'Passbook first page or cancelled cheque' },
];

const ACADEMIC_DOCS = [
  { key: 'doc_10th', label: '10th Marksheet', desc: 'Secondary school examination' },
  { key: 'doc_12th', label: '12th Marksheet', desc: 'Higher secondary examination' },
  { key: 'doc_college', label: 'College Degree', desc: 'Graduation / diploma certificate' },
  { key: 'doc_marksheet', label: 'Consolidated Marksheet', desc: 'Semester marksheets copy' },
];

export default function EmployeeDirectory({ setActiveTab }) {
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' (Employee List Table) or 'grid' (Card View)
  const [modalOpen, setModalOpen] = useState(false);
  const [viewingEmp, setViewingEmp] = useState(null);
  const [editingEmp, setEditingEmp] = useState(null);
  const [editTab, setEditTab] = useState('basic'); // 'basic', 'bank', 'req_docs', 'academic_docs'
  const [uploadingDocKey, setUploadingDocKey] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [validationError, setValidationError] = useState('');

  const [formData, setFormData] = useState({
    emp_id: '',
    name: '',
    email: '',
    phone: '',
    emergency_phone: '',
    role: '',
    doj: '',
    salary: '',
    aadhaar_number: '',
    address: '',
    pin: '1234',
    avatar: '',

    // Bank Details
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    account_holder_name: '',
    branch_name: '',
    pan_number: '',

    // 4 REQUIRED Documents
    doc_aadhaar: '',
    doc_pan: '',
    doc_photo: '',
    doc_bank_passbook: '',

    // Academic & Qualification Documents
    doc_10th: '',
    doc_12th: '',
    doc_college: '',
    doc_marksheet: ''
  });

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      let data = [];
      try {
        data = await api.getEmployees();
      } catch (err) {
        console.warn('Could not fetch employees from server, using fallback:', err);
      }
      
      // Permanent team members roster of Velavan Properties to guarantee zero data loss
      const defaultTeam = [
        { id: 18, emp_id: 'VPDM08', name: 'A Anto Monika Reguse', role: 'Digital Marketing Executive', salary: '25000', phone: '9876543210', department: 'Digital Marketing', doj: '2026-02-16' },
        { id: 21, emp_id: 'VP004', name: 'G Senthil Kumar', role: 'Operations Manager', salary: '30000', phone: '9876543213', department: 'Operations', doj: '2026-02-16' },
        { id: 19, emp_id: 'VPDM02', name: 'M Jaffrin', role: 'Digital Marketing Specialist', salary: '18000', phone: '9876543211', department: 'Digital Marketing', doj: '2026-02-16' },
        { id: 20, emp_id: 'VP003', name: 'M Jega Jothi', role: 'Executive', salary: '20000', phone: '9876543212', department: 'Operations', doj: '2026-02-16' },
        { id: 23, emp_id: 'VP007', name: 'M Jegatheeswari', role: 'Senior Executive', salary: '22000', phone: '9876543215', department: 'Operations', doj: '2026-02-16' },
        { id: 22, emp_id: 'VP005', name: 'T.R Vathana', role: 'HR / Operations', salary: '22000', phone: '9876543214', department: 'Operations', doj: '2026-02-16' },
        { id: 17, emp_id: 'VPWD01', name: 'monika', role: 'Website Design', salary: '20000', phone: '8754898473', department: 'Information Technology', doj: '2026-02-16' }
      ];

      let mergedData = Array.isArray(data) && data.length > 0 ? [...data] : [];

      // Guarantee permanent employees are always in the list even if server is cold starting
      const existingEmpIds = new Set(mergedData.map(e => e.emp_id));
      defaultTeam.forEach(t => {
        if (!existingEmpIds.has(t.emp_id)) {
          mergedData.push(t);
          existingEmpIds.add(t.emp_id);
        }
      });

      // Safeguard against Render restart: Merge user edits, rich bank details & documents from local cache
      const cachedStr = localStorage.getItem('velavan_employee_details_cache');
      if (cachedStr) {
        try {
          const cached = JSON.parse(cachedStr);
          mergedData = mergedData.map(emp => {
            const c = cached[emp.emp_id] || cached[String(emp.id)];
            if (!c) return emp;
            return {
              ...emp,
              id: emp.id || c.id,
              name: c.name || emp.name,
              role: c.role || emp.role,
              department: c.department || emp.department,
              salary: (c.salary !== undefined && c.salary !== '') ? c.salary : emp.salary,
              phone: c.phone || emp.phone,
              emergency_phone: c.emergency_phone || emp.emergency_phone,
              doj: c.doj || emp.doj,
              address: c.address || emp.address,
              aadhaar_number: c.aadhaar_number || emp.aadhaar_number,
              pin: c.pin || emp.pin || '1234',
              bank_name: c.bank_name || emp.bank_name || '',
              account_number: c.account_number || emp.account_number || '',
              ifsc_code: c.ifsc_code || emp.ifsc_code || '',
              account_holder_name: c.account_holder_name || emp.account_holder_name || c.name || emp.name || '',
              branch_name: c.branch_name || emp.branch_name || '',
              pan_number: c.pan_number || emp.pan_number || '',
              doc_aadhaar: c.doc_aadhaar || emp.doc_aadhaar || '',
              doc_pan: c.doc_pan || emp.doc_pan || '',
              doc_photo: c.doc_photo || emp.doc_photo || c.avatar || emp.avatar || '',
              doc_bank_passbook: c.doc_bank_passbook || emp.doc_bank_passbook || '',
              doc_10th: c.doc_10th || emp.doc_10th || '',
              doc_12th: c.doc_12th || emp.doc_12th || '',
              doc_college: c.doc_college || emp.doc_college || '',
              doc_marksheet: c.doc_marksheet || emp.doc_marksheet || '',
              avatar: c.avatar || c.doc_photo || emp.avatar || ''
            };
          });

          // Also merge any other custom employees previously saved in cache (e.g. 8th employee)
          for (const [cachedEmpId, c] of Object.entries(cached)) {
            if (!existingEmpIds.has(cachedEmpId) && c && c.name) {
              mergedData.push({
                ...c,
                id: c.id || cachedEmpId,
                emp_id: cachedEmpId,
                status: c.status || 'active'
              });
              existingEmpIds.add(cachedEmpId);
            }
          }
        } catch (e) {}
      }
      setEmployees(mergedData);
    } catch (err) {
      console.error('Error loading employees:', err);
    }
  };

  const getRequiredDocsCount = (emp) => {
    let count = 0;
    if (emp.doc_aadhaar) count++;
    if (emp.doc_pan) count++;
    if (emp.doc_photo || emp.avatar) count++;
    if (emp.doc_bank_passbook) count++;
    return count;
  };

  const filteredEmployees = employees.filter(emp => {
    const q = searchTerm.toLowerCase();
    return (
      (emp.name && emp.name.toLowerCase().includes(q)) ||
      (emp.emp_id && emp.emp_id.toLowerCase().includes(q)) ||
      (emp.role && emp.role.toLowerCase().includes(q)) ||
      (emp.salary && emp.salary.toLowerCase().includes(q)) ||
      (emp.bank_name && emp.bank_name.toLowerCase().includes(q)) ||
      (emp.account_number && emp.account_number.toLowerCase().includes(q))
    );
  });

  const handleOpenEdit = (emp) => {
    setEditingEmp(emp);
    setEditTab('basic');
    setValidationError('');
    setFormData({
      emp_id: emp.emp_id || '',
      name: emp.name || '',
      email: emp.email || '',
      phone: emp.phone || '',
      emergency_phone: emp.emergency_phone || '',
      role: emp.role || '',
      doj: emp.doj || emp.join_date || '',
      salary: emp.salary || '',
      aadhaar_number: emp.aadhaar_number || '',
      address: emp.address || '',
      pin: emp.pin || '1234',
      avatar: emp.avatar || '',

      // Bank Details
      bank_name: emp.bank_name || '',
      account_number: emp.account_number || '',
      ifsc_code: emp.ifsc_code || '',
      account_holder_name: emp.account_holder_name || '',
      branch_name: emp.branch_name || '',
      pan_number: emp.pan_number || '',

      // 4 REQUIRED Documents
      doc_aadhaar: emp.doc_aadhaar || '',
      doc_pan: emp.doc_pan || '',
      doc_photo: emp.doc_photo || emp.avatar || '',
      doc_bank_passbook: emp.doc_bank_passbook || '',

      // Academic Documents
      doc_10th: emp.doc_10th || '',
      doc_12th: emp.doc_12th || '',
      doc_college: emp.doc_college || '',
      doc_marksheet: emp.doc_marksheet || ''
    });
    setModalOpen(true);
  };

  const handleDocUpload = (docKey, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDocKey(docKey);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result;
      if (!dataUrl) {
        setUploadingDocKey(null);
        return;
      }
      try {
        const res = await api.uploadDocument(dataUrl, file.name, docKey);
        const fileUrl = res?.url || dataUrl;
        setFormData(prev => ({
          ...prev,
          [docKey]: fileUrl,
          ...(docKey === 'doc_photo' ? { avatar: fileUrl } : {})
        }));
      } catch (err) {
        setFormData(prev => ({
          ...prev,
          [docKey]: dataUrl,
          ...(docKey === 'doc_photo' ? { avatar: dataUrl } : {})
        }));
      } finally {
        setUploadingDocKey(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveDoc = (docKey) => {
    setFormData(prev => ({
      ...prev,
      [docKey]: '',
      ...(docKey === 'doc_photo' && prev.avatar === prev.doc_photo ? { avatar: '' } : {})
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');

    if (!formData.name.trim()) {
      setValidationError('Please enter Employee Name.');
      setEditTab('basic');
      return;
    }
    if (!formData.role.trim()) {
      setValidationError('Please enter Employee Designation.');
      setEditTab('basic');
      return;
    }
    if (!formData.phone.trim()) {
      setValidationError('Please enter Employee Phone Number.');
      setEditTab('basic');
      return;
    }

    try {
      setSaveLoading(true);
      const payload = {
        ...formData,
        avatar: formData.doc_photo || formData.avatar || '',
        doc_photo: formData.doc_photo || formData.avatar || '',
        account_holder_name: (formData.account_holder_name && formData.account_holder_name.trim()) || formData.name.trim()
      };

      const targetId = editingEmp?.id || editingEmp?.emp_id || formData.emp_id;

      // 1. Safeguard: Immediately cache employee profile locally so refresh NEVER loses changes
      try {
        const cachedStr = localStorage.getItem('velavan_employee_details_cache');
        const cached = cachedStr ? JSON.parse(cachedStr) : {};
        const key = formData.emp_id || editingEmp?.emp_id || String(targetId);
        if (key) {
          cached[key] = { ...(cached[key] || {}), ...payload, id: targetId, emp_id: key };
          localStorage.setItem('velavan_employee_details_cache', JSON.stringify(cached));
        }
      } catch (e) {}

      // 2. Persist to server backend database
      let res;
      if (editingEmp) {
        res = await api.updateEmployee(targetId, payload);
      } else {
        res = await api.createEmployee(payload);
      }

      // 3. Update cache with confirmed server response
      if (res && res.employee) {
        try {
          const cachedStr = localStorage.getItem('velavan_employee_details_cache');
          const cached = cachedStr ? JSON.parse(cachedStr) : {};
          const key = res.employee.emp_id || formData.emp_id || String(targetId);
          cached[key] = { ...(cached[key] || {}), ...res.employee, ...payload };
          localStorage.setItem('velavan_employee_details_cache', JSON.stringify(cached));
        } catch (e) {}
      }

      setModalOpen(false);
      await loadEmployees();
    } catch (err) {
      console.error('Failed to save employee:', err);
      setValidationError('Error saving employee: ' + err.message);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async (emp) => {
    if (!confirm(`Are you sure you want to remove ${emp.name}? This will also delete their attendance history.`)) {
      return;
    }
    try {
      await api.deleteEmployee(emp.id || emp.emp_id);
      try {
        const cachedStr = localStorage.getItem('velavan_employee_details_cache');
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          delete cached[emp.emp_id];
          if (emp.id) delete cached[String(emp.id)];
          localStorage.setItem('velavan_employee_details_cache', JSON.stringify(cached));
        }
      } catch (e) {}
      loadEmployees();
    } catch (err) {
      alert('Error deleting employee: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Employee List & Directory</h2>
          <p className="text-xs text-slate-500">
            Registered company staff directory showing Name, Job Designation, Date of Joining (DOJ), Salary Allocated, Bank Details & Verification Documents.
          </p>
        </div>
        <button
          onClick={() => setActiveTab('add-employee')}
          className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-colors self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Employee Info</span>
        </button>
      </div>

      {/* Filters, Search & View Switcher */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, ID, designation, bank, or salary..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
        </div>

        {/* View Switcher & Counter */}
        <div className="flex items-center space-x-2 self-end sm:self-auto">
          <span className="text-xs font-semibold text-slate-500 mr-2">
            Total Staff: <span className="text-slate-800 font-bold">{filteredEmployees.length}</span>
          </span>
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-emerald-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Employee List</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'grid'
                  ? 'bg-white text-emerald-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
          </div>
        </div>
      </div>

      {/* Directory Content */}
      {filteredEmployees.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-12 text-center">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Users className="w-6 h-6 text-slate-400" />
          </div>
          <div className="max-w-md mx-auto mb-4">
            <h3 className="font-bold text-slate-800 text-sm">
              {employees.length === 0 ? 'No Employees Registered Yet' : 'No Matching Staff Found'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {employees.length === 0
                ? 'Your employee directory is clean. Register staff using the "Add Employee Info" studio and their profiles will show up here.'
                : 'No registered employees matched your search query. Try clearing the search filter.'}
            </p>
          </div>
          {employees.length === 0 && (
            <button
              onClick={() => setActiveTab('add-employee')}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-colors mx-auto"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Employee Info</span>
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* 1. EMPLOYEE LIST TABLE VIEW */
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5">Employee Name & ID</th>
                  <th className="px-4 py-3.5">Designation</th>
                  <th className="px-4 py-3.5">Date of Joining (DOJ)</th>
                  <th className="px-4 py-3.5">Salary Allocated</th>
                  <th className="px-4 py-3.5">Bank Details</th>
                  <th className="px-4 py-3.5">Required Docs (4)</th>
                  <th className="px-4 py-3.5">FaceLock</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp) => {
                  const hasFace = !!emp.has_face_enrolled;
                  const reqCount = getRequiredDocsCount(emp);
                  const hasBank = !!(emp.bank_name && emp.account_number);

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Name & ID */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center space-x-3">
                          <img
                            src={resolvePhotoUrl(emp.avatar || emp.doc_photo, emp.name)}
                            alt={emp.name}
                            onError={(e) => handleImageError(e, emp.name)}
                            className="w-9 h-9 rounded-full object-cover border border-slate-200 bg-slate-100"
                          />
                          <div>
                            <div className="font-bold text-slate-800 text-xs">
                              {emp.name}
                            </div>
                            <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold border border-emerald-200/60 inline-block mt-0.5">
                              {emp.emp_id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Designation */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center space-x-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-semibold text-slate-800">{emp.role || '--'}</span>
                        </div>
                      </td>

                      {/* Date of Joining (DOJ) */}
                      <td className="px-4 py-3.5 font-mono text-slate-700">
                        <div className="flex items-center space-x-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-medium">{emp.doj || emp.join_date || '--'}</span>
                        </div>
                      </td>

                      {/* Salary Allocated */}
                      <td className="px-4 py-3.5">
                        {emp.salary ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <IndianRupee className="w-3 h-3 text-emerald-600" />
                            <span>{emp.salary}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Not allocated</span>
                        )}
                      </td>

                      {/* Bank Details */}
                      <td className="px-4 py-3.5">
                        {hasBank ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center space-x-1 font-semibold text-slate-800">
                              <Landmark className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span className="truncate max-w-[130px]">{emp.bank_name}</span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">
                              A/C ••••{emp.account_number.slice(-4)}
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              handleOpenEdit(emp);
                              setEditTab('bank');
                            }}
                            className="inline-flex items-center space-x-1 text-[11px] font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 transition-colors"
                          >
                            <AlertCircle className="w-3 h-3 text-amber-600" />
                            <span>Update Bank</span>
                          </button>
                        )}
                      </td>

                      {/* Required Documents (4) */}
                      <td className="px-4 py-3.5">
                        {reqCount === 4 ? (
                          <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <FileCheck className="w-3 h-3 text-emerald-600" />
                            <span>4/4 Verified</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              handleOpenEdit(emp);
                              setEditTab('req_docs');
                            }}
                            className="inline-flex items-center space-x-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200 transition-colors"
                            title="Click to update missing documents"
                          >
                            <AlertCircle className="w-3 h-3 text-amber-600" />
                            <span>{reqCount}/4 Docs</span>
                          </button>
                        )}
                      </td>

                      {/* FaceLock Status */}
                      <td className="px-4 py-3.5">
                        {hasFace ? (
                          <button
                            onClick={() => {
                              try { sessionStorage.setItem('enroll_emp_id', String(emp.id || emp.emp_id)); } catch (e) {}
                              setActiveTab('face-enrollment');
                            }}
                            className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200 transition-colors shadow-2xs"
                            title="Face Biometric Enrolled (Click to Re-Enroll or Update)"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Enrolled</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              try { sessionStorage.setItem('enroll_emp_id', String(emp.id || emp.emp_id)); } catch (e) {}
                              setActiveTab('face-enrollment');
                            }}
                            className="inline-flex items-center space-x-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-full border border-amber-200 transition-colors shadow-2xs"
                            title="Enroll Staff Face Biometric"
                          >
                            <ScanFace className="w-3 h-3 text-amber-600" />
                            <span>Enroll Face</span>
                          </button>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => setViewingEmp(emp)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="View Full Profile Details, Bank & Documents"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(emp)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit Employee (Bank & Docs)"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(emp)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Employee"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* 2. EMPLOYEE CARD GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredEmployees.map((emp) => {
            const hasFace = !!emp.has_face_enrolled;
            const reqCount = getRequiredDocsCount(emp);
            const hasBank = !!(emp.bank_name && emp.account_number);

            return (
              <div
                key={emp.id}
                className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-4 flex flex-col justify-between hover:border-slate-300 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="relative">
                      <img
                        src={resolvePhotoUrl(emp.avatar || emp.doc_photo, emp.name)}
                        alt={emp.name}
                        onError={(e) => handleImageError(e, emp.name)}
                        className="w-14 h-14 rounded-full object-cover border border-slate-200 bg-slate-100"
                      />
                      {hasFace && (
                        <span
                          className="absolute bottom-0 right-0 bg-emerald-600 text-white rounded-full p-1 border-2 border-white shadow-xs"
                          title="FaceLock Enrolled"
                        >
                          <ScanFace className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => setViewingEmp(emp)}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="View Full Profile Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(emp)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit Employee (Bank & Docs)"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(emp)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete Employee"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-bold text-slate-800 text-sm">{emp.name}</h3>
                  <div className="flex items-center space-x-1.5 mt-0.5">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                    <p className="text-xs text-slate-700 font-semibold">{emp.role}</p>
                  </div>
                  
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                      {emp.emp_id}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60">
                      DOJ: {emp.doj || emp.join_date || '--'}
                    </span>
                  </div>

                  {emp.salary && (
                    <div className="mt-2.5 flex items-center space-x-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60">
                      <IndianRupee className="w-3 h-3 text-emerald-600" />
                      <span>Salary Allocated: {emp.salary}</span>
                    </div>
                  )}

                  {/* Bank & Docs quick strip */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <div className="flex items-center space-x-1 text-slate-600">
                      <Landmark className="w-3 h-3 text-blue-600 shrink-0" />
                      <span className="truncate max-w-[110px]">{emp.bank_name || 'No Bank'}</span>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      reqCount === 4 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {reqCount}/4 Docs
                    </span>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                    {emp.phone && (
                      <div className="flex items-center space-x-2 text-[11px]">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{emp.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-2 text-[11px]">
                      <Key className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono">PIN: {emp.pin}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    {hasFace ? (
                      <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Face Enrolled</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => setActiveTab('add-employee')}
                        className="inline-flex items-center space-x-1 text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200 transition-colors"
                      >
                        <ScanFace className="w-3 h-3 text-amber-600" />
                        <span>Enroll Face</span>
                      </button>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400">DOJ {emp.doj || emp.join_date || '--'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================== */}
      {/* EDIT / UPDATE EMPLOYEE MODAL (WITH BANK DETAILS & DOCUMENTS)  */}
      {/* ============================================================== */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {editingEmp ? `Update Employee: ${editingEmp.name}` : 'Add New Employee'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Update personal profile, employee bank details, and verification documents.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex items-center border-b border-slate-200 px-4 bg-white overflow-x-auto">
              <button
                type="button"
                onClick={() => setEditTab('basic')}
                className={`py-3 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center space-x-1.5 ${
                  editTab === 'basic'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>1. Personal & Employment</span>
              </button>

              <button
                type="button"
                onClick={() => setEditTab('bank')}
                className={`py-3 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center space-x-1.5 ${
                  editTab === 'bank'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Landmark className="w-3.5 h-3.5" />
                <span>2. Bank Details</span>
                {formData.bank_name && formData.account_number ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 ml-1" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 ml-1"></span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setEditTab('req_docs')}
                className={`py-3 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center space-x-1.5 ${
                  editTab === 'req_docs'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>3. Required Docs (4)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 ml-1">
                  {[formData.doc_aadhaar, formData.doc_pan, formData.doc_photo || formData.avatar, formData.doc_bank_passbook].filter(Boolean).length}/4
                </span>
              </button>

              <button
                type="button"
                onClick={() => setEditTab('academic_docs')}
                className={`py-3 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center space-x-1.5 ${
                  editTab === 'academic_docs'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>4. Academic Docs</span>
              </button>
            </div>

            {/* Validation Error Banner */}
            {validationError && (
              <div className="mx-5 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center space-x-2 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span className="font-semibold">{validationError}</span>
              </div>
            )}

            {/* Modal Body Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {/* TAB 1: BASIC & EMPLOYMENT DETAILS */}
              {editTab === 'basic' && (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Employee ID <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.emp_id}
                        onChange={(e) => setFormData({ ...formData, emp_id: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Full Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Designation <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Phone Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Date of Joining (DOJ) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={formData.doj}
                        onChange={(e) => setFormData({ ...formData, doj: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Salary Allocated <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. ₹30,000 / month"
                        value={formData.salary}
                        onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-emerald-700"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Emergency Phone
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 9876543211"
                        value={formData.emergency_phone}
                        onChange={(e) => setFormData({ ...formData, emergency_phone: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="email"
                        placeholder="employee@company.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Aadhaar Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="XXXX XXXX XXXX"
                      value={formData.aadhaar_number}
                      onChange={(e) => setFormData({ ...formData, aadhaar_number: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Residential Address <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      required
                      placeholder="Door No, Street Name, City, PIN"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Backup PIN (4 digits)</label>
                      <input
                        type="text"
                        maxLength={6}
                        required
                        value={formData.pin}
                        onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Avatar Image URL (Optional)</label>
                      <input
                        type="text"
                        placeholder="https://..."
                        value={formData.avatar}
                        onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: EMPLOYEE BANK DETAILS */}
              {editTab === 'bank' && (
                <div className="space-y-4">
                  <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-3.5 flex items-start space-x-3 text-blue-900">
                    <Landmark className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-xs">Employee Bank Information</h4>
                      <p className="text-[11px] text-blue-700 mt-0.5">
                        Update salary deposit account, IFSC routing code, branch location, and PAN card number.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Bank Name <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Landmark className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="e.g. State Bank of India, HDFC Bank"
                          value={formData.bank_name}
                          onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-slate-800"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Bank Account Number <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="e.g. 50100234567890"
                          value={formData.account_number}
                          onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold text-slate-800"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Bank IFSC Code <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="e.g. SBIN0001234 / HDFC0001234"
                          value={formData.ifsc_code}
                          onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value.toUpperCase() })}
                          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg font-mono uppercase focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold text-slate-800"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Account Holder Name
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="As printed on bank passbook"
                          value={formData.account_holder_name}
                          onChange={(e) => setFormData({ ...formData, account_holder_name: e.target.value })}
                          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-slate-800"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Bank Branch Name
                      </label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="e.g. Anna Nagar Branch, Chennai"
                          value={formData.branch_name}
                          onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
                          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        PAN Card Number
                      </label>
                      <div className="relative">
                        <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          maxLength={10}
                          placeholder="e.g. ABCDE1234F"
                          value={formData.pan_number}
                          onChange={(e) => setFormData({ ...formData, pan_number: e.target.value.toUpperCase() })}
                          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg font-mono uppercase focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: 4 REQUIRED DOCUMENTS */}
              {editTab === 'req_docs' && (
                <div className="space-y-4">
                  <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5 flex items-start space-x-3 text-emerald-950">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-xs">Mandatory Verification Documents (4 Required)</h4>
                      <p className="text-[11px] text-emerald-800 mt-0.5">
                        These 4 documents are required for government compliance: Aadhaar Card, PAN Card, Official Photo, and Bank First Page.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {REQUIRED_DOCS.map((doc) => {
                      const docVal = doc.key === 'doc_photo' ? (formData.doc_photo || formData.avatar) : formData[doc.key];
                      const isUploading = uploadingDocKey === doc.key;

                      return (
                        <div
                          key={doc.key}
                          className={`p-3.5 rounded-xl border transition-all ${
                            docVal
                              ? 'bg-white border-emerald-300 shadow-xs ring-1 ring-emerald-500/10'
                              : 'bg-slate-50/80 border-dashed border-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-2">
                              {doc.key === 'doc_photo' ? (
                                <ImageIcon className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <FileText className="w-4 h-4 text-emerald-600" />
                              )}
                              <div>
                                <h5 className="font-bold text-slate-800 text-xs">{doc.label}</h5>
                                <p className="text-[10px] text-slate-500">{doc.desc}</p>
                              </div>
                            </div>
                            {docVal ? (
                              <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Uploaded</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                <AlertCircle className="w-3 h-3" />
                                <span>Required</span>
                              </span>
                            )}
                          </div>

                          {/* Preview / Action Buttons */}
                          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                            {docVal ? (
                              <div className="flex items-center space-x-2">
                                <button
                                  type="button"
                                  onClick={() => setPreviewDoc({ title: doc.label, url: docVal })}
                                  className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold text-[11px] transition-colors"
                                >
                                  <Eye className="w-3 h-3 text-slate-600" />
                                  <span>Preview</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDoc(doc.key)}
                                  className="p-1 text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                                  title="Remove document"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">No file attached</span>
                            )}

                            {/* Upload / Replace Input */}
                            <label className="cursor-pointer inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md font-semibold text-[11px] transition-colors">
                              {isUploading ? (
                                <>
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  <span>Uploading...</span>
                                </>
                              ) : (
                                <>
                                  <Upload className="w-3 h-3" />
                                  <span>{docVal ? 'Replace' : 'Upload'}</span>
                                </>
                              )}
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                className="hidden"
                                disabled={isUploading}
                                onChange={(e) => handleDocUpload(doc.key, e)}
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 4: ACADEMIC & QUALIFICATION DOCUMENTS */}
              {editTab === 'academic_docs' && (
                <div className="space-y-4">
                  <div className="bg-purple-50/70 border border-purple-200/80 rounded-xl p-3.5 flex items-start space-x-3 text-purple-950">
                    <GraduationCap className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-xs">Educational & Academic Documents</h4>
                      <p className="text-[11px] text-purple-800 mt-0.5">
                        Upload employee academic records: 10th marksheet, 12th marksheet, college degree certificate, and consolidated marksheet.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {ACADEMIC_DOCS.map((doc) => {
                      const docVal = formData[doc.key];
                      const isUploading = uploadingDocKey === doc.key;

                      return (
                        <div
                          key={doc.key}
                          className={`p-3.5 rounded-xl border transition-all ${
                            docVal
                              ? 'bg-white border-purple-300 shadow-xs ring-1 ring-purple-500/10'
                              : 'bg-slate-50/80 border-dashed border-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-2">
                              <GraduationCap className="w-4 h-4 text-purple-600" />
                              <div>
                                <h5 className="font-bold text-slate-800 text-xs">{doc.label}</h5>
                                <p className="text-[10px] text-slate-500">{doc.desc}</p>
                              </div>
                            </div>
                            {docVal ? (
                              <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-purple-700 bg-purple-100/70 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3 text-purple-600" />
                                <span>Attached</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                                Optional
                              </span>
                            )}
                          </div>

                          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                            {docVal ? (
                              <div className="flex items-center space-x-2">
                                <button
                                  type="button"
                                  onClick={() => setPreviewDoc({ title: doc.label, url: docVal })}
                                  className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold text-[11px] transition-colors"
                                >
                                  <Eye className="w-3 h-3 text-slate-600" />
                                  <span>Preview</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDoc(doc.key)}
                                  className="p-1 text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                                  title="Remove document"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Not attached</span>
                            )}

                            <label className="cursor-pointer inline-flex items-center space-x-1 px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-md font-semibold text-[11px] transition-colors">
                              {isUploading ? (
                                <>
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  <span>Uploading...</span>
                                </>
                              ) : (
                                <>
                                  <Upload className="w-3 h-3" />
                                  <span>{docVal ? 'Replace' : 'Upload'}</span>
                                </>
                              )}
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                className="hidden"
                                disabled={isUploading}
                                onChange={(e) => handleDocUpload(doc.key, e)}
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Modal Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div className="text-[11px] text-slate-500">
                  {editTab === 'basic' && 'Next: Configure Bank Details'}
                  {editTab === 'bank' && 'Next: Upload 4 Required Documents'}
                  {editTab === 'req_docs' && 'Next: Upload Academic Qualifications'}
                  {editTab === 'academic_docs' && 'All sections ready for submission.'}
                </div>
                <div className="flex items-center space-x-2.5">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saveLoading}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm transition-colors flex items-center space-x-1.5"
                  >
                    {saveLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{editingEmp ? 'Save & Update Profile' : 'Create Employee'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* VIEW FULL EMPLOYEE PROFILE MODAL (WITH BANK & ALL DOCUMENTS)  */}
      {/* ============================================================== */}
      {viewingEmp && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <img
                    src={resolvePhotoUrl(viewingEmp.avatar || viewingEmp.doc_photo, viewingEmp.name)}
                    alt={viewingEmp.name}
                    onError={(e) => handleImageError(e, viewingEmp.name)}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-200 shadow-sm bg-slate-100"
                  />
                  {viewingEmp.has_face_enrolled ? (
                    <div className="absolute -bottom-1 -right-1 bg-emerald-600 text-white rounded-full p-1 border-2 border-white" title="FaceLock Enrolled">
                      <ScanFace className="w-3.5 h-3.5" />
                    </div>
                  ) : null}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-bold text-slate-800">{viewingEmp.name}</h3>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                      {viewingEmp.emp_id}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {viewingEmp.role}
                  </p>
                  <div className="flex items-center space-x-2 mt-1.5">
                    {viewingEmp.has_face_enrolled ? (
                      <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>FaceLock AI Registered</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        <span>FaceLock Pending</span>
                      </span>
                    )}

                    {viewingEmp.bank_name ? (
                      <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                        <Landmark className="w-3.5 h-3.5 text-blue-600" />
                        <span>Bank Verified</span>
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  onClick={() => {
                    const emp = viewingEmp;
                    setViewingEmp(null);
                    handleOpenEdit(emp);
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit Profile</span>
                </button>
                <button
                  onClick={() => setViewingEmp(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Profile Grid */}
            <div className="space-y-4 text-xs">
              {/* 1. Employment & Joining */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2.5">
                <h4 className="font-bold text-slate-700 uppercase text-[10px] tracking-wider">Employment Information</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Designation</span>
                    <span className="font-semibold text-slate-800">{viewingEmp.role || '--'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Date of Joining (DOJ)</span>
                    <span className="font-semibold text-slate-800">{viewingEmp.doj || viewingEmp.join_date || '--'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Salary Allocated</span>
                    <span className="font-bold text-emerald-700">{viewingEmp.salary || 'Not specified'}</span>
                  </div>
                </div>
              </div>

              {/* 2. Employee Bank Details */}
              <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-blue-900 uppercase text-[10px] tracking-wider flex items-center space-x-1.5">
                    <Landmark className="w-3.5 h-3.5 text-blue-700" />
                    <span>Employee Bank Account Details</span>
                  </h4>
                  {viewingEmp.bank_name ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                      Configured
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-full">
                      Not Configured
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Bank Name</span>
                    <span className="font-bold text-slate-800">{viewingEmp.bank_name || '--'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Account Number</span>
                    <span className="font-mono font-bold text-slate-800">{viewingEmp.account_number || '--'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">IFSC Code</span>
                    <span className="font-mono font-bold text-slate-800">{viewingEmp.ifsc_code || '--'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Account Holder Name</span>
                    <span className="font-semibold text-slate-800">{viewingEmp.account_holder_name || viewingEmp.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Branch Name</span>
                    <span className="font-semibold text-slate-800">{viewingEmp.branch_name || '--'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">PAN Card Number</span>
                    <span className="font-mono font-bold text-slate-800">{viewingEmp.pan_number || '--'}</span>
                  </div>
                </div>
              </div>

              {/* 3. Mandatory Documents (4 Required) */}
              <div className="p-4 bg-emerald-50/40 rounded-xl border border-emerald-100 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-emerald-900 uppercase text-[10px] tracking-wider flex items-center space-x-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Mandatory Verification Documents (4 Required)</span>
                  </h4>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    {getRequiredDocsCount(viewingEmp)}/4 Verified
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {REQUIRED_DOCS.map((doc) => {
                    const docVal = doc.key === 'doc_photo' ? (viewingEmp.doc_photo || viewingEmp.avatar) : viewingEmp[doc.key];

                    return (
                      <div
                        key={doc.key}
                        className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-2.5">
                          {docVal ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                          )}
                          <div>
                            <div className="font-bold text-slate-800 text-xs">{doc.label}</div>
                            <div className="text-[10px] text-slate-400">{doc.desc}</div>
                          </div>
                        </div>

                        {docVal ? (
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => setPreviewDoc({ title: doc.label, url: docVal })}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                              title="Preview Document"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <a
                              href={docVal}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                              title="Open in new window"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                            Missing
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. Academic Documents */}
              <div className="p-4 bg-purple-50/40 rounded-xl border border-purple-100 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-purple-900 uppercase text-[10px] tracking-wider flex items-center space-x-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-purple-700" />
                    <span>Academic & Educational Certificates</span>
                  </h4>
                  <span className="text-[10px] font-medium text-purple-700">
                    {[viewingEmp.doc_10th, viewingEmp.doc_12th, viewingEmp.doc_college, viewingEmp.doc_marksheet].filter(Boolean).length}/4 Attached
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {ACADEMIC_DOCS.map((doc) => {
                    const docVal = viewingEmp[doc.key];

                    return (
                      <div
                        key={doc.key}
                        className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-2.5">
                          <GraduationCap className="w-4 h-4 text-purple-600 shrink-0" />
                          <div>
                            <div className="font-bold text-slate-800 text-xs">{doc.label}</div>
                            <div className="text-[10px] text-slate-400">{doc.desc}</div>
                          </div>
                        </div>

                        {docVal ? (
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => setPreviewDoc({ title: doc.label, url: docVal })}
                              className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
                              title="Preview Document"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <a
                              href={docVal}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                              title="Open in new window"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded">
                            Not Attached
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 5. Contact Information */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2.5">
                <h4 className="font-bold text-slate-700 uppercase text-[10px] tracking-wider">Contact Information</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Phone Number</span>
                    <span className="font-semibold font-mono text-slate-800">{viewingEmp.phone || '--'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Emergency Phone</span>
                    <span className="font-semibold font-mono text-rose-700">{viewingEmp.emergency_phone || '--'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Email Address</span>
                    <span className="font-semibold text-slate-800">{viewingEmp.email || '--'}</span>
                  </div>
                </div>
              </div>

              {/* 6. Personal & Family Identity */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2.5">
                <h4 className="font-bold text-slate-700 uppercase text-[10px] tracking-wider">Family & Government Identity</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Father's Name</span>
                    <span className="font-semibold text-slate-800">{viewingEmp.father_name || '--'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Mother's Name</span>
                    <span className="font-semibold text-slate-800">{viewingEmp.mother_name || '--'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Spouse Name</span>
                    <span className="font-semibold text-slate-800">{viewingEmp.spouse_name || '--'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Aadhaar Number</span>
                    <span className="font-semibold font-mono text-slate-800">{viewingEmp.aadhaar_number || '--'}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-200/60">
                  <span className="text-slate-400 block text-[11px]">Residential Address</span>
                  <span className="font-medium text-slate-700">{viewingEmp.address || '--'}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setViewingEmp(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* INTERACTIVE DOCUMENT PREVIEW MODAL (IMAGE / PDF)               */}
      {/* ============================================================== */}
      {previewDoc && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center space-x-2">
                <FileCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-800 text-sm">
                  {previewDoc.title}
                </h3>
              </div>
              <div className="flex items-center space-x-2">
                <a
                  href={previewDoc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Full Window</span>
                </a>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-slate-900/5 flex items-center justify-center min-h-[300px]">
              {previewDoc.url.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewDoc.url}
                  title={previewDoc.title}
                  className="w-full h-[70vh] rounded-lg border border-slate-200 bg-white"
                />
              ) : (
                <img
                  src={previewDoc.url}
                  alt={previewDoc.title}
                  className="max-h-[72vh] max-w-full object-contain rounded-lg shadow-sm border border-slate-200 bg-white"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
