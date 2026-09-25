import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { X, User, Store, CheckCircle, LogOut, BarChart3, Sparkles } from 'lucide-react';
import {
    DashboardIcon, InventoryIcon, SalesIcon, InstallmentIcon,
    ManufacturingIcon, RepairsIcon, CRMIcon, AdminIcon, AIIcon
} from './Icons';

const BRANCHES_UPDATED_EVENT = 'shopowner:branches-updated';

const Sidebar = ({ isOpen, onClose }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const isMainBranch = (value) => value === true || value === 1 || String(value) === '1' || String(value).toLowerCase() === 'true';
    const [dbStatus, setDbStatus] = useState('checking'); // 'connected', 'disconnected', 'checking'
    // Initialize activeBranch from localStorage or default to 'Main Branch'
    const [activeBranch, setActiveBranch] = useState(() => {
        return localStorage.getItem('activeBranch') || 'Main Branch';
    });
    const [allBranches, setAllBranches] = useState([]);
    const storedActiveBranchIsMain = localStorage.getItem('activeBranchIsMain');
    const cachedActiveBranchIsMain = storedActiveBranchIsMain === 'true'
        ? true
        : (storedActiveBranchIsMain === 'false' ? false : null);
    const activeBranchRecord = allBranches.find((branch) => branch.name === activeBranch);
    const isActiveBranchMain = activeBranchRecord
        ? isMainBranch(activeBranchRecord.is_main)
        : (cachedActiveBranchIsMain ?? activeBranch === 'Main Branch');

    // Modal States
    const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
    const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);
    const [selectedBranchToSwitch, setSelectedBranchToSwitch] = useState(null);

    // OTP State
    const [otp, setOtp] = useState(new Array(6).fill(''));
    const inputRefs = useRef([]);
    const [error, setError] = useState('');
    const [verifyingPasscode, setVerifyingPasscode] = useState(false);

    const fetchBranchInfo = async () => {
        try {
            const shopownerId = localStorage.getItem('shopownerId');
            const userId = localStorage.getItem('userId');
            // Use shopownerId if available, fallback to userId
            const queryParam = shopownerId ? `shopownerId=${shopownerId}` : `userId=${userId}`;

            const res = await fetch(`/api/branches?${queryParam}`);
            if (res.ok) {
                const branches = await res.json();
                setAllBranches(branches);

                // Validate activeBranch against fetched branches
                const currentActive = localStorage.getItem('activeBranch');
                const branchExists = branches.find((b) => b.name === currentActive);

                if (!branchExists && branches.length > 0) {
                    const defaultBranchRecord = branches.find((b) => isMainBranch(b.is_main)) || branches[0];
                    const defaultBranch = defaultBranchRecord.name;
                    setActiveBranch(defaultBranch);
                    localStorage.setItem('activeBranch', defaultBranch);
                    localStorage.setItem('activeBranchIsMain', isMainBranch(defaultBranchRecord.is_main) ? 'true' : 'false');
                } else if (branchExists) {
                    localStorage.setItem('activeBranchIsMain', isMainBranch(branchExists.is_main) ? 'true' : 'false');
                } else if (!branchExists && branches.length === 0) {
                    // If no branches found (shouldn't happen usually due to default), set to Main Branch or keep empty
                    setActiveBranch('Main Branch');
                    localStorage.setItem('activeBranch', 'Main Branch');
                    localStorage.setItem('activeBranchIsMain', 'true');
                }
            }
        } catch (error) {
            console.error("Failed to fetch branch info:", error);
        }
    };

    useEffect(() => {
        const checkDbStatus = async () => {
            try {
                const response = await fetch('/api/health');
                const data = await response.json();
                if (data.status === 'connected') {
                    setDbStatus('connected');
                } else {
                    setDbStatus('disconnected');
                }
            } catch (error) {
                console.error("DB Status Check Failed:", error);
                setDbStatus('disconnected');
            }
        };

        const handleBranchesUpdated = () => {
            fetchBranchInfo();
        };

        checkDbStatus();
        fetchBranchInfo();
        window.addEventListener(BRANCHES_UPDATED_EVENT, handleBranchesUpdated);
        const interval = setInterval(checkDbStatus, 30000); // Check every 30 seconds

        return () => {
            clearInterval(interval);
            window.removeEventListener(BRANCHES_UPDATED_EVENT, handleBranchesUpdated);
        };
    }, []);

    const handleBranchClick = () => {
        setIsBranchModalOpen(true);
        fetchBranchInfo();
    };

    const handleBranchSelect = (branch) => {
        setSelectedBranchToSwitch(branch);
        setIsBranchModalOpen(false);
        setIsPasscodeModalOpen(true);
        setVerifyingPasscode(false);
        setOtp(new Array(6).fill(''));
        setError('');
        // Focus first input after render
        setTimeout(() => {
            inputRefs.current[0]?.focus();
        }, 100);
    };

    const handleOtpChange = (element, index) => {
        if (isNaN(element.value)) return false;

        const newOtp = [...otp];
        newOtp[index] = element.value;
        setOtp(newOtp);

        // Focus next input
        if (element.value !== '' && index < 5) {
            inputRefs.current[index + 1].focus();
        }
    };

    const handleKeyDown = (e, index) => {
        // Handle Backspace
        if (e.key === 'Backspace') {
            if (otp[index] === '' && index > 0) {
                inputRefs.current[index - 1].focus();
            } else {
                const newOtp = [...otp];
                newOtp[index] = '';
                setOtp(newOtp);
            }
        }
        // Handle Left Arrow
        if (e.key === 'ArrowLeft' && index > 0) {
            inputRefs.current[index - 1].focus();
        }
        // Handle Right Arrow
        if (e.key === 'ArrowRight' && index < 5) {
            inputRefs.current[index + 1].focus();
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const data = e.clipboardData.getData('text').slice(0, 6).split('');
        if (data.length === 0) return;

        const newOtp = [...otp];
        data.forEach((val, i) => {
            if (i < 6 && !isNaN(val)) newOtp[i] = val;
        });
        setOtp(newOtp);
        inputRefs.current[Math.min(data.length, 5)].focus();
    };

    const handlePasscodeSubmit = async (e) => {
        e.preventDefault();
        if (verifyingPasscode) return;
        const enteredCode = otp.join('');
        if (enteredCode.length !== 6) {
            setError('Please enter the full 6-digit passcode');
            return;
        }

        try {
            setVerifyingPasscode(true);
            setError('');

            const payload = {
                branchId: selectedBranchToSwitch?.id,
                passcode: enteredCode,
                shopownerId: localStorage.getItem('shopownerId'),
                userId: localStorage.getItem('userId')
            };

            const res = await fetch('/api/branches/verify-passcode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Invalid passcode');
            }

            const newBranch = selectedBranchToSwitch.name;
            localStorage.setItem('activeBranch', newBranch);
            localStorage.setItem('activeBranchIsMain', isMainBranch(selectedBranchToSwitch?.is_main) ? 'true' : 'false');
            setActiveBranch(newBranch);
            setIsPasscodeModalOpen(false);
            window.dispatchEvent(new CustomEvent(BRANCHES_UPDATED_EVENT));
            navigate('/shopowner/dashboard', { replace: true });
        } catch (err) {
            setError(err.message || 'Invalid Passcode');
            setOtp(new Array(6).fill(''));
            inputRefs.current[0]?.focus();
        } finally {
            setVerifyingPasscode(false);
        }
    };

    const closePasscodeModal = () => {
        setIsPasscodeModalOpen(false);
        setVerifyingPasscode(false);
        setOtp(new Array(6).fill(''));
        setError('');
    };

    const menuItems = [
        { name: 'Dashboard', path: '/shopowner/dashboard', icon: DashboardIcon },
        { name: 'Inventory', path: '/shopowner/inventory', icon: InventoryIcon },
        { name: 'Sales & Invoicing', path: '/shopowner/sales', icon: SalesIcon },
        { name: 'CRM', path: '/shopowner/crm', icon: CRMIcon },
        { name: 'Installment Tracker', path: '/shopowner/installments', icon: InstallmentIcon },
        { name: 'Manufacturing', path: '/shopowner/manufacturing', icon: ManufacturingIcon },
        { name: 'Repairs', path: '/shopowner/repairs', icon: RepairsIcon },
        { name: 'Admin Control', path: '/shopowner/admin', icon: AdminIcon },
        { name: 'AI Price Prediction', path: '/shopowner/ai-prediction', icon: AIIcon },
        { name: 'Reporting & Analytics', path: '/shopowner/reports', icon: BarChart3 },
        ...(isActiveBranchMain ? [{ name: 'Profile', path: '/shopowner/profile', icon: User }] : []),
        ...(isActiveBranchMain ? [{ name: 'Gold-Lagbe', path: '/shopowner/gold-lagbe', icon: Sparkles }] : []),
    ];

    return (
        <>
            <div className={`w-64 bg-[#121418] border-r border-white/10 h-screen flex flex-col fixed left-0 top-0 overflow-y-auto z-50 transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
                }`}>
                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-primary-gold tracking-wider">GOLD RUSH</h1>
                        <p className="text-xs text-gray-500 font-medium mt-1 uppercase tracking-widest">Shop Owner Panel</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="md:hidden text-gray-400 hover:text-white p-1"
                    >
                        <X size={24} />
                    </button>
                </div>
                <nav className="flex-1 p-4 space-y-1">
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => {
                                    if (window.innerWidth < 768) {
                                        onClose();
                                    }
                                }}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 group ${isActive
                                    ? 'bg-gradient-to-r from-primary-gold/20 to-transparent text-primary-gold border-l-2 border-primary-gold'
                                    : 'text-gray-400 hover:bg-white/5 hover:text-white hover:pl-5'
                                    }`}
                            >
                                <Icon className={`w-5 h-5 ${isActive ? 'text-primary-gold' : 'text-gray-500 group-hover:text-white'}`} />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
                <div className="p-4 border-t border-white/10 space-y-2">
                    {/* Active Branch Indicator - Clickable */}
                    <button
                        onClick={handleBranchClick}
                        className="w-full flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-medium border bg-white/5 text-gray-300 border-white/10 mb-2 hover:bg-white/10 hover:border-primary-gold/30 transition-all group"
                    >
                        <Store className="w-3.5 h-3.5 text-primary-gold group-hover:scale-110 transition-transform" />
                        <span className="truncate flex-1 text-left">{activeBranch}</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-primary-gold/50" />
                    </button>

                    {/* Database Status Indicator */}
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium border ${dbStatus === 'connected'
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                        <div className={`w-2 h-2 rounded-full ${dbStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
                            } animate-pulse`} />
                        {dbStatus === 'connected' ? 'System Online' : 'System Offline'}
                    </div>

                    <button
                        onClick={() => {
                            localStorage.removeItem('shopowner_auth');
                            localStorage.removeItem('activeBranch');
                            localStorage.removeItem('activeBranchIsMain');
                            localStorage.removeItem('mainBranchName');
                            localStorage.removeItem('userId');
                            localStorage.removeItem('shopownerId');
                            sessionStorage.clear();
                            navigate('/signin'); // Redirect to Main Sign In
                        }}
                        className="flex items-center gap-3 w-full px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 rounded-xl transition-colors text-left group"
                    >
                        <LogOut className="w-5 h-5 group-hover:text-red-500" />
                        Logout
                    </button>
                </div>
            </div>

            {/* Branch Selection Modal */}
            {isBranchModalOpen && createPortal(
                <div className="modal-overlay">
                    <div className="absolute inset-0" onClick={() => setIsBranchModalOpen(false)}></div>
                    <div className="modal-container max-w-md w-full" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Select Branch</h2>
                            <button onClick={() => setIsBranchModalOpen(false)} className="modal-close-btn">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            {allBranches.map((branch) => (
                                <button
                                    key={branch.id}
                                    onClick={() => handleBranchSelect(branch)}
                                    className={`w-full text-left p-4 rounded-xl border transition-all flex justify-between items-center ${activeBranch === branch.name
                                        ? 'bg-primary-gold/10 border-primary-gold/30 text-primary-gold'
                                        : 'bg-white/5 border-white/5 hover:bg-white/10 text-gray-300'
                                        }`}
                                >
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold">{branch.name}</p>
                                            {isMainBranch(branch.is_main) && (
                                                <span className="inline-flex items-center rounded-full border border-primary-gold/30 bg-primary-gold/10 px-2 py-0.5 text-[10px] font-semibold text-primary-gold">
                                                    Main
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs opacity-70 mt-1">{branch.location}</p>
                                    </div>
                                    {activeBranch === branch.name && <CheckCircle className="w-5 h-5" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Passcode Modal (OTP Style) */}
            {isPasscodeModalOpen && createPortal(
                <div className="modal-overlay">
                    <div className="absolute inset-0" onClick={closePasscodeModal}></div>
                    <div className="modal-container max-w-sm w-full" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Enter Admin Passcode</h2>
                            <button onClick={closePasscodeModal} className="modal-close-btn">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handlePasscodeSubmit} className="p-6 pt-2">
                            <p className="text-gray-400 text-sm mb-6">
                                Please enter the 6-digit admin passcode to switch to <span className="text-white font-bold">{selectedBranchToSwitch?.name}</span>.
                            </p>

                            <div className="flex justify-center gap-2 mb-6">
                                {otp.map((data, index) => (
                                    <input
                                        key={index}
                                        type="text"
                                        name="otp"
                                        maxLength="1"
                                        disabled={verifyingPasscode}
                                        value={data}
                                        ref={el => inputRefs.current[index] = el}
                                        onChange={e => handleOtpChange(e.target, index)}
                                        onKeyDown={e => handleKeyDown(e, index)}
                                        onPaste={handlePaste}
                                        className="w-10 h-12 bg-[#0B0D10] border border-white/10 rounded-lg text-center text-xl font-bold text-white focus:outline-none focus:border-primary-gold/50 transition-colors"
                                    />
                                ))}
                            </div>

                            {error && (
                                <div className="mb-4 text-red-500 text-sm text-center bg-red-500/10 py-2 rounded-lg border border-red-500/20 animate-pulse">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={verifyingPasscode}
                                className="w-full bg-primary-gold text-black font-bold py-3 rounded-xl hover:bg-yellow-400 transition-colors shadow-lg shadow-primary-gold/20 flex items-center justify-center gap-2"
                            >
                                {verifyingPasscode ? 'Verifying...' : 'Verify & Switch'}
                            </button>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default Sidebar;
