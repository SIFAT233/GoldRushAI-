import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    Building2,
    MapPin,
    TrendingUp,
    Package,
    ArrowRightLeft,
    Plus,
    X,
    Search,
    Filter,
    MoreVertical,
    Edit3,
    Trash2,
    Users,
    CheckCircle2,
    Clock,
    Truck,
    Phone,
    Mail,
    Eye,
    EyeOff,
    Loader2
} from 'lucide-react';

const BRANCHES_UPDATED_EVENT = 'shopowner:branches-updated';

const AdminControl = () => {
    const [branches, setBranches] = useState([]);
    const [transfers, setTransfers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [newTransfer, setNewTransfer] = useState({
        from_branch: 'Main Branch',
        to_branch: 'Main Branch',
        items: ''
    });

    const [showBranchModal, setShowBranchModal] = useState(false);
    const [viewTransfer, setViewTransfer] = useState(null); // For View Details Modal
    const [newBranch, setNewBranch] = useState({ name: '', location: '', branch_passcode: '' });

    const [editingBranch, setEditingBranch] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showStaffModal, setShowStaffModal] = useState(false);
    const [selectedBranch, setSelectedBranch] = useState(null);
    const [staffList, setStaffList] = useState([]);
    const [staffLoading, setStaffLoading] = useState(false);
    const [staffError, setStaffError] = useState('');
    const [staffForm, setStaffForm] = useState({
        full_name: '',
        phone: '',
        email: '',
        role: '',
        status: 'Active'
    });
    const [staffSaving, setStaffSaving] = useState(false);
    const [staffFormError, setStaffFormError] = useState('');
    const [showStaffForm, setShowStaffForm] = useState(false);
    const [editingStaff, setEditingStaff] = useState(null);
    const [showNewBranchPasscode, setShowNewBranchPasscode] = useState(false);
    const [showEditBranchPasscode, setShowEditBranchPasscode] = useState(false);
    const [branchUpdateSaving, setBranchUpdateSaving] = useState(false);

    const normalizePasscode = (value) => {
        const banglaToEnglish = {
            '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
            '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
        };
        const normalized = String(value || '')
            .split('')
            .map((ch) => banglaToEnglish[ch] ?? ch)
            .join('');
        return normalized.replace(/\D/g, '').slice(0, 6);
    };
    const isMainBranch = (value) => value === true || value === 1 || String(value) === '1' || String(value).toLowerCase() === 'true';
    const activeBranch = localStorage.getItem('activeBranch') || 'Main Branch';
    const activeBranchIsMain = localStorage.getItem('activeBranchIsMain') === 'true';
    const branchNamesMatch = (left, right) => String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const shopownerId = localStorage.getItem('shopownerId');
            const userId = localStorage.getItem('userId');
            const activeBranchParam = `activeBranch=${encodeURIComponent(activeBranch)}`;
            const queryParam = shopownerId
                ? `shopownerId=${shopownerId}&${activeBranchParam}`
                : `userId=${userId}&${activeBranchParam}`;

            const [branchesRes, transfersRes] = await Promise.all([
                fetch(`/api/branches?${queryParam}`),
                fetch(`/api/stock-transfers?${queryParam}`)
            ]);
            const branchesData = await branchesRes.json();
            const transfersData = await transfersRes.json();

            const nextBranches = Array.isArray(branchesData) ? branchesData : [];
            const nextTransfers = Array.isArray(transfersData) ? transfersData : [];
            setBranches(nextBranches);
            setTransfers(nextTransfers);
            if (nextBranches.length > 0) {
                const defaultFrom = activeBranchIsMain
                    ? nextBranches[0].name
                    : (nextBranches.find((b) => branchNamesMatch(b.name, activeBranch))?.name || nextBranches[0].name);
                const defaultTo = nextBranches.find((b) => !branchNamesMatch(b.name, defaultFrom))?.name || defaultFrom;
                setNewTransfer({ from_branch: defaultFrom, to_branch: defaultTo, items: '' });
            }
            setLoading(false);
        } catch (err) {
            console.error("Error fetching admin data:", err);
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        if (!activeBranchIsMain && e.target.name === 'from_branch') {
            setNewTransfer({ ...newTransfer, from_branch: activeBranch });
            return;
        }
        setNewTransfer({ ...newTransfer, [e.target.name]: e.target.value });
    };

    const handleBranchInputChange = (e) => {
        const { name, value } = e.target;
        if (name === 'branch_passcode') {
            setNewBranch({ ...newBranch, branch_passcode: normalizePasscode(value) });
            return;
        }
        setNewBranch({ ...newBranch, [name]: value });
    };

    const handleEditBranchChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name === 'branch_passcode') {
            setEditingBranch({ ...editingBranch, branch_passcode: normalizePasscode(value) });
            return;
        }
        if (type === 'checkbox') {
            setEditingBranch({ ...editingBranch, [name]: checked ? 1 : 0 });
            return;
        }
        setEditingBranch({ ...editingBranch, [name]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const shopownerId = localStorage.getItem('shopownerId');
            const userId = localStorage.getItem('userId');

            const res = await fetch('/api/stock-transfers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newTransfer, shopownerId, userId, activeBranch })
            });
            if (res.ok) {
                setShowModal(false);
                setNewTransfer({
                    from_branch: activeBranchIsMain ? 'Main Branch' : activeBranch,
                    to_branch: activeBranch,
                    items: ''
                });
                fetchData();
            }
        } catch (err) {
            console.error("Error creating transfer:", err);
        }
    };

    const handleAddBranch = async (e) => {
        e.preventDefault();
        if (!activeBranchIsMain) {
            alert('Only main branch can add new branches.');
            return;
        }
        const passcode = String(newBranch.branch_passcode || '').trim();
        if (!/^\d{6}$/.test(passcode)) {
            alert('Branch passcode must be a 6-digit number.');
            return;
        }
        try {
            // Add IDs
            const payload = {
                ...newBranch,
                branch_passcode: passcode,
                shopownerId: localStorage.getItem('shopownerId'),
                userId: localStorage.getItem('userId'),
                activeBranch
            };

            const res = await fetch('/api/branches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                setShowBranchModal(false);
                setShowNewBranchPasscode(false);
                setNewBranch({ name: '', location: '', branch_passcode: '' });
                window.dispatchEvent(new CustomEvent(BRANCHES_UPDATED_EVENT));
                fetchData();
            } else {
                const errData = await res.json().catch(() => ({}));
                alert(errData.error || 'Failed to create branch');
            }
        } catch (err) {
            console.error("Error creating branch:", err);
        }
    };

    const handleUpdateBranch = async (e) => {
        e.preventDefault();
        if (branchUpdateSaving) return;
        const nextPasscode = String(editingBranch.branch_passcode || '').trim();
        if (nextPasscode && !/^\d{6}$/.test(nextPasscode)) {
            alert('Passcode must be exactly 6 digits.');
            return;
        }
        try {
            setBranchUpdateSaving(true);
            const payload = {
                ...editingBranch,
                daily_sales: Number.isFinite(Number(editingBranch.daily_sales)) ? Number(editingBranch.daily_sales) : 0,
                stock_value: editingBranch.stock_value === undefined || editingBranch.stock_value === null
                    ? ''
                    : String(editingBranch.stock_value),
                shopownerId: localStorage.getItem('shopownerId'),
                userId: localStorage.getItem('userId'),
                activeBranch
            };
            const res = await fetch(`/api/branches/${editingBranch.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                const nextIsMain = isMainBranch(payload.is_main);
                setBranches((prev) => prev.map((branch) => {
                    const isTarget = branch.id === payload.id;
                    if (isTarget) {
                        return {
                            ...branch,
                            name: payload.name,
                            location: payload.location,
                            daily_sales: payload.daily_sales,
                            stock_value: payload.stock_value,
                            status: payload.status,
                            is_main: nextIsMain ? 1 : 0
                        };
                    }
                    if (nextIsMain) {
                        return { ...branch, is_main: 0 };
                    }
                    return branch;
                }));
                setShowEditBranchPasscode(false);
                setEditingBranch(null);
                window.dispatchEvent(new CustomEvent(BRANCHES_UPDATED_EVENT));
                fetchData();
            } else {
                const errData = await res.json().catch(() => ({}));
                alert(errData.error || 'Failed to update branch');
            }
        } catch (err) {
            console.error("Error updating branch:", err);
        } finally {
            setBranchUpdateSaving(false);
        }
    };

    const handleDeleteBranch = async (id) => {
        if (!window.confirm("Are you sure you want to delete this branch? This cannot be undone.")) return;
        try {
            const shopownerId = localStorage.getItem('shopownerId');
            const userId = localStorage.getItem('userId');
            const queryParam = shopownerId
                ? `shopownerId=${encodeURIComponent(shopownerId)}&activeBranch=${encodeURIComponent(activeBranch)}`
                : `userId=${encodeURIComponent(userId)}&activeBranch=${encodeURIComponent(activeBranch)}`;
            const res = await fetch(`/api/branches/${id}?${queryParam}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setShowEditBranchPasscode(false);
                setEditingBranch(null);
                window.dispatchEvent(new CustomEvent(BRANCHES_UPDATED_EVENT));
                fetchData();
            }
        } catch (err) {
            console.error("Error deleting branch:", err);
        }
    };

    const handleStatusClick = async (id, currentStatus) => {
        const statuses = ['Pending', 'In Transit', 'Received'];
        const nextStatusIndex = (statuses.indexOf(currentStatus) + 1) % statuses.length;
        const nextStatus = statuses[nextStatusIndex];

        if (!window.confirm(`Change status from '${currentStatus}' to '${nextStatus}'?`)) return;

        try {
            const shopownerId = localStorage.getItem('shopownerId');
            const userId = localStorage.getItem('userId');
            const res = await fetch(`/api/stock-transfers/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: nextStatus, shopownerId, userId, activeBranch })
            });

            if (res.ok) {
                setTransfers(transfers.map(t => t.id === id ? { ...t, status: nextStatus } : t));
                if (viewTransfer && viewTransfer.id === id) {
                    setViewTransfer({ ...viewTransfer, status: nextStatus });
                }
            }
        } catch (err) {
            console.error("Error updating status:", err);
        }
    };

    const openStaffModal = async (branch) => {
        setSelectedBranch(branch);
        setShowStaffModal(true);
        setStaffLoading(true);
        setStaffError('');
        setStaffList([]);
        setShowStaffForm(false);
        setEditingStaff(null);
        setStaffForm({
            full_name: '',
            phone: '',
            email: '',
            role: '',
            status: 'Active'
        });
        setStaffFormError('');

        try {
            const shopownerId = localStorage.getItem('shopownerId');
            const userId = localStorage.getItem('userId');
            const queryParam = shopownerId
                ? `shopownerId=${shopownerId}&activeBranch=${encodeURIComponent(activeBranch)}`
                : `userId=${userId}&activeBranch=${encodeURIComponent(activeBranch)}`;
            const res = await fetch(`/api/staff?branch=${encodeURIComponent(branch.name)}&${queryParam}`);

            if (!res.ok) {
                throw new Error('Failed to load staff');
            }

            const data = await res.json();
            setStaffList(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Error fetching staff:", err);
            setStaffError('Unable to load staff list right now.');
        } finally {
            setStaffLoading(false);
        }
    };

    const handleStaffInputChange = (e) => {
        const { name, value } = e.target;
        setStaffForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSaveStaff = async (e) => {
        e.preventDefault();
        setStaffFormError('');
        setStaffSaving(true);

        try {
            const shopownerId = localStorage.getItem('shopownerId');
            const userId = localStorage.getItem('userId');
            const isEdit = Boolean(editingStaff?.id);

            const payload = {
                ...staffForm,
                branch: selectedBranch?.name || 'Main Branch',
                shopownerId,
                userId,
                activeBranch
            };

            if (!payload.full_name.trim()) {
                setStaffFormError('Staff name is required.');
                setStaffSaving(false);
                return;
            }

            const res = await fetch(isEdit ? `/api/staff/${editingStaff.id}` : '/api/staff', {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to add staff');
            }

            const saved = await res.json();
            if (isEdit) {
                setStaffList((prev) => prev.map((staff) => (staff.id === saved.id ? saved : staff)));
            } else {
                setStaffList((prev) => [saved, ...prev]);
            }
            setStaffForm({
                full_name: '',
                phone: '',
                email: '',
                role: '',
                status: 'Active'
            });
            setShowStaffForm(false);
            setEditingStaff(null);
        } catch (err) {
            console.error("Error saving staff:", err);
            setStaffFormError(err.message || 'Unable to save staff.');
        } finally {
            setStaffSaving(false);
        }
    };

    const handleEditStaff = (staff) => {
        setEditingStaff(staff);
        setShowStaffForm(true);
        setStaffForm({
            full_name: staff.full_name || '',
            phone: staff.phone || '',
            email: staff.email || '',
            role: staff.role || '',
            status: staff.status || 'Active'
        });
        setStaffFormError('');
    };

    const handleDeleteStaff = async (id) => {
        if (!window.confirm('Delete this staff member?')) return;
        try {
            const shopownerId = localStorage.getItem('shopownerId');
            const userId = localStorage.getItem('userId');
            const queryParam = shopownerId
                ? `shopownerId=${shopownerId}&activeBranch=${encodeURIComponent(activeBranch)}`
                : `userId=${userId}&activeBranch=${encodeURIComponent(activeBranch)}`;

            const res = await fetch(`/api/staff/${id}?${queryParam}`, {
                method: 'DELETE'
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to delete staff');
            }

            setStaffList((prev) => prev.filter((staff) => staff.id !== id));
            if (editingStaff?.id === id) {
                setEditingStaff(null);
                setShowStaffForm(false);
            }
        } catch (err) {
            console.error("Error deleting staff:", err);
            setStaffFormError(err.message || 'Unable to delete staff.');
        }
    };

    const filteredTransfers = transfers.filter(t =>
        t.from_branch.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.to_branch.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.items.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.transfer_id.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const fromBranchOptions = activeBranchIsMain
        ? branches
        : branches.filter((branch) => branchNamesMatch(branch.name, activeBranch));
    const toBranchOptions = branches;

    if (loading) return (
        <div className="flex h-screen items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-primary-gold border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-400 font-medium">Loading Dashboard...</p>
            </div>
        </div>
    );

    return (
        <div className="space-y-8 animate-fade-in pb-10">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Admin & Branch Control</h1>
                    <p className="text-gray-400 mt-1">Manage your shop branches and stock transfers efficiently</p>
                </div>
                {activeBranchIsMain && (
                    <button
                        onClick={() => {
                            setShowNewBranchPasscode(false);
                            setShowBranchModal(true);
                        }}
                        className="flex items-center gap-2 bg-gradient-to-r from-primary-gold to-yellow-500 text-black px-5 py-2.5 rounded-xl font-bold hover:shadow-lg hover:shadow-primary-gold/20 transition-all duration-300 transform hover:-translate-y-0.5"
                    >
                        <Plus className="w-5 h-5" />
                        Add New Branch
                    </button>
                )}
            </div>

            {/* Branch Overview Section */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-white/80 font-medium pb-2">
                    <Building2 className="w-5 h-5 text-primary-gold" />
                    <h2>Branch Overview</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {branches.map((branch) => (
                        <div key={branch.id} className="group relative bg-[#121418] rounded-2xl border border-white/5 overflow-hidden hover:border-primary-gold/30 transition-all duration-300 shadow-lg hover:shadow-xl">
                            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                {(activeBranchIsMain || branchNamesMatch(branch.name, activeBranch)) && (
                                    <button
                                        onClick={() => {
                                            setShowEditBranchPasscode(false);
                                            setEditingBranch({ ...branch, is_main: isMainBranch(branch.is_main) ? 1 : 0, branch_passcode: '' });
                                        }}
                                        className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white backdrop-blur-sm transition-colors"
                                        title="Edit Branch"
                                    >
                                        <Edit3 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            <div className="p-6">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10 flex items-center justify-center shrink-0">
                                            <Building2 className="w-6 h-6 text-primary-gold" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-xl font-bold text-white group-hover:text-primary-gold transition-colors">{branch.name}</h3>
                                                {isMainBranch(branch.is_main) && (
                                                    <span className="inline-flex items-center rounded-full border border-primary-gold/30 bg-primary-gold/10 px-2 py-0.5 text-[11px] font-semibold text-primary-gold">
                                                        Main
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-gray-400 text-sm mt-1">
                                                <MapPin className="w-3.5 h-3.5" />
                                                {branch.location}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                                        <p className="text-gray-400 text-xs font-medium mb-1 flex items-center gap-1">
                                            <TrendingUp className="w-3 h-3" /> Daily Sales
                                        </p>
                                        <p className="text-lg font-bold text-white">৳ {branch.daily_sales?.toLocaleString() || 0}</p>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                                        <p className="text-gray-400 text-xs font-medium mb-1 flex items-center gap-1">
                                            <Package className="w-3 h-3" /> Stock Value
                                        </p>
                                        <p className="text-lg font-bold text-primary-gold">৳ {branch.stock_value || 0}</p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${branch.status === 'Active'
                                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                                        }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${branch.status === 'Active' ? 'bg-green-400' : 'bg-red-400'}`}></span>
                                        {branch.status}
                                    </span>

                                    <button
                                        onClick={() => openStaffModal(branch)}
                                        className="text-sm text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
                                    >
                                        <Users className="w-4 h-4" />
                                        Manage Staff
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {activeBranchIsMain && (
                        <button
                            onClick={() => {
                                setShowNewBranchPasscode(false);
                                setShowBranchModal(true);
                            }}
                            className="group flex flex-col items-center justify-center gap-4 bg-[#121418] rounded-2xl border border-dashed border-white/10 hover:border-primary-gold/50 hover:bg-white/5 transition-all duration-300 min-h-[250px]"
                        >
                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                <Plus className="w-8 h-8 text-gray-400 group-hover:text-primary-gold" />
                            </div>
                            <span className="text-gray-400 font-medium group-hover:text-white transition-colors">Add Another Branch</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Stock Transfer Section */}
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
                    <div className="flex items-center gap-2 text-white/80 font-medium">
                        <ArrowRightLeft className="w-5 h-5 text-primary-gold" />
                        <h2>Inter-Branch Stock Transfers</h2>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search transfers..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-[#121418] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-gold/50 focus:ring-1 focus:ring-primary-gold/50 transition-all"
                            />
                        </div>
                        <button
                            onClick={() => setShowModal(true)}
                            className="bg-white/5 text-white px-4 py-2 rounded-xl border border-white/10 hover:bg-white/10 hover:border-primary-gold/30 transition-all flex items-center gap-2 text-sm font-medium whitespace-nowrap"
                        >
                            <Plus className="w-4 h-4" />
                            New Transfer
                        </button>
                    </div>
                </div>

                <div className="bg-[#121418] rounded-2xl border border-white/5 overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-white/5 bg-white/[0.02]">
                                    <th className="p-5 font-medium text-gray-400">Transfer ID</th>
                                    <th className="p-5 font-medium text-gray-400">Route</th>
                                    <th className="p-5 font-medium text-gray-400">Items Summary</th>
                                    <th className="p-5 font-medium text-gray-400">Date</th>
                                    <th className="p-5 font-medium text-gray-400">Status</th>
                                    <th className="p-5 font-medium text-gray-400 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {!filteredTransfers.length ? (
                                    <tr>
                                        <td colSpan="6" className="p-12 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                                                    <Search className="w-6 h-6 text-gray-600" />
                                                </div>
                                                <p className="text-gray-400">No transfers found matching your search.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTransfers.map((transfer) => (
                                        <tr key={transfer.id} className="group hover:bg-white/[0.02] transition-colors">
                                            <td className="p-5">
                                                <span className="font-mono text-xs bg-white/5 px-2 py-1 rounded text-gray-300 border border-white/5">
                                                    {transfer.transfer_id}
                                                </span>
                                            </td>
                                            <td className="p-5">
                                                <div className="flex items-center gap-2 text-white">
                                                    <span className="font-medium">{transfer.from_branch}</span>
                                                    <ArrowRightLeft className="w-3.5 h-3.5 text-gray-500" />
                                                    <span className="font-medium">{transfer.to_branch}</span>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <div className="max-w-[200px] truncate text-gray-400" title={transfer.items}>
                                                    {transfer.items}
                                                </div>
                                            </td>
                                            <td className="p-5 text-gray-400">
                                                {new Date(transfer.transfer_date).toLocaleDateString()}
                                                <span className="text-xs text-gray-600 block">{new Date(transfer.transfer_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </td>
                                            <td className="p-5">
                                                <button
                                                    onClick={() => handleStatusClick(transfer.id, transfer.status)}
                                                    className={`
                                                        px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-all
                                                        ${transfer.status === 'Received'
                                                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                                            : transfer.status === 'In Transit'
                                                                ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                                                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}
                                                    `}
                                                >
                                                    {transfer.status === 'Received' && <CheckCircle2 className="w-3 h-3" />}
                                                    {transfer.status === 'In Transit' && <Truck className="w-3 h-3" />}
                                                    {transfer.status === 'Pending' && <Clock className="w-3 h-3" />}
                                                    {transfer.status}
                                                </button>
                                            </td>
                                            <td className="p-5 text-right">
                                                <button
                                                    onClick={() => setViewTransfer(transfer)}
                                                    className="text-primary-gold hover:text-white font-medium text-sm hover:underline underline-offset-4 decoration-primary-gold/50 transition-all"
                                                >
                                                    View Details
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Reusable Modal Component */}
            {(showModal || showBranchModal || editingBranch || viewTransfer || showStaffModal) && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
                        onClick={() => {
                            if (branchUpdateSaving && editingBranch) return;
                            setShowModal(false);
                            setShowBranchModal(false);
                            setShowNewBranchPasscode(false);
                            setShowEditBranchPasscode(false);
                            setNewBranch({ name: '', location: '', branch_passcode: '' });
                            setEditingBranch(null);
                            setViewTransfer(null);
                            setShowStaffModal(false);
                            setSelectedBranch(null);
                            setShowStaffForm(false);
                            setEditingStaff(null);
                        }}
                    ></div>
                    <div className="relative bg-[#1a1d24] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl transform transition-all animate-scale-in overflow-hidden">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/[0.02]">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                {showModal && <><ArrowRightLeft className="w-5 h-5 text-primary-gold" /> New Stock Transfer</>}
                                {showBranchModal && <><Building2 className="w-5 h-5 text-primary-gold" /> Add New Branch</>}
                                {editingBranch && <><Edit3 className="w-5 h-5 text-primary-gold" /> Edit Branch Info</>}
                                {viewTransfer && <><Package className="w-5 h-5 text-primary-gold" /> Transfer Details</>}
                                {showStaffModal && <><Users className="w-5 h-5 text-primary-gold" /> Manage Staff</>}
                            </h2>
                            <button
                                onClick={() => {
                                    if (branchUpdateSaving && editingBranch) return;
                                    setShowModal(false);
                                    setShowBranchModal(false);
                                    setShowNewBranchPasscode(false);
                                    setShowEditBranchPasscode(false);
                                    setNewBranch({ name: '', location: '', branch_passcode: '' });
                                    setEditingBranch(null);
                                    setViewTransfer(null);
                                    setShowStaffModal(false);
                                    setSelectedBranch(null);
                                    setShowStaffForm(false);
                                    setEditingStaff(null);
                                }}
                                className={`text-gray-400 transition-colors ${branchUpdateSaving && editingBranch ? 'cursor-not-allowed opacity-50' : 'hover:text-white'}`}
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
                            {showModal && (
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-400">From Branch</label>
                                            <div className="relative">
                                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                                <select
                                                    name="from_branch"
                                                    value={newTransfer.from_branch}
                                                    onChange={handleInputChange}
                                                    disabled={!activeBranchIsMain}
                                                    className="w-full bg-[#121418] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-primary-gold/50 focus:ring-1 focus:ring-primary-gold/50 appearance-none"
                                                >
                                                    {fromBranchOptions.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-400">To Branch</label>
                                            <div className="relative">
                                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                                <select
                                                    name="to_branch"
                                                    value={newTransfer.to_branch}
                                                    onChange={handleInputChange}
                                                    className="w-full bg-[#121418] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-primary-gold/50 focus:ring-1 focus:ring-primary-gold/50 appearance-none"
                                                >
                                                    {toBranchOptions.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-400">Items / Description</label>
                                        <textarea
                                            name="items"
                                            required
                                            value={newTransfer.items}
                                            onChange={handleInputChange}
                                            className="w-full bg-[#121418] border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-primary-gold/50 focus:ring-1 focus:ring-primary-gold/50 h-32 resize-none placeholder-gray-600"
                                            placeholder="List items, quantities, and any specific details..."
                                        ></textarea>
                                    </div>
                                    <div className="pt-4 flex gap-3">
                                        <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-white/5 hover:bg-white/10 text-white py-2.5 rounded-xl font-medium transition-colors">Cancel</button>
                                        <button type="submit" className="flex-1 bg-primary-gold text-black py-2.5 rounded-xl font-bold hover:bg-yellow-400 transition-colors shadow-lg shadow-primary-gold/20">Create Transfer</button>
                                    </div>
                                </form>
                            )}

                            {showBranchModal && (
                                <form onSubmit={handleAddBranch} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-400">Branch Name</label>
                                        <div className="relative">
                                            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                            <input type="text" name="name" required value={newBranch.name} onChange={handleBranchInputChange} className="w-full bg-[#121418] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-primary-gold/50 focus:ring-1 focus:ring-primary-gold/50" placeholder="e.g. Sylhet Branch" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-400">Location</label>
                                        <div className="relative">
                                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                            <input type="text" name="location" required value={newBranch.location} onChange={handleBranchInputChange} className="w-full bg-[#121418] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-primary-gold/50 focus:ring-1 focus:ring-primary-gold/50" placeholder="e.g. Zindabazar, Sylhet" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-400">Branch Passcode (6 digits)</label>
                                        <div className="relative">
                                            <input
                                                type={showNewBranchPasscode ? 'text' : 'password'}
                                                name="branch_passcode"
                                                required
                                                maxLength="6"
                                                inputMode="numeric"
                                                pattern="[0-9]{6}"
                                                value={newBranch.branch_passcode}
                                                onChange={handleBranchInputChange}
                                                className="w-full bg-[#121418] border border-white/10 rounded-xl px-4 pr-11 py-2.5 text-white focus:outline-none focus:border-primary-gold/50 focus:ring-1 focus:ring-primary-gold/50"
                                                placeholder="e.g. 123456"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowNewBranchPasscode((prev) => !prev)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                                                aria-label={showNewBranchPasscode ? 'Hide passcode' : 'Show passcode'}
                                            >
                                                {showNewBranchPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="pt-4 flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowBranchModal(false);
                                                setShowNewBranchPasscode(false);
                                                setNewBranch({ name: '', location: '', branch_passcode: '' });
                                            }}
                                            className="flex-1 bg-white/5 hover:bg-white/10 text-white py-2.5 rounded-xl font-medium transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button type="submit" className="flex-1 bg-primary-gold text-black py-2.5 rounded-xl font-bold hover:bg-yellow-400 transition-colors shadow-lg shadow-primary-gold/20">Add Branch</button>
                                    </div>
                                </form>
                            )}

                            {editingBranch && (
                                <form onSubmit={handleUpdateBranch} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-400">Branch Name</label>
                                        <input type="text" name="name" required value={editingBranch.name} onChange={handleEditBranchChange} className="w-full bg-[#121418] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary-gold/50 focus:ring-1 focus:ring-primary-gold/50" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-400">Location</label>
                                        <input type="text" name="location" required value={editingBranch.location} onChange={handleEditBranchChange} className="w-full bg-[#121418] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary-gold/50 focus:ring-1 focus:ring-primary-gold/50" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-400">Daily Sales (৳)</label>
                                            <input type="number" name="daily_sales" value={editingBranch.daily_sales} onChange={handleEditBranchChange} className="w-full bg-[#121418] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary-gold/50 focus:ring-1 focus:ring-primary-gold/50" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-400">Stock Value</label>
                                            <input type="text" name="stock_value" value={editingBranch.stock_value} onChange={handleEditBranchChange} className="w-full bg-[#121418] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary-gold/50 focus:ring-1 focus:ring-primary-gold/50" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-400">Status</label>
                                        <select name="status" value={editingBranch.status} onChange={handleEditBranchChange} className="w-full bg-[#121418] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary-gold/50 focus:ring-1 focus:ring-primary-gold/50">
                                            <option value="Active">Active</option>
                                            <option value="Inactive">Inactive</option>
                                            <option value="Maintenance">Maintenance</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-400">Main Branch</label>
                                        <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#121418] px-4 py-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                name="is_main"
                                                checked={isMainBranch(editingBranch.is_main)}
                                                onChange={handleEditBranchChange}
                                                disabled={isMainBranch(editingBranch.is_main) || !activeBranchIsMain}
                                                className="h-4 w-4 accent-[#D4AF37] disabled:opacity-80 disabled:cursor-not-allowed"
                                            />
                                            <span className="text-sm text-white">
                                                {isMainBranch(editingBranch.is_main) ? 'Current main branch' : (activeBranchIsMain ? 'Set as main branch' : 'Only main branch can change this')}
                                            </span>
                                        </label>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-400">Change Branch Passcode (6 digits)</label>
                                        <div className="relative">
                                            <input
                                                type={showEditBranchPasscode ? 'text' : 'password'}
                                                name="branch_passcode"
                                                maxLength="6"
                                                inputMode="numeric"
                                                pattern="[0-9]{6}"
                                                value={editingBranch.branch_passcode || ''}
                                                onChange={handleEditBranchChange}
                                                className="w-full bg-[#121418] border border-white/10 rounded-xl px-4 pr-11 py-2.5 text-white focus:outline-none focus:border-primary-gold/50 focus:ring-1 focus:ring-primary-gold/50"
                                                placeholder="Leave empty to keep current"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowEditBranchPasscode((prev) => !prev)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                                                aria-label={showEditBranchPasscode ? 'Hide passcode' : 'Show passcode'}
                                            >
                                                {showEditBranchPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="pt-6 flex justify-between items-center border-t border-white/5 mt-6">
                                        {activeBranchIsMain ? (
                                            <button type="button" disabled={branchUpdateSaving} onClick={() => handleDeleteBranch(editingBranch.id)} className={`text-red-400 hover:text-red-300 text-sm font-medium flex items-center gap-1 hover:bg-red-400/10 px-3 py-2 rounded-lg transition-colors ${branchUpdateSaving ? 'opacity-50 cursor-not-allowed hover:bg-transparent' : ''}`}>
                                                <Trash2 className="w-4 h-4" /> Delete Branch
                                            </button>
                                        ) : <span />}
                                        <div className="flex gap-3">
                                            <button type="button" disabled={branchUpdateSaving} onClick={() => { setShowEditBranchPasscode(false); setEditingBranch(null); }} className={`bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl font-medium transition-colors ${branchUpdateSaving ? 'opacity-50 cursor-not-allowed hover:bg-white/5' : ''}`}>Cancel</button>
                                            <button type="submit" disabled={branchUpdateSaving} className={`bg-primary-gold text-black px-6 py-2 rounded-xl font-bold transition-colors shadow-lg shadow-primary-gold/20 flex items-center gap-2 ${branchUpdateSaving ? 'opacity-80 cursor-not-allowed' : 'hover:bg-yellow-400'}`}>
                                                {branchUpdateSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                                                {branchUpdateSaving ? 'Saving...' : 'Save'}
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            )}

                            {viewTransfer && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-6 p-4 bg-white/5 rounded-xl border border-white/5">
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1">Transfer ID</label>
                                            <p className="text-white font-mono text-lg">{viewTransfer.transfer_id}</p>
                                        </div>
                                        <div className="text-right">
                                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1">Date</label>
                                            <p className="text-white">{new Date(viewTransfer.transfer_date).toLocaleDateString()}</p>
                                            <p className="text-gray-500 text-sm">{new Date(viewTransfer.transfer_date).toLocaleTimeString()}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="flex-1 p-4 bg-[#121418] border border-white/10 rounded-xl text-center">
                                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1">From</label>
                                            <p className="text-white font-bold">{viewTransfer.from_branch}</p>
                                        </div>
                                        <ArrowRightLeft className="w-6 h-6 text-gray-600" />
                                        <div className="flex-1 p-4 bg-[#121418] border border-white/10 rounded-xl text-center">
                                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1">To</label>
                                            <p className="text-white font-bold">{viewTransfer.to_branch}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-sm font-medium text-gray-400 block mb-2">Current Status</label>
                                        <div className="flex items-center gap-2">
                                            {['Pending', 'In Transit', 'Received'].map((status, idx) => (
                                                <div key={status} className={`flex-1 h-2 rounded-full ${['Pending', 'In Transit', 'Received'].indexOf(viewTransfer.status) >= idx
                                                    ? status === 'Received' ? 'bg-green-500' : status === 'In Transit' ? 'bg-yellow-500' : 'bg-blue-500'
                                                    : 'bg-white/10'
                                                    }`}></div>
                                            ))}
                                        </div>
                                        <div className="mt-2 text-right">
                                            <span className={`inline-block px-3 py-1 rounded-lg text-sm font-bold border ${viewTransfer.status === 'Received' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                                viewTransfer.status === 'In Transit' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                                    'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                }`}>
                                                {viewTransfer.status}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="bg-[#121418] p-5 rounded-xl border border-white/5">
                                        <label className="text-sm font-medium text-white flex items-center gap-2 mb-3">
                                            <Package className="w-4 h-4 text-primary-gold" /> Items Content
                                        </label>
                                        <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{viewTransfer.items}</p>
                                    </div>

                                    <div className="pt-2">
                                        <button onClick={() => setViewTransfer(null)} className="w-full bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl font-medium transition-colors">Close Details</button>
                                    </div>
                                </div>
                            )}

                            {showStaffModal && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/5">
                                        <div>
                                            <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">Branch</p>
                                            <p className="text-white font-bold text-lg flex items-center gap-2">
                                                <Building2 className="w-4 h-4 text-primary-gold" />
                                                {selectedBranch?.name || 'Unknown Branch'}
                                            </p>
                                        </div>
                                        <div className="bg-primary-gold/10 text-primary-gold px-3 py-1 rounded-full text-xs font-bold border border-primary-gold/20">
                                            Total Staff: {staffList.length}
                                        </div>
                                    </div>

                                    {!showStaffForm && (
                                        <button
                                            onClick={() => {
                                                setEditingStaff(null);
                                                setStaffForm({
                                                    full_name: '',
                                                    phone: '',
                                                    email: '',
                                                    role: '',
                                                    status: 'Active'
                                                });
                                                setStaffFormError('');
                                                setShowStaffForm(true);
                                            }}
                                            className="w-full bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl font-medium transition-colors border border-white/10"
                                        >
                                            Add Staff
                                        </button>
                                    )}

                                    {showStaffForm && (
                                        <form onSubmit={handleSaveStaff} className="space-y-4 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                                    <div className="w-1 h-4 bg-primary-gold rounded-full"></div>
                                                    {editingStaff ? 'Edit Staff' : 'Add New Staff'}
                                                </h3>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowStaffForm(false);
                                                        setEditingStaff(null);
                                                        setStaffForm({
                                                            full_name: '',
                                                            phone: '',
                                                            email: '',
                                                            role: '',
                                                            status: 'Active'
                                                        });
                                                        setStaffFormError('');
                                                    }}
                                                    className="text-xs text-gray-400 hover:text-white transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            </div>

                                            {staffFormError && (
                                                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl flex items-center gap-2">
                                                    <X className="w-4 h-4" />
                                                    {staffFormError}
                                                </div>
                                            )}

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <label className="text-xs text-gray-500 ml-1">Full Name</label>
                                                    <input
                                                        type="text"
                                                        name="full_name"
                                                        value={staffForm.full_name}
                                                        onChange={handleStaffInputChange}
                                                        placeholder="e.g. John Doe"
                                                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary-gold/50 focus:bg-white/5 transition-all"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs text-gray-500 ml-1">Phone Number</label>
                                                    <input
                                                        type="text"
                                                        name="phone"
                                                        value={staffForm.phone}
                                                        onChange={handleStaffInputChange}
                                                        placeholder="e.g. 017..."
                                                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary-gold/50 focus:bg-white/5 transition-all"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs text-gray-500 ml-1">Email Address</label>
                                                    <input
                                                        type="email"
                                                        name="email"
                                                        value={staffForm.email}
                                                        onChange={handleStaffInputChange}
                                                        placeholder="john@example.com"
                                                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary-gold/50 focus:bg-white/5 transition-all"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs text-gray-500 ml-1">Role</label>
                                                    <input
                                                        type="text"
                                                        name="role"
                                                        value={staffForm.role}
                                                        onChange={handleStaffInputChange}
                                                        placeholder="e.g. Sales Manager"
                                                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary-gold/50 focus:bg-white/5 transition-all"
                                                    />
                                                </div>
                                                <div className="md:col-span-2 space-y-1">
                                                    <label className="text-xs text-gray-500 ml-1">Status</label>
                                                    <select
                                                        name="status"
                                                        value={staffForm.status}
                                                        onChange={handleStaffInputChange}
                                                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary-gold/50 focus:bg-white/5 transition-all cursor-pointer"
                                                    >
                                                        <option value="Active" className="bg-[#1a1d24]">Active</option>
                                                        <option value="Inactive" className="bg-[#1a1d24]">Inactive</option>
                                                    </select>
                                                </div>
                                            </div>

                                        <button
                                            type="submit"
                                            disabled={staffSaving}
                                            className="w-full bg-gradient-to-r from-primary-gold to-yellow-500 hover:from-yellow-400 hover:to-primary-gold text-black py-3 rounded-xl font-bold shadow-lg shadow-primary-gold/10 hover:shadow-primary-gold/30 transition-all transform hover:-translate-y-0.5 disabled:opacity-60 disabled:transform-none disabled:shadow-none"
                                        >
                                            {staffSaving ? (
                                                <span className="flex items-center justify-center gap-2">
                                                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                                                    {editingStaff ? 'Saving...' : 'Adding Staff...'}
                                                </span>
                                            ) : (
                                                editingStaff ? 'Save Changes' : 'Add Staff Member'
                                            )}
                                        </button>
                                    </form>
                                    )}

                                    {staffLoading && (
                                        <div className="flex flex-col items-center justify-center py-12 text-gray-500 gap-3">
                                            <div className="w-10 h-10 border-4 border-primary-gold/30 border-t-primary-gold rounded-full animate-spin"></div>
                                            <p className="text-sm animate-pulse">Loading staff list...</p>
                                        </div>
                                    )}

                                    {!staffLoading && staffError && (
                                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-4 rounded-xl flex items-center justify-center gap-2">
                                            <X className="w-5 h-5" />
                                            {staffError}
                                        </div>
                                    )}

                                    {!staffLoading && !staffError && staffList.length === 0 && (
                                        <div className="bg-white/5 border border-white/10 text-gray-400 text-sm p-8 rounded-2xl text-center flex flex-col items-center gap-3">
                                            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center">
                                                <Users className="w-6 h-6 text-gray-500" />
                                            </div>
                                            <p>No staff members found for this branch.</p>
                                        </div>
                                    )}

                                    {!staffLoading && !staffError && staffList.length > 0 && (
                                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                            {staffList.map((staff) => (
                                                <div key={staff.id} className="group bg-white/5 border border-white/5 hover:border-primary-gold/30 hover:bg-white/[0.07] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all">
                                                    <div className="flex items-center gap-4 min-w-0">
                                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 border border-white/10 flex items-center justify-center text-white font-bold shadow-inner shrink-0">
                                                            {staff.full_name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="space-y-0.5 min-w-0">
                                                            <p className="text-white font-bold flex items-center gap-2 min-w-0">
                                                                <span className="truncate" title={staff.full_name}>{staff.full_name}</span>
                                                                {staff.role && <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-gray-300 font-normal whitespace-nowrap">{staff.role}</span>}
                                                            </p>
                                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                                                                {staff.phone && <span className="flex items-center gap-1 whitespace-nowrap"><Phone className="w-3 h-3" /> {staff.phone}</span>}
                                                                {staff.email && <span className="flex items-center gap-1 truncate"><Mail className="w-3 h-3" /> <span className="truncate">{staff.email}</span></span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3 sm:ml-4 shrink-0">
                                                        <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 whitespace-nowrap ${staff.status === 'Inactive'
                                                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                                            : 'bg-green-500/10 text-green-400 border-green-500/20'
                                                            }`}>
                                                            <div className={`w-1.5 h-1.5 rounded-full ${staff.status === 'Inactive' ? 'bg-red-500' : 'bg-green-500'}`}></div>
                                                            {staff.status || 'Active'}
                                                        </span>
                                                        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
                                                            <button
                                                                onClick={() => handleEditStaff(staff)}
                                                                className="p-1.5 rounded-md hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                                                title="Edit Staff"
                                                            >
                                                                <Edit3 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteStaff(staff.id)}
                                                                className="p-1.5 rounded-md hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
                                                                title="Delete Staff"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <button
                                        onClick={() => {
                                            setShowStaffModal(false);
                                            setSelectedBranch(null);
                                            setShowStaffForm(false);
                                            setEditingStaff(null);
                                        }}
                                        className="w-full bg-white/5 hover:bg-white/10 text-white py-4 rounded-xl font-medium transition-colors border border-white/5 hover:border-white/10"
                                    >
                                        Close
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default AdminControl;
