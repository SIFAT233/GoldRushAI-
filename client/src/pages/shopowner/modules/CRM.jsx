import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const CRM = () => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [showEmailModal, setShowEmailModal] = useState(false); // New Email Modal
    const [selectedCustomer, setSelectedCustomer] = useState(null); // For View Profile
    const [emailTarget, setEmailTarget] = useState(null); // For Single Email
    const [messageRecipient, setMessageRecipient] = useState('All VIP Customers'); // For Messaging
    const [editingTxId, setEditingTxId] = useState(null); // Reuse for editing customer ID if needed, or just create new state
    const [editingCustomer, setEditingCustomer] = useState(null); // For Edit Mode

    const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
    const showToast = (message, type = 'success') => {
        setNotification({ show: true, message, type });
        setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 3000);
    };
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
    const [newCustomer, setNewCustomer] = useState({
        name: '',
        phone: '',
        email: '',
        type: 'New',
        total_spent: '',
        last_visit: new Date().toISOString().split('T')[0]
    });

    const [viewMode, setViewMode] = useState('all'); // 'all' or 'vip'
    const [couponTemplates, setCouponTemplates] = useState([]);
    const [loadingCouponTemplates, setLoadingCouponTemplates] = useState(false);
    const [blastConfirm, setBlastConfirm] = useState({
        open: false,
        recipientLabel: '',
        recipientCount: 0,
        targetEmails: []
    });

    useEffect(() => {
        fetchCustomers();
    }, []);

    const normalizeCustomers = (data) => {
        if (Array.isArray(data)) return data;
        if (Array.isArray(data?.recordset)) return data.recordset;
        if (Array.isArray(data?.customers)) return data.customers;
        return [];
    };

    const getOwnerQueryParam = () => {
        const shopownerId = localStorage.getItem('shopownerId');
        const userId = localStorage.getItem('userId');
        if (shopownerId) return `shopownerId=${encodeURIComponent(shopownerId)}`;
        if (userId) return `userId=${encodeURIComponent(userId)}`;
        return '';
    };

    const getCouponDiscountLabel = (coupon) => {
        const discountType = String(coupon?.discount_type || '').toUpperCase();
        const discountValue = Number(coupon?.discount_value || 0);
        if (discountType === 'PERCENTAGE') {
            return `${discountValue}% off`;
        }
        return `BDT ${discountValue.toLocaleString()} off`;
    };

    const toValidDate = (value) => {
        if (!value) return null;
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const isCouponLiveNow = (coupon) => {
        if (!coupon || !coupon.is_active) return false;
        const now = Date.now();
        const startsAt = toValidDate(coupon.starts_at);
        const expiresAt = toValidDate(coupon.expires_at);
        if (startsAt && startsAt.getTime() > now) return false;
        if (expiresAt && expiresAt.getTime() < now) return false;
        return true;
    };

    const toCouponTemplate = (coupon) => {
        const discountLabel = getCouponDiscountLabel(coupon);
        const expiresAtDate = toValidDate(coupon.expires_at);
        const minimumOrderLabel = coupon.minimum_order_amount !== null && coupon.minimum_order_amount !== undefined
            ? `\nMinimum order: BDT ${Number(coupon.minimum_order_amount).toLocaleString()}.`
            : '';
        const maxDiscountLabel = coupon.maximum_discount_amount !== null && coupon.maximum_discount_amount !== undefined
            ? `\nMaximum discount: BDT ${Number(coupon.maximum_discount_amount).toLocaleString()}.`
            : '';
        const expiryLabel = expiresAtDate ? `\nValid until: ${expiresAtDate.toLocaleDateString()}.` : '';
        const titleText = coupon.title ? `${coupon.title}\n\n` : '';
        const descriptionText = coupon.description ? `\n${coupon.description}` : '';

        return {
            id: `coupon_offer_${coupon.id}`,
            label: `Coupon: ${coupon.code} (${discountLabel})`,
            audience: 'All Customers',
            subject: `Special Coupon Offer: ${coupon.code}`,
            body: `Hello,\n\n${titleText}Use coupon code ${coupon.code} to get ${discountLabel}.${minimumOrderLabel}${maxDiscountLabel}${expiryLabel}${descriptionText}\n\nShow this code during checkout.\n\nRegards,\n{{SHOP_NAME}}`
        };
    };

    const fetchCustomers = async () => {
        try {
            const activeBranch = localStorage.getItem('activeBranch') || 'Main Branch';
            const queryParam = getOwnerQueryParam();
            if (!queryParam) {
                setCustomers([]);
                setLoading(false);
                return;
            }
            const res = await fetch(`${apiBaseUrl}/api/customers?branch=${encodeURIComponent(activeBranch)}&${queryParam}`);
            if (!res.ok) {
                console.error("Failed to fetch customers:", res.status, res.statusText);
                setCustomers([]);
                setLoading(false);
                return;
            }
            const data = await res.json();
            setCustomers(normalizeCustomers(data));
            setLoading(false);
        } catch (err) {
            console.error("Failed to fetch customers", err);
            setCustomers([]);
            setLoading(false);
        }
    };

    const fetchCouponPresets = async () => {
        const queryParam = getOwnerQueryParam();
        if (!queryParam) {
            setCouponTemplates([]);
            return;
        }

        try {
            setLoadingCouponTemplates(true);
            const res = await fetch(`${apiBaseUrl}/api/gl/coupons?${queryParam}`);
            if (!res.ok) {
                throw new Error(`Coupon fetch failed with status ${res.status}`);
            }
            const data = await res.json().catch(() => ({}));
            const coupons = Array.isArray(data?.coupons) ? data.coupons : [];
            const liveCouponTemplates = coupons
                .filter(isCouponLiveNow)
                .map(toCouponTemplate);
            setCouponTemplates(liveCouponTemplates);
        } catch (error) {
            console.error('Failed to fetch coupon presets:', error);
            setCouponTemplates([]);
        } finally {
            setLoadingCouponTemplates(false);
        }
    };

    useEffect(() => {
        fetchCouponPresets();
    }, []);

    const handleInputChange = (e) => {
        setNewCustomer({ ...newCustomer, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const activeBranch = localStorage.getItem('activeBranch') || 'Main Branch';
            const userId = localStorage.getItem('userId');
            const shopownerId = localStorage.getItem('shopownerId');

            let url = `${apiBaseUrl}/api/customers`;
            let method = 'POST';

            if (editingCustomer) {
                url = `${apiBaseUrl}/api/customers/${editingCustomer.id}`;
                method = 'PUT';
            }

            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newCustomer, branch: activeBranch, userId, shopownerId })
            });
            if (res.ok) {
                setShowModal(false);
                const updatedData = await res.json(); // Get updated/created data

                // Update customers list
                if (editingCustomer) {
                    setCustomers(customers.map(c => c.id === editingCustomer.id ? updatedData : c));
                    // Also update emailTarget if it's the same customer
                    if (emailTarget && emailTarget.id === editingCustomer.id) {
                        setEmailTarget(updatedData);
                    }
                    if (selectedCustomer && selectedCustomer.id === editingCustomer.id) {
                        setSelectedCustomer(updatedData);
                    }
                } else {
                    fetchCustomers();
                }

                setNewCustomer({
                    name: '',
                    phone: '',
                    email: '',
                    type: 'New',
                    total_spent: '',
                    last_visit: new Date().toISOString().split('T')[0]
                });
                setEditingCustomer(null);

                return;
            }

            const errorData = await res.json().catch(() => null);
            if (res.status === 409) {
                const existingName = errorData?.customer?.name || 'this phone number';
                showToast(`Customer already exists for ${existingName}.`, 'error');
                return;
            }
            showToast(errorData?.error || 'Failed to create customer.', 'error');
        } catch (err) {
            console.error("Error creating/updating customer:", err);
        }
    };

    const handleEditClick = (customer) => {
        setEditingCustomer(customer);
        setNewCustomer({
            name: customer.name,
            phone: customer.phone,
            email: customer.email || '',
            type: customer.type,
            total_spent: customer.total_spent,
            last_visit: customer.last_visit ? new Date(customer.last_visit).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        });
        setShowModal(true);
    };

    // Update Customer Type (VIP / Regular)
    const toggleVIP = async (customer) => {
        const newType = customer.type === 'VIP' ? 'Regular' : 'VIP';
        try {
            const res = await fetch(`${apiBaseUrl}/api/customers/${customer.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: newType })
            });
            if (res.ok) {
                const updated = await res.json();
                setCustomers(customers.map(c => c.id === customer.id ? updated : c));
                if (selectedCustomer && selectedCustomer.id === customer.id) {
                    setSelectedCustomer(updated);
                }
            }
        } catch (err) {
            console.error("Error updating status:", err);
        }
    };

    // Delete Customer
    const deleteCustomer = async (id) => {
        if (!window.confirm("Are you sure you want to delete this customer? This action cannot be undone.")) return;
        try {
            const res = await fetch(`${apiBaseUrl}/api/customers/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setCustomers(customers.filter(c => c.id !== id));
                setSelectedCustomer(null);
            }
        } catch (err) {
            console.error("Error deleting customer:", err);
        }
    };

    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');
    const [sendingEmail, setSendingEmail] = useState(false);
    const [selectedPromoTemplate, setSelectedPromoTemplate] = useState('custom');

    const basePromotionalTemplates = [
        {
            id: 'vip_flash_sale',
            label: 'VIP Flash Sale',
            audience: 'All VIP Customers',
            subject: 'Exclusive VIP Offer: Flat 15% Off This Weekend',
            body: `Dear Valued VIP Customer,\n\nFor this weekend only, enjoy a flat 15% discount on selected gold and diamond collections.\n\nOffer valid till Sunday midnight.\n\nVisit our shop or reply to this email to reserve your design.\n\nRegards,\n{{SHOP_NAME}}`
        },
        {
            id: 'festival_collection',
            label: 'Festival New Collection',
            audience: 'All Customers',
            subject: 'New Festival Collection Is Live',
            body: `Hello,\n\nOur new festival jewelry collection is now available.\n\nHighlights:\n- Lightweight daily wear sets\n- Premium bridal pieces\n- Limited edition hand-crafted designs\n\nBook your preferred design early.\n\nRegards,\n{{SHOP_NAME}}`
        },
        {
            id: 'buyback_upgrade',
            label: 'Gold Exchange Offer',
            audience: 'All Customers',
            subject: 'Upgrade Your Old Gold With Special Exchange Bonus',
            body: `Hello,\n\nBring your old gold and upgrade to a new design with our exchange bonus offer.\n\nBenefits:\n- Transparent purity check\n- Fair valuation\n- Extra bonus on selected items\n\nOffer available for a limited time.\n\nRegards,\n{{SHOP_NAME}}`
        },
        {
            id: 'inactive_reactivation',
            label: 'Comeback Offer',
            audience: 'All Customers',
            subject: 'We Miss You: Special Comeback Discount Inside',
            body: `Hello,\n\nIt has been a while since your last visit.\n\nAs a warm welcome back, enjoy a special comeback discount on your next purchase.\n\nShow this email at checkout to claim your offer.\n\nRegards,\n{{SHOP_NAME}}`
        }
    ];
    const promotionalTemplates = [...basePromotionalTemplates, ...couponTemplates];

    const applyPromotionalTemplate = (templateId, announce = true) => {
        if (templateId === 'custom') {
            setSelectedPromoTemplate('custom');
            return;
        }

        const template = promotionalTemplates.find((item) => item.id === templateId);
        if (!template) return;

        setSelectedPromoTemplate(template.id);
        setEmailSubject(template.subject);
        setEmailBody(template.body);
        if (template.audience) {
            setMessageRecipient(template.audience);
        }

        if (announce) {
            showToast(`Template loaded: ${template.label}`, 'success');
        }
    };

    const sendEmailRequest = async (recipients, subject, message) => {
        const shopownerId = localStorage.getItem('shopownerId');
        const userId = localStorage.getItem('userId');
        const res = await fetch(`${apiBaseUrl}/api/crm/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipients,
                subject: subject.trim(),
                message: message.replace(/\n/g, '<br>'),
                shopownerId: shopownerId || null,
                userId: userId || null
            })
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
            throw new Error(data?.error || 'Failed to send email.');
        }
        return data;
    };

    const closeBlastConfirm = () => {
        if (sendingEmail) return;
        setBlastConfirm({
            open: false,
            recipientLabel: '',
            recipientCount: 0,
            targetEmails: []
        });
    };

    const handleSendEmailBlast = () => {
        if (!emailSubject.trim() || !emailBody.trim()) {
            showToast("Please enter both subject and message content.", 'error');
            return;
        }

        // Resolve recipients
        let targetEmails = [];
        if (messageRecipient === 'All VIP Customers') {
            targetEmails = customers.filter(c => c.type === 'VIP' && c.email).map(c => c.email);
        } else if (messageRecipient === 'All Customers') {
            targetEmails = customers.filter(c => c.email).map(c => c.email);
        }

        if (targetEmails.length === 0) {
            showToast("No email addresses found for the selected recipients.", 'error');
            return;
        }

        setBlastConfirm({
            open: true,
            recipientLabel: messageRecipient,
            recipientCount: targetEmails.length,
            targetEmails
        });
    };

    const confirmSendEmailBlast = async () => {
        if (!blastConfirm.targetEmails.length) {
            showToast("No email addresses found for the selected recipients.", 'error');
            closeBlastConfirm();
            return;
        }

        try {
            setSendingEmail(true);
            await sendEmailRequest(blastConfirm.targetEmails, emailSubject, emailBody);
            showToast("Email sent successfully!", 'success');
            setEmailSubject('');
            setEmailBody('');
            closeBlastConfirm();
        } catch (err) {
            showToast(err.message || "Failed to send email.", 'error');
        } finally {
            setSendingEmail(false);
        }
    };

    // ... (rest of the file)


    const filteredCustomers = customers.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.phone && c.phone.includes(searchTerm));
        const matchesView = viewMode === 'all' || (viewMode === 'vip' && c.type === 'VIP');
        return matchesSearch && matchesView;
    });

    if (loading) return <div className="text-white">Loading Customers...</div>;

    const vipCount = customers.filter(c => c.type === 'VIP').length;

    return (
        <div className="space-y-8 animate-fade-in h-[calc(100vh-8rem)] flex flex-col relative">
            {/* Notification Toast */}
            {notification.show && (
                <div className={`fixed top-10 right-10 z-[9999] px-6 py-4 rounded-xl shadow-2xl border flex items-center gap-3 transition-all duration-300 transform translate-y-0 opacity-100 ${notification.type === 'success'
                    ? 'bg-[#1A1D21] border-primary-gold/50 shadow-primary-gold/20'
                    : 'bg-[#1A1D21] border-red-500/50 shadow-red-500/20'
                    }`}>
                    <div className={`p-2 rounded-full ${notification.type === 'success' ? 'bg-primary-gold/10 text-primary-gold' : 'bg-red-500/10 text-red-500'}`}>
                        {notification.type === 'success' ? (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                            </svg>
                        )}
                    </div>
                    <div>
                        <h4 className={`font-bold text-sm ${notification.type === 'success' ? 'text-primary-gold' : 'text-red-500'}`}>
                            {notification.type === 'success' ? 'Success' : 'Error'}
                        </h4>
                        <p className="text-gray-300 text-xs">{notification.message}</p>
                    </div>
                    <button onClick={() => setNotification(prev => ({ ...prev, show: false }))} className="ml-2 text-gray-500 hover:text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">CRM & Communication</h1>
                    <p className="text-gray-400 mt-1">Customer relationships and marketing.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    {/* Important Contract / VIP Toggle */}
                    <button
                        onClick={() => setViewMode(viewMode === 'all' ? 'vip' : 'all')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all w-full sm:w-auto ${viewMode === 'vip'
                            ? 'bg-purple-500/20 border-purple-500/50 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                            : 'bg-[#121418] text-gray-300 border-white/10 hover:bg-white/5'
                            }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.557.557 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.557.557 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                        </svg>
                        <span className="font-bold">Important Contract</span>
                        {vipCount > 0 && (
                            <span className="ml-1 bg-purple-500 text-black text-[10px] px-1.5 py-0.5 rounded-full font-bold">{vipCount}</span>
                        )}
                    </button>

                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-primary-gold text-black px-6 py-2 rounded-xl font-bold hover:bg-yellow-400 transition-colors w-full sm:w-auto shadow-lg shadow-primary-gold/20"
                    >
                        Add Customer
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 overflow-hidden">
                {/* Customer List */}
                <div className="lg:col-span-2 flex flex-col bg-[#121418] rounded-2xl border border-white/5 overflow-hidden shadow-2xl shadow-black/50">
                    <div className="p-8 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-[#121418] to-primary-gold/5">
                        <div>
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                {viewMode === 'vip' ? 'Important Contracts (VIP)' : 'Customer Database'}
                                <span className="bg-white/10 text-gray-400 text-xs px-2 py-0.5 rounded-full">{filteredCustomers.length}</span>
                            </h2>
                            <p className="text-xs text-gray-400 mt-1">Manage and track your customer base.</p>
                        </div>
                        <div className="relative w-full sm:w-auto">
                            <input
                                type="text"
                                placeholder="Search customers..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full sm:w-64 bg-[#0B0D10] border border-white/10 rounded-xl px-4 py-2.5 pl-10 text-sm text-white focus:outline-none focus:border-primary-gold/50 transition-all shadow-inner shadow-black/50"
                            />
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                            </svg>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-4 custom-scrollbar">
                        {filteredCustomers.length === 0 ? (
                            <div className="col-span-2 flex flex-col items-center justify-center text-center py-20 opacity-50">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 text-gray-600 mb-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                                </svg>
                                <p className="text-gray-400 font-medium">No customers found.</p>
                                <p className="text-gray-600 text-xs mt-1">Try adjusting your search or add a new customer.</p>
                            </div>
                        ) : (
                            filteredCustomers.map((customer) => (
                                <div key={customer.id} className="bg-gradient-to-br from-[#1A1D21] to-[#0B0D10] p-5 rounded-2xl border border-white/5 hover:border-primary-gold/30 transition-all group cursor-pointer relative hover:shadow-lg hover:shadow-black/60 overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary-gold/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-150 duration-700"></div>

                                    <div className="flex justify-between items-start mb-5 relative z-10">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-gold to-yellow-700 flex items-center justify-center text-black font-extrabold text-xl shadow-lg border border-white/10 group-hover:scale-105 transition-transform">
                                                {customer.name.charAt(0)}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-white text-base group-hover:text-primary-gold transition-colors line-clamp-1">{customer.name}</h3>
                                                <p className="text-xs text-gray-500 font-mono tracking-wide mt-0.5">{customer.phone}</p>
                                                {customer.email && <p className="text-[10px] text-gray-400 truncate max-w-[140px] flex items-center gap-1 mt-1 opacity-70">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                                        <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" />
                                                        <path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" />
                                                    </svg>
                                                    {customer.email}
                                                </p>}
                                            </div>
                                        </div>
                                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider border shadow-md ${customer.type === 'VIP'
                                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-purple-900/20'
                                            : customer.type === 'New'
                                                ? 'bg-green-500/10 text-green-400 border-green-500/20 shadow-green-900/20'
                                                : 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-blue-900/20'
                                            }`}>
                                            {customer.type}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 mb-5 relative z-10 bg-black/20 p-3 rounded-lg border border-white/5">
                                        <div>
                                            <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Total Spent</p>
                                            <p className="text-white font-bold text-sm tracking-tight">৳ {customer.total_spent?.toLocaleString()}</p>
                                        </div>
                                        <div className="text-right border-l border-white/5 pl-3">
                                            <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Last Visit</p>
                                            <p className="text-white text-sm">{new Date(customer.last_visit).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 relative z-10">
                                        <button
                                            onClick={() => setSelectedCustomer(customer)}
                                            className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 py-2.5 rounded-lg text-xs font-bold transition-all border border-white/5 hover:border-white/20"
                                        >
                                            Profile
                                        </button>
                                        <button
                                            onClick={() => {
                                                setEmailTarget(customer);
                                                setShowEmailModal(true);
                                            }}
                                            className="flex-1 bg-primary-gold/10 hover:bg-primary-gold/20 text-primary-gold py-2.5 rounded-lg text-xs font-bold transition-all border border-primary-gold/20 hover:border-primary-gold/40 flex items-center justify-center gap-1.5"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                                            </svg>
                                            Message
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="bg-[#121418] rounded-2xl border border-white/5 flex flex-col overflow-hidden h-full shadow-2xl shadow-black/50">
                    <div className="p-8 border-b border-white/5 bg-gradient-to-r from-[#121418] to-primary-gold/10 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-24 h-24 text-primary-gold">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2 relative z-10">Email Campaign</h2>
                    </div>

                    <div className="p-8 flex-1 flex flex-col gap-6">
                        <div>
                            <label className="block text-gray-400 text-xs uppercase font-bold mb-3 tracking-wider ml-1">Receiving Audience</label>
                            <div className="relative group">
                                <select
                                    value={messageRecipient}
                                    onChange={(e) => setMessageRecipient(e.target.value)}
                                    className="w-full bg-[#0B0D10] border border-white/10 rounded-xl p-4 text-white text-sm focus:outline-none focus:border-primary-gold appearance-none transition-all cursor-pointer group-hover:border-white/20"
                                >
                                    <option>All VIP Customers</option>
                                    <option>All Customers</option>
                                    <option>Customers with Due Payments</option>
                                    <option>Recent Visitors (Last 30 Days)</option>
                                    {messageRecipient.includes('(') && <option value={messageRecipient}>{messageRecipient}</option>}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col">
                            <label className="block text-gray-400 text-xs uppercase font-bold mb-3 tracking-wider ml-1">Campaign Details</label>
                            <div className="relative group mb-3">
                                <select
                                    value={selectedPromoTemplate}
                                    onChange={(e) => applyPromotionalTemplate(e.target.value)}
                                    className="w-full bg-[#0B0D10] border border-white/10 rounded-xl p-3.5 text-white text-sm focus:outline-none focus:border-primary-gold appearance-none transition-all cursor-pointer group-hover:border-white/20"
                                >
                                    <option value="custom">Preset Promotional Mail (Select)</option>
                                    {promotionalTemplates.map((template) => (
                                        <option key={template.id} value={template.id}>
                                            {template.label}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                    </svg>
                                </div>
                            </div>
                            {loadingCouponTemplates ? (
                                <p className="text-[11px] text-gray-500 ml-1 mb-3">Loading coupon presets...</p>
                            ) : couponTemplates.length > 0 ? (
                                <p className="text-[11px] text-primary-gold/80 ml-1 mb-3">{couponTemplates.length} coupon preset available.</p>
                            ) : null}
                            <input
                                type="text"
                                value={emailSubject}
                                onChange={(e) => setEmailSubject(e.target.value)}
                                className="w-full bg-[#0B0D10] border border-white/10 rounded-xl p-4 mb-4 text-white text-sm focus:outline-none focus:border-primary-gold transition-all placeholder-gray-600"
                                placeholder="Subject Line"
                            />
                            <div className="relative flex-1 flex flex-col">
                                <textarea
                                    value={emailBody}
                                    onChange={(e) => setEmailBody(e.target.value)}
                                    className="w-full flex-1 bg-[#0B0D10] border border-white/10 rounded-xl p-4 text-white text-sm focus:outline-none focus:border-primary-gold resize-none leading-relaxed transition-all placeholder-gray-600 min-h-[200px]"
                                    placeholder="Write your email content here..."
                                ></textarea>
                                <div className="absolute bottom-4 right-4 flex gap-2">
                                    <button className="text-xs text-primary-gold hover:text-white font-medium flex items-center gap-1 bg-primary-gold/10 px-3 py-1.5 rounded-lg transition-colors border border-primary-gold/20 hover:bg-primary-gold/20">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                                        </svg>
                                        Insert HTML
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (selectedPromoTemplate === 'custom') {
                                                showToast('Select a preset template first.', 'error');
                                                return;
                                            }
                                            applyPromotionalTemplate(selectedPromoTemplate, false);
                                        }}
                                        className="text-xs text-primary-gold hover:text-white font-medium flex items-center gap-1 bg-primary-gold/10 px-3 py-1.5 rounded-lg transition-colors border border-primary-gold/20 hover:bg-primary-gold/20"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                        </svg>
                                        Templates
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleSendEmailBlast}
                            disabled={sendingEmail}
                            className={`w-full bg-gradient-to-r from-primary-gold to-yellow-500 text-black font-bold py-4 rounded-xl hover:from-yellow-400 hover:to-primary-gold transition-all shadow-[0_0_20px_rgba(250,204,21,0.3)] hover:shadow-[0_0_30px_rgba(250,204,21,0.5)] flex items-center justify-center gap-2 transform active:scale-[0.99] ${sendingEmail ? 'opacity-70 cursor-wait' : ''}`}>
                            {sendingEmail ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Sending Blast...
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                                    </svg>
                                    Send Email Blast
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {showModal && createPortal(
                <div className="modal-overlay">
                    <div className="absolute inset-0" onClick={() => setShowModal(false)}></div>
                    <div className="modal-container max-w-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</h2>
                            <button onClick={() => { setShowModal(false); setEditingCustomer(null); }} className="modal-close-btn">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="modal-content">
                            <div>
                                <label className="modal-label">Customer Name</label>
                                <input type="text" name="name" required value={newCustomer.name} onChange={handleInputChange} className="modal-input" />
                            </div>
                            <div>
                                <label className="modal-label">Phone Number</label>
                                <input type="text" name="phone" value={newCustomer.phone} onChange={handleInputChange} className="modal-input" />
                            </div>

                            <div>
                                <label className="modal-label">Email Address</label>
                                <input type="email" name="email" value={newCustomer.email} onChange={handleInputChange} className="modal-input" placeholder="Optional" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="modal-label">Type</label>
                                    <select name="type" value={newCustomer.type} onChange={handleInputChange} className="modal-input">
                                        <option value="New">New</option>
                                        <option value="Regular">Regular</option>
                                        <option value="VIP">VIP</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="modal-label">Total Spent</label>
                                    <input type="number" name="total_spent" value={newCustomer.total_spent} onChange={handleInputChange} className="modal-input" />
                                </div>
                            </div>

                            <div>
                                <label className="modal-label">Last Visit</label>
                                <input type="date" name="last_visit" value={newCustomer.last_visit} onChange={handleInputChange} className="modal-input" />
                            </div>

                            <div className="modal-footer">
                                <button type="button" onClick={() => { setShowModal(false); setEditingCustomer(null); }} className="modal-btn-cancel">Cancel</button>
                                <button type="submit" className="modal-btn-primary">{editingCustomer ? 'Update Customer' : 'Add Customer'}</button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )
            }

            {/* View Profile Modal */}
            {
                selectedCustomer && createPortal(
                    <div className="modal-overlay">
                        <div className="absolute inset-0" onClick={() => setSelectedCustomer(null)}></div>
                        <div className="modal-container max-w-lg" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2 className="modal-title">Customer Profile</h2>
                                <button onClick={() => setSelectedCustomer(null)} className="modal-close-btn">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="modal-content pt-0">
                                <div className="flex flex-col items-center mb-8">
                                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-gold to-yellow-600 flex items-center justify-center text-black font-bold text-4xl mb-4 shadow-lg shadow-primary-gold/20">
                                        {selectedCustomer.name.charAt(0)}
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-1">{selectedCustomer.name}</h3>
                                    <p className="text-gray-400">{selectedCustomer.phone}</p>
                                    {selectedCustomer.email && (
                                        <p className="text-gray-500 text-sm mt-1">{selectedCustomer.email}</p>
                                    )}
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mt-3 ${selectedCustomer.type === 'VIP'
                                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                        : selectedCustomer.type === 'New'
                                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                        }`}>
                                        {selectedCustomer.type} Member
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    <div className="bg-[#0B0D10] p-4 rounded-xl border border-white/5 text-center">
                                        <p className="text-gray-500 text-xs uppercase mb-1">Total Spent</p>
                                        <p className="text-white font-bold text-lg">৳ {selectedCustomer.total_spent?.toLocaleString()}</p>
                                    </div>
                                    <div className="bg-[#0B0D10] p-4 rounded-xl border border-white/5 text-center">
                                        <p className="text-gray-500 text-xs uppercase mb-1">Last Visit</p>
                                        <p className="text-white font-bold text-lg">{new Date(selectedCustomer.last_visit).toLocaleDateString()}</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <button
                                        onClick={() => {
                                            handleEditClick(selectedCustomer);
                                            setSelectedCustomer(null);
                                        }}
                                        className="w-full bg-primary-gold/10 text-primary-gold py-3 rounded-xl font-bold hover:bg-primary-gold/20 transition-colors border border-primary-gold/30"
                                    >
                                        Edit Customer Info
                                    </button>

                                    <button
                                        onClick={() => toggleVIP(selectedCustomer)}
                                        className={`w-full py-3 rounded-xl font-bold transition-colors border ${selectedCustomer.type === 'VIP'
                                            ? 'bg-transparent text-gray-400 border-white/10 hover:bg-white/5'
                                            : 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20'
                                            }`}
                                    >
                                        {selectedCustomer.type === 'VIP' ? 'Remove VIP Status' : 'Mark as VIP'}
                                    </button>

                                    <button
                                        onClick={() => {
                                            setEmailTarget(selectedCustomer);
                                            setShowEmailModal(true);
                                            setSelectedCustomer(null);
                                        }}
                                        className="w-full bg-white/5 text-white py-3 rounded-xl font-bold hover:bg-white/10 transition-colors border border-white/5"
                                    >
                                        Send Message
                                    </button>

                                    <button
                                        onClick={() => deleteCustomer(selectedCustomer.id)}
                                        className="w-full text-red-400 py-3 rounded-xl font-bold hover:bg-red-500/10 transition-colors"
                                    >
                                        Delete Customer
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )
            }

            {/* Email Modal */}
            {
                blastConfirm.open && createPortal(
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                        <button
                            type="button"
                            aria-label="Close confirmation"
                            onClick={closeBlastConfirm}
                            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
                        />
                        <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-b from-[#1A1D21] to-[#0E1014] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 h-10 w-10 rounded-xl border border-primary-gold/30 bg-primary-gold/10 text-primary-gold flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Confirm Email Blast</h3>
                                    <p className="mt-1 text-sm text-gray-300">
                                        Send to <span className="text-primary-gold font-semibold">{blastConfirm.recipientLabel}</span> ({blastConfirm.recipientCount.toLocaleString()} recipients)?
                                    </p>
                                </div>
                            </div>

                            <div className="mt-5 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-xs text-gray-400">
                                Subject: <span className="text-gray-200">{emailSubject}</span>
                            </div>

                            <div className="mt-6 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={closeBlastConfirm}
                                    disabled={sendingEmail}
                                    className={`px-4 py-2 rounded-lg border border-white/15 text-sm font-semibold text-gray-200 hover:bg-white/5 transition-colors ${sendingEmail ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmSendEmailBlast}
                                    disabled={sendingEmail}
                                    className={`px-4 py-2 rounded-lg text-sm font-semibold text-black bg-gradient-to-r from-primary-gold to-yellow-500 hover:from-yellow-400 hover:to-primary-gold transition-colors ${sendingEmail ? 'opacity-70 cursor-wait' : ''}`}
                                >
                                    {sendingEmail ? 'Sending...' : 'Send Blast'}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )
            }

            {
                showEmailModal && emailTarget && createPortal(
                    <div className="modal-overlay">
                        <div className="absolute inset-0" onClick={() => setShowEmailModal(false)}></div>
                        <div className="modal-container max-w-lg" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2 className="modal-title">Send Email</h2>
                                <button onClick={() => setShowEmailModal(false)} className="modal-close-btn">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="modal-content">
                                <div className="mb-4 p-4 bg-primary-gold/10 border border-primary-gold/20 rounded-xl flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary-gold text-black flex items-center justify-center font-bold">
                                            {emailTarget.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-white font-bold">{emailTarget.name}</p>
                                            <p className="text-gray-400 text-xs">{emailTarget.email || "No email address found"}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleEditClick(emailTarget)}
                                        className="text-primary-gold hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
                                        title="Edit Customer Details"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                        </svg>
                                    </button>
                                </div>

                                <div className="mb-4">
                                    <label className="modal-label">Subject</label>
                                    <input
                                        type="text"
                                        value={emailSubject}
                                        onChange={(e) => setEmailSubject(e.target.value)}
                                        className="modal-input"
                                        placeholder="Email Subject"
                                    />
                                </div>

                                <div className="mb-4">
                                    <label className="modal-label">Message</label>
                                    <textarea
                                        value={emailBody}
                                        onChange={(e) => setEmailBody(e.target.value)}
                                        className="modal-input min-h-[150px] resize-none"
                                        placeholder="Write your message here..."
                                    ></textarea>
                                </div>

                                <button
                                    onClick={async () => {
                                        if (!emailTarget.email) {
                                            showToast("This customer does not have an email address.", 'error');
                                            return;
                                        }
                                        if (!emailSubject.trim() || !emailBody.trim()) {
                                            showToast("Please enter both subject and message content.", 'error');
                                            return;
                                        }
                                        try {
                                            setSendingEmail(true);
                                            await sendEmailRequest([emailTarget.email], emailSubject, emailBody);
                                            showToast("Email sent successfully!", 'success');
                                            setShowEmailModal(false);
                                            setEmailSubject('');
                                            setEmailBody('');
                                        } catch (err) {
                                            showToast(err.message || "Failed to send email.", 'error');
                                        } finally {
                                            setSendingEmail(false);
                                        }
                                    }}
                                    disabled={sendingEmail || !emailTarget.email}
                                    className={`w-full modal-btn-primary flex items-center justify-center gap-2 ${sendingEmail || !emailTarget.email ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {sendingEmail ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                                            </svg>
                                            Send Email
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )
            }
        </div >
    );
};

export default CRM;
