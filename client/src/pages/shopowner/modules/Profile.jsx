import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { User, MapPin, Plus, Store, Building2, Phone, Mail, X, Shield, Lock, CheckCircle, CreditCard, Calendar, Camera, Upload } from 'lucide-react';
import { fileToDataUrl } from '../../../utils/demoUpload';

const Profile = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [editForm, setEditForm] = useState({ full_name: '', phone: '', identifier: '', shop_name: '', shop_logo_url: '' });
    const [uploadingImage, setUploadingImage] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [passwordError, setPasswordError] = useState('');
    const [message, setMessage] = useState('');
    const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
    const [updatingPlan, setUpdatingPlan] = useState(false);
    const [processingPlanId, setProcessingPlanId] = useState('');
    const activeBranch = localStorage.getItem('activeBranch') || 'Main Branch';
    const shopownerId = localStorage.getItem('shopownerId');
    const localUserId = localStorage.getItem('userId');
    const cachedMainFlag = localStorage.getItem('activeBranchIsMain');
    const [branchAccessAllowed, setBranchAccessAllowed] = useState(
        cachedMainFlag === 'true'
            ? true
            : (cachedMainFlag === 'false' ? false : activeBranch === 'Main Branch')
    );
    const isMainBranch = (value) => value === true || value === 1 || String(value) === '1' || String(value).toLowerCase() === 'true';

    const plans = [
        {
            id: 'free',
            name: 'Free Trial',
            price: 'Free',
            period: '7 Days',
            description: 'Experience the full power of Gold Rush risk-free.',
            features: ['7 Days Full Access', 'All Features Included', 'No Credit Card Required', 'Instant Setup'],
            color: 'bg-gray-800'
        },
        {
            id: 'monthly',
            name: 'Monthly',
            price: '৳3,000',
            period: '/month',
            description: 'Flexible monthly billing for growing businesses.',
            features: ['Full Access Month-to-Month', 'All Features Included', 'Cancel Anytime', 'Priority Support'],
            color: 'bg-gray-800'
        },
        {
            id: 'yearly',
            name: 'Yearly',
            price: '৳30,000',
            period: '/year',
            description: 'Best value for established businesses.',
            features: ['Save 2 Months Price', 'All Features Included', 'Premium Support', 'Free Onboarding Session'],
            popular: true,
            color: 'bg-gray-800' // Keeping simple for profile modal
        },
        {
            id: 'lifetime',
            name: 'Lifetime',
            price: '৳1,00,000',
            period: 'one-time',
            description: 'One-time investment for a lifetime of value.',
            features: ['Lifetime Access', 'No Recurring Fees', 'All Features Included', 'Dedicated Account Manager'],
            color: 'bg-gray-800',
            glow: 'border-purple-500/50 shadow-purple-500/20'
        }
    ];

    const handlePlanSelect = async (plan) => {
        if (updatingPlan) return;
        setUpdatingPlan(true);
        setProcessingPlanId(plan.id);
        try {
            const response = await fetch('/api/subscription/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shopownerId: user.shopowner_id || localStorage.getItem('shopownerId'),
                    plan: plan.id,
                    amount: plan.id === 'free' ? 0 : parseInt(plan.price.replace(/[^\d]/g, ''), 10)
                }),
            });

            const raw = await response.text();
            let data;
            try {
                data = raw ? JSON.parse(raw) : {};
            } catch (err) {
                console.error('Non-JSON response:', raw);
                data = {};
            }

            if (response.ok) {
                if (data.paymentUrl) {
                    window.location.href = data.paymentUrl;
                } else {
                    setMessage('Subscription Updated Successfully!');
                    setShowSubscriptionModal(false);
                    fetchUserProfile(); // Refresh profile to show new plan
                    setTimeout(() => setMessage(''), 3000);
                }
            } else {
                alert(data.error || 'Subscription Update Failed');
            }
        } catch (error) {
            console.error('Error updating subscription:', error);
            alert('Something went wrong.');
        } finally {
            setUpdatingPlan(false);
            setProcessingPlanId('');
        }
    };

    useEffect(() => {
        let isMounted = true;

        const verifyMainBranchAccess = async () => {
            if (!shopownerId && !localUserId) {
                if (isMounted) setBranchAccessAllowed(false);
                return;
            }

            try {
                const queryParam = shopownerId
                    ? `shopownerId=${encodeURIComponent(shopownerId)}&activeBranch=${encodeURIComponent(activeBranch)}`
                    : `userId=${encodeURIComponent(localUserId)}&activeBranch=${encodeURIComponent(activeBranch)}`;
                const res = await fetch(`/api/branches?${queryParam}`);
                const branches = await res.json().catch(() => []);

                let allowAccess = activeBranch === 'Main Branch';
                if (res.ok && Array.isArray(branches) && branches.length > 0) {
                    const activeBranchRecord = branches.find((branch) => String(branch.name || '').trim().toLowerCase() === activeBranch.trim().toLowerCase());
                    if (activeBranchRecord) {
                        allowAccess = isMainBranch(activeBranchRecord.is_main);
                    } else {
                        const mainBranch = branches.find((branch) => isMainBranch(branch.is_main));
                        allowAccess = Boolean(mainBranch && String(mainBranch.name || '').trim().toLowerCase() === activeBranch.trim().toLowerCase());
                    }
                }

                if (!isMounted) return;
                setBranchAccessAllowed(allowAccess);
                localStorage.setItem('activeBranchIsMain', allowAccess ? 'true' : 'false');
                if (!allowAccess) {
                    navigate('/shopowner/dashboard', { replace: true });
                }
            } catch (error) {
                console.error('Failed to verify profile access branch:', error);
            }
        };

        verifyMainBranchAccess();
        return () => { isMounted = false; };
    }, [activeBranch, localUserId, navigate, shopownerId]);

    useEffect(() => {
        if (!branchAccessAllowed) return;
        fetchUserProfile();
    }, [branchAccessAllowed]);

    const fetchUserProfile = async () => {
        try {
            // Build query to support both shopownerId and userId (covers admin + Google login cases)
            const queryParam = shopownerId
                ? `shopownerId=${encodeURIComponent(shopownerId)}&activeBranch=${encodeURIComponent(activeBranch)}`
                : localUserId
                    ? `userId=${encodeURIComponent(localUserId)}&activeBranch=${encodeURIComponent(activeBranch)}`
                    : '';
            if (!queryParam) {
                setUser(null);
                return;
            }

            const res = await fetch(`/api/user-profile?${queryParam}`);
            if (res.ok) {
                const data = await res.json();
                setUser(data);
                setEditForm(data);
            } else {
                console.error('Failed to load profile', res.status);
                setUser(null);
            }
        } catch (err) {
            console.error("Error fetching profile:", err);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadingImage(true);
        try {
            const imageUrl = await fileToDataUrl(file);
            setEditForm(prev => ({ ...prev, shop_logo_url: imageUrl }));
        } catch (error) {
            console.error("Image upload failed:", error);
            alert("Failed to upload image.");
        } finally {
            setUploadingImage(false);
        }
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/user-profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...editForm,
                    shopownerId,
                    userId: localUserId,
                    activeBranch
                })
            });
            if (res.ok) {
                // Determine if we should update local storage (optional, mostly for consistency)
                setUser(editForm);
                setIsEditing(false);
                setMessage('Profile updated successfully!');
                setTimeout(() => setMessage(''), 3000);
            }
        } catch (err) {
            console.error("Error updating profile:", err);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPasswordError('');

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setPasswordError("New passwords don't match");
            return;
        }

        try {
            const res = await fetch('/api/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    shopownerId,
                    activeBranch,
                    currentPassword: passwordForm.currentPassword,
                    newPassword: passwordForm.newPassword
                })
            });

            const data = await res.json();

            if (res.ok) {
                setIsChangingPassword(false);
                setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                setMessage('Password changed successfully!');
                setTimeout(() => setMessage(''), 3000);
            } else {
                setPasswordError(data.error || 'Failed to change password');
            }
        } catch (err) {
            console.error("Error changing password:", err);
            setPasswordError('Something went wrong');
        }
    };

    if (!branchAccessAllowed) return null;
    if (loading) return <div className="text-white">Loading Profile...</div>;
    if (!user) return <div className="text-white">User not found. Please log in first.</div>;
    const totalBranches = Number(user.total_branches ?? user.branch_count ?? 0);

    const getDaysLeftLabel = () => {
        if (String(user.subscription_plan || '').toLowerCase() === 'lifetime') return 'Unlimited';
        if (!user.subscription_end_date) return 'N/A';

        const endDate = new Date(user.subscription_end_date);
        if (Number.isNaN(endDate.getTime())) return 'N/A';

        const now = new Date();
        const msPerDay = 24 * 60 * 60 * 1000;
        const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / msPerDay);

        if (daysLeft > 1) return `${daysLeft} days left`;
        if (daysLeft === 1) return '1 day left';
        if (daysLeft === 0) return 'Expires today';
        const daysAgo = Math.abs(daysLeft);
        return `Expired ${daysAgo} day${daysAgo > 1 ? 's' : ''} ago`;
    };

    return (
        <div className="h-full flex flex-col gap-6 overflow-y-auto animate-fade-in pb-10">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">Profile & Settings</h1>
                <p className="text-gray-400 text-sm mt-1">Manage your account details and security</p>
                {message && (
                    <div className="mt-4 p-3 bg-green-500/20 border border-green-500/50 text-green-400 rounded-xl flex items-center gap-2 max-w-md animate-fade-in">
                        <CheckCircle size={18} /> {message}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Main Profile Info */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Profile Card */}
                    <div className="bg-[#121418] border border-white/5 rounded-2xl p-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-gold/5 rounded-full blur-3xl -mr-20 -mt-20"></div>

                        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8">
                            <div className="flex flex-col items-center">
                                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary-gold/20 to-primary-gold/5 border-2 border-primary-gold/30 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(255,215,0,0.1)] overflow-hidden relative group">
                                    {user.shop_logo_url ? (
                                        <img src={user.shop_logo_url} alt="Shop Logo" className="w-full h-full object-cover" />
                                    ) : (
                                        <User size={50} className="text-primary-gold" />
                                    )}
                                </div>
                                <span className="px-3 py-1 bg-primary-gold/10 text-primary-gold text-xs font-bold rounded-full border border-primary-gold/20 flex items-center gap-1">
                                    <Store size={12} />
                                    Shop Owner
                                </span>
                            </div>

                            <div className="flex-1 w-full space-y-6">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h2 className="text-3xl font-bold text-white mb-1">{user.full_name}</h2>
                                        <p className="text-gray-400 text-sm">Member since {new Date(user.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-semibold transition-colors border border-white/10"
                                    >
                                        Edit Profile
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Mail size={18} className="text-primary-gold/70" />
                                            <span className="text-xs text-gray-500 uppercase font-bold">Email / Identifier</span>
                                        </div>
                                        <p className="text-white font-medium pl-8">{user.identifier}</p>
                                    </div>
                                    <div className="p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Phone size={18} className="text-primary-gold/70" />
                                            <span className="text-xs text-gray-500 uppercase font-bold">Phone Number</span>
                                        </div>
                                        <p className="text-white font-medium pl-8">{user.phone}</p>
                                    </div>
                                    <div className="p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Store size={18} className="text-primary-gold/70" />
                                            <span className="text-xs text-gray-500 uppercase font-bold">Shop Name</span>
                                        </div>
                                        <p className="text-white font-medium pl-8 text-lg">{user.shop_name || 'Not Set'}</p>
                                    </div>
                                    <div className="p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Building2 size={18} className="text-primary-gold/70" />
                                            <span className="text-xs text-gray-500 uppercase font-bold">Total Branches</span>
                                        </div>
                                        <p className="text-white font-medium pl-8">{totalBranches}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Subscription & Security */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Subscription Card */}
                    <div className="bg-[#121418] border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-primary-gold/20 transition-all">
                        <div className="absolute top-0 right-0 p-4 opacity-50">
                            <CreditCard className="text-white/10 w-24 h-24 -mr-8 -mt-8 transform rotate-12" />
                        </div>

                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg border border-white/10">
                                    <Store className="text-purple-400" size={20} />
                                </div>
                                <h3 className="text-lg font-bold text-white">My Plan</h3>
                            </div>

                            <div className="mb-6">
                                <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                                    {plans.find(p => p.id === user.subscription_plan)?.name || user.subscription_plan || 'Premium Plan'}
                                </span>
                                <div className="flex items-center gap-2 mt-2">
                                    {user.subscription_status === 'pending' ? (
                                        <span
                                            onClick={() => {
                                                const currentPlan = plans.find(p => p.id === user.subscription_plan);
                                                if (currentPlan) handlePlanSelect(currentPlan);
                                            }}
                                            className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded cursor-pointer hover:bg-yellow-500/30 transition-colors flex items-center gap-1"
                                            title="Click to Pay Now"
                                        >
                                            Pending <span className="underline ml-1">Pay Now</span>
                                        </span>
                                    ) : (
                                        <span className={`px-2 py-0.5 text-xs font-bold rounded ${user.subscription_status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                                            }`}>
                                            {user.subscription_status || 'Active'}
                                        </span>
                                    )}
                                    <span className="text-xs text-gray-500">Auto-renews</span>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-white/10 space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500 flex items-center gap-2"><Calendar size={14} /> Next Billing</span>
                                    <span className="text-white">
                                        {user.subscription_plan === 'lifetime'
                                            ? 'Never'
                                            : user.subscription_end_date
                                                ? new Date(user.subscription_end_date).toLocaleDateString()
                                                : 'N/A'}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500 flex items-center gap-2"><Calendar size={14} /> Days Left</span>
                                    <span className="text-primary-gold font-semibold">{getDaysLeftLabel()}</span>
                                </div>
                                <button
                                    onClick={() => setShowSubscriptionModal(true)}
                                    className="w-full py-2 bg-white/5 hover:bg-white/10 text-white text-sm rounded-lg border border-white/5 transition-colors"
                                >
                                    Manage Subscription
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Security Card */}
                    <div className="bg-[#121418] border border-white/5 rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-red-500/10 rounded-lg">
                                <Shield className="text-red-400" size={20} />
                            </div>
                            <h3 className="text-lg font-bold text-white">Security</h3>
                        </div>
                        <p className="text-gray-400 text-sm mb-4">Manage your password and account security settings.</p>
                        <button
                            onClick={() => setIsChangingPassword(true)}
                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-colors font-medium"
                        >
                            <Lock size={16} /> Change Password
                        </button>
                    </div>
                </div>
            </div>

            {/* Edit Profile Modal */}
            {isEditing && createPortal(
                <div className="modal-overlay">
                    <div className="absolute inset-0" onClick={() => setIsEditing(false)}></div>
                    <div className="modal-container max-w-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Edit Profile</h2>
                            <button onClick={() => setIsEditing(false)} className="modal-close-btn">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateProfile} className="modal-content">
                            <div>
                                <label className="modal-label">Full Name</label>
                                <input
                                    type="text"
                                    value={editForm.full_name}
                                    onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                                    className="modal-input"
                                    required
                                />
                            </div>
                            <div>
                                <label className="modal-label">Phone Number</label>
                                <input
                                    type="text"
                                    value={editForm.phone}
                                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                                    className="modal-input"
                                    required
                                />
                            </div>
                            <div>
                                <label className="modal-label">Email / Identifier</label>
                                <input
                                    type="text"
                                    value={editForm.identifier}
                                    onChange={e => setEditForm({ ...editForm, identifier: e.target.value })}
                                    className="modal-input"
                                    required
                                />
                            </div>
                            <div>
                                <label className="modal-label">Shop Name</label>
                                <input
                                    type="text"
                                    value={editForm.shop_name || ''}
                                    onChange={e => setEditForm({ ...editForm, shop_name: e.target.value })}
                                    className="modal-input"
                                    placeholder="Enter your shop name"
                                />
                            </div>
                            <div>
                                <label className="modal-label">Shop Logo</label>
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-gray-800 border border-gray-700 overflow-hidden flex items-center justify-center">
                                        {editForm.shop_logo_url ? (
                                            <img src={editForm.shop_logo_url} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <Store className="text-gray-500" />
                                        )}
                                    </div>
                                    <label className="flex items-center gap-2 px-4 py-2 bg-[#121418] border border-gray-700 hover:border-primary-gold/50 rounded-xl cursor-pointer transition-colors group">
                                        <Upload size={16} className="text-gray-400 group-hover:text-primary-gold" />
                                        <span className="text-sm font-medium text-gray-300 group-hover:text-white">
                                            {uploadingImage ? 'Uploading...' : 'Upload Logo'}
                                        </span>
                                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} />
                                    </label>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" onClick={() => setIsEditing(false)} className="modal-btn-cancel">Cancel</button>
                                <button type="submit" className="modal-btn-primary">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Change Password Modal */}
            {isChangingPassword && createPortal(
                <div className="modal-overlay">
                    <div className="absolute inset-0" onClick={() => setIsChangingPassword(false)}></div>
                    <div className="modal-container max-w-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Change Password</h2>
                            <button onClick={() => setIsChangingPassword(false)} className="modal-close-btn">
                                <X size={24} />
                            </button>
                        </div>

                        {passwordError && (
                            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 text-red-500 rounded-lg text-sm">
                                {passwordError}
                            </div>
                        )}

                        <form onSubmit={handleChangePassword} className="modal-content">
                            <div>
                                <label className="modal-label">Current Password</label>
                                <input
                                    type="password"
                                    value={passwordForm.currentPassword}
                                    onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                    className="modal-input"
                                    required
                                />
                            </div>
                            <div>
                                <label className="modal-label">New Password</label>
                                <input
                                    type="password"
                                    value={passwordForm.newPassword}
                                    onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                    className="modal-input"
                                    required
                                />
                            </div>
                            <div>
                                <label className="modal-label">Confirm New Password</label>
                                <input
                                    type="password"
                                    value={passwordForm.confirmPassword}
                                    onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                    className="modal-input"
                                    required
                                />
                            </div>
                            <div className="modal-footer">
                                <button type="button" onClick={() => setIsChangingPassword(false)} className="modal-btn-cancel">Cancel</button>
                                <button type="submit" className="modal-btn-primary">Update Password</button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Subscription Management Modal */}
            {showSubscriptionModal && createPortal(
                <div className="modal-overlay">
                    <div className="absolute inset-0" onClick={() => setShowSubscriptionModal(false)}></div>
                    <div className="modal-container max-w-4xl" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Manage Subscription</h2>
                            <button onClick={() => setShowSubscriptionModal(false)} className="modal-close-btn">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="max-h-[80vh] overflow-y-auto p-6">
                            <h3 className="text-white text-lg font-bold mb-4">Current Plan: <span className="text-primary-gold">{plans.find(p => p.id === user.subscription_plan)?.name || user.subscription_plan || 'N/A'}</span></h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {plans.map((plan) => (
                                    <div
                                        key={plan.id}
                                        className={`relative p-6 rounded-2xl border ${user.subscription_plan === plan.id ? 'border-green-500 bg-green-500/10' : 'border-white/10 bg-white/5 hover:border-primary-gold/30'} flex flex-col transition-all cursor-pointer`}
                                        onClick={() => {
                                            if (!updatingPlan && user.subscription_plan !== plan.id) handlePlanSelect(plan);
                                        }}
                                    >
                                        {user.subscription_plan === plan.id && (
                                            <div className="absolute top-2 right-2 text-green-400">
                                                <CheckCircle size={20} />
                                            </div>
                                        )}
                                        {plan.popular && (
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-500 to-blue-500 text-white text-[10px] font-bold px-3 py-1 rounded-full">
                                                MOST POPULAR
                                            </div>
                                        )}
                                        <h4 className="text-lg font-bold text-white mb-2">{plan.name}</h4>
                                        <div className="flex items-end gap-1 mb-4">
                                            <span className="text-2xl font-bold text-white">{plan.price}</span>
                                            <span className="text-xs text-gray-500 mb-1">{plan.period}</span>
                                        </div>
                                        <ul className="space-y-2 mb-6 flex-1">
                                            {plan.features.map((feature, i) => (
                                                <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                                                    <CheckCircle size={12} className="text-primary-gold mt-0.5 shrink-0" />
                                                    {feature}
                                                </li>
                                            ))}
                                        </ul>
                                        <button
                                            disabled={updatingPlan || user.subscription_plan === plan.id}
                                            className={`w-full py-2 rounded-lg text-sm font-bold transition-colors ${user.subscription_plan === plan.id
                                                ? 'bg-green-500/20 text-green-400 cursor-default'
                                                : 'bg-primary-gold hover:bg-yellow-400 text-black'
                                                }`}
                                        >
                                            {processingPlanId === plan.id ? 'Processing...' :
                                                user.subscription_plan === plan.id ? 'Current Plan' : 'Upgrade'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

        </div>
    );
};

export default Profile;
