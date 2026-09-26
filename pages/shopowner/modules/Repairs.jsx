import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';

const Repairs = () => {
    const ticketStatuses = ['Active', 'In Progress', 'Waiting for Approval', 'Completed'];
    const [repairs, setRepairs] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [customersLoading, setCustomersLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Details Modal State
    const [selectedTicket, setSelectedTicket] = useState(null);

    // Status Check Search
    const [searchId, setSearchId] = useState('');
    const [searchResult, setSearchResult] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchField, setSearchField] = useState('all');
    const [statusFilter, setStatusFilter] = useState('All');
    const getStatusTone = (status) => (
        status === 'Completed'
            ? 'text-green-400 border-green-500/30'
            : status === 'In Progress'
                ? 'text-blue-400 border-blue-500/30'
                : status === 'Waiting for Approval'
                    ? 'text-orange-400 border-orange-500/30'
                    : 'text-yellow-400 border-yellow-500/30'
    );

    const [newTicket, setNewTicket] = useState({
        customer_id: '',
        customer_name: '',
        customer_phone: '',
        customer_email: '',
        item_name: '',
        issue_description: '',
        estimated_cost: '',
        due_date: ''
    });

    useEffect(() => {
        fetchRepairs();
        fetchCustomers();
    }, []);

    const fetchRepairs = async () => {
        try {
            const activeBranch = localStorage.getItem('activeBranch') || 'Main Branch';
            const userId = localStorage.getItem('userId');
            const shopownerId = localStorage.getItem('shopownerId');
            const queryParam = shopownerId ? `shopownerId=${shopownerId}` : `userId=${userId}`;
            const res = await fetch(`/api/repairs?branch=${encodeURIComponent(activeBranch)}&${queryParam}`);
            const data = await res.json();
            setRepairs(data);
            setLoading(false);
        } catch (err) {
            console.error("Error fetching repairs:", err);
            setLoading(false);
        }
    };

    const fetchCustomers = async () => {
        try {
            setCustomersLoading(true);
            const activeBranch = localStorage.getItem('activeBranch') || 'Main Branch';
            const userId = localStorage.getItem('userId');
            const shopownerId = localStorage.getItem('shopownerId');
            const queryParam = shopownerId ? `shopownerId=${shopownerId}` : `userId=${userId}`;
            const res = await fetch(`/api/customers?branch=${encodeURIComponent(activeBranch)}&${queryParam}`);
            const data = await res.json();
            setCustomers(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Error fetching customers:", err);
            setCustomers([]);
        } finally {
            setCustomersLoading(false);
        }
    };

    const handleInputChange = (e) => {
        setNewTicket({ ...newTicket, [e.target.name]: e.target.value });
    };

    const customerOptions = useMemo(() => {
        const seen = new Set();
        return customers.filter((c) => {
            const key = `${(c?.name || '').trim().toLowerCase()}|${(c?.phone || '').trim()}`;
            if (!c?.name || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [customers]);

    const handleCustomerSelect = (e) => {
        const selectedId = e.target.value;
        if (!selectedId) {
                setNewTicket((prev) => ({
                    ...prev,
                    customer_id: '',
                    customer_name: '',
                    customer_phone: '',
                    customer_email: ''
                }));
            return;
        }
        const selectedCustomer = customers.find((c) => String(c.id) === selectedId);
        if (!selectedCustomer) return;
        setNewTicket((prev) => ({
            ...prev,
            customer_id: String(selectedCustomer.id),
            customer_name: selectedCustomer.name || '',
            customer_phone: selectedCustomer.phone || '',
            customer_email: selectedCustomer.email || ''
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const activeBranch = localStorage.getItem('activeBranch') || 'Main Branch';
            const userId = localStorage.getItem('userId');
            const shopownerId = localStorage.getItem('shopownerId');
            const res = await fetch('/api/repairs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newTicket, branch: activeBranch, userId, shopownerId })
            });
            if (res.ok) {
                setShowModal(false);
                setNewTicket({
                    customer_id: '',
                    customer_name: '',
                    customer_phone: '',
                    customer_email: '',
                    item_name: '',
                    issue_description: '',
                    estimated_cost: '',
                    due_date: ''
                });
                fetchRepairs();
            }
        } catch (err) {
            console.error("Error creating ticket:", err);
        }
    };

    const updateStatus = async (id, nextStatus) => {
        const previousTicket = repairs.find((r) => r.id === id);
        if (!previousTicket || previousTicket.status === nextStatus) return;

        // Optimistic UI update for instant feedback
        setRepairs((prev) => prev.map((r) => (r.id === id ? { ...r, status: nextStatus } : r)));
        if (selectedTicket && selectedTicket.id === id) {
            setSelectedTicket((prev) => (prev ? { ...prev, status: nextStatus } : prev));
        }

        try {
            const res = await fetch(`/api/repairs/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: nextStatus })
            });

            if (!res.ok) {
                throw new Error(`Status update failed (${res.status})`);
            }

            const updated = await res.json();
            setRepairs((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r)));
            if (selectedTicket && selectedTicket.id === id) {
                setSelectedTicket((prev) => (prev ? { ...prev, ...updated } : prev));
            }
        } catch (err) {
            console.error("Error updating status:", err);
            // rollback on failure
            setRepairs((prev) => prev.map((r) => (r.id === id ? { ...r, status: previousTicket.status } : r)));
            if (selectedTicket && selectedTicket.id === id) {
                setSelectedTicket((prev) => (prev ? { ...prev, status: previousTicket.status } : prev));
            }
        }
    };

    const handleStatusCheck = () => {
        if (!searchId) return;
        const ticket = repairs.find(r => r.ticket_id.toLowerCase().includes(searchId.toLowerCase()));
        if (ticket) {
            setSearchResult({ found: true, ...ticket });
        } else {
            setSearchResult({ found: false });
        }
        // Clear result after 5 seconds
        setTimeout(() => setSearchResult(null), 5000);
    };

    const searchFieldLabels = {
        all: 'All Fields',
        ticket_id: 'Ticket ID',
        customer_name: 'Customer',
        customer_phone: 'Phone',
        item_name: 'Item',
        issue_description: 'Issue'
    };

    const normalizedSearch = searchQuery.trim().toLowerCase();
    const filteredRepairs = repairs.filter((repair) => {
        const matchesStatus = statusFilter === 'All' ? true : repair.status === statusFilter;
        if (!normalizedSearch) return matchesStatus;

        const getFieldValue = (field) => (repair[field] ?? '').toString().toLowerCase();
        const matchesSearch = searchField === 'all'
            ? ['ticket_id', 'customer_name', 'customer_phone', 'item_name', 'issue_description']
                .some((field) => getFieldValue(field).includes(normalizedSearch))
            : getFieldValue(searchField).includes(normalizedSearch);

        return matchesStatus && matchesSearch;
    });

    if (loading) return <div className="text-white">Loading Repairs...</div>;

    return (
        <div className="space-y-8 animate-fade-in relative">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Repair Management</h1>
                    <p className="text-gray-400 mt-1">Manage customer repairs and services.</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-primary-gold text-black px-6 py-3 rounded-xl font-bold hover:bg-yellow-400 transition-colors shadow-lg shadow-primary-gold/20 w-full md:w-auto"
                >
                    New Repair Ticket
                </button>
            </div>

            <div className="w-full bg-[#121418] rounded-2xl border border-white/5 overflow-hidden">
                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">Active Tickets</h2>
                    <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto md:items-center">
                        <div className="flex gap-2 w-full md:w-auto">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-[#0B0D10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-gold/50"
                            >
                                <option value="All">All Status</option>
                                <option value="Active">Active</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Waiting for Approval">Waiting for Approval</option>
                                <option value="Completed">Completed</option>
                            </select>
                            <select
                                value={searchField}
                                onChange={(e) => setSearchField(e.target.value)}
                                className="bg-[#0B0D10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-gold/50"
                            >
                                {Object.entries(searchFieldLabels).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <input
                            type="text"
                            placeholder={`Search by ${searchFieldLabels[searchField]}...`}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-[#0B0D10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-gold/50 w-full md:w-64"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-left text-sm text-gray-400">
                        <thead className="bg-[#0f1115] text-xs uppercase font-medium text-gray-300">
                            <tr>
                                <th className="p-4">Ticket ID</th>
                                <th className="p-4">Customer</th>
                                <th className="p-4">Item & Issue</th>
                                <th className="p-4">Received Date</th>
                                <th className="p-4 text-center">Status</th>
                                <th className="p-4">Est. Cost</th>
                                <th className="p-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredRepairs.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="p-10 text-center text-gray-500">No repair tickets found. Create one to get started.</td>
                                </tr>
                            ) : (
                                filteredRepairs.map((repair) => (
                                    <tr key={repair.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4 font-mono text-xs">{repair.ticket_id}</td>
                                        <td className="p-4 font-bold text-white">
                                            {repair.customer_name}
                                            <div className="text-xs text-gray-500 font-normal">{repair.customer_phone}</div>
                                        </td>
                                        <td className="p-4">
                                            <p className="text-white">{repair.item_name}</p>
                                            <p className="text-xs text-gray-500">{repair.issue_description}</p>
                                        </td>
                                        <td className="p-4">{new Date(repair.received_date).toLocaleDateString()}</td>
                                        <td className="p-4 min-w-[180px] align-middle">
                                            <div className="relative w-[160px] mx-auto">
                                                <select
                                                    value={repair.status}
                                                    onChange={(e) => updateStatus(repair.id, e.target.value)}
                                                    className={`w-full px-3 py-2 rounded-lg text-xs font-semibold border transition-all focus:outline-none appearance-none pr-8 bg-[#0B0D10] hover:border-primary-gold/40 ${getStatusTone(repair.status)}`}
                                                >
                                                    {ticketStatuses.map((status) => (
                                                        <option key={status} value={status} className="text-white bg-[#0B0D10]">
                                                            {status}
                                                        </option>
                                                    ))}
                                                </select>
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-gray-500 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                                </svg>
                                            </div>
                                        </td>
                                        <td className="p-4 font-bold text-white">৳ {repair.estimated_cost}</td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => setSelectedTicket(repair)}
                                                className="text-primary-gold hover:underline"
                                            >
                                                Details
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Ticket Modal - Portal to Body */}
            {showModal && createPortal(
                <div className="modal-overlay">
                    <div className="absolute inset-0" onClick={() => setShowModal(false)}></div>

                    {/* Modal Content - Centered */}
                    <div className="modal-container max-w-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Create New Repair Ticket</h2>
                            <button onClick={() => setShowModal(false)} className="modal-close-btn">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="modal-content">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="modal-label">Customer Name</label>
                                    <select
                                        name="customer_id"
                                        required
                                        value={newTicket.customer_id}
                                        onChange={handleCustomerSelect}
                                        className="modal-input appearance-none"
                                        disabled={customersLoading || customerOptions.length === 0}
                                    >
                                        <option value="">
                                            {customersLoading
                                                ? 'Loading customers...'
                                                : customerOptions.length > 0
                                                    ? 'Select customer'
                                                    : 'No CRM customer found'}
                                        </option>
                                        {customerOptions.map((customer) => (
                                            <option key={customer.id || `${customer.name}-${customer.phone}`} value={String(customer.id)}>
                                                {customer.name}{customer.phone ? ` (${customer.phone})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    {!customersLoading && customerOptions.length === 0 && (
                                        <p className="text-xs text-yellow-400 mt-2">
                                            Add customers from CRM first, then create ticket.
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="modal-label">Phone Number</label>
                                    <input type="text" name="customer_phone" value={newTicket.customer_phone} onChange={handleInputChange} className="modal-input" />
                                </div>
                            </div>

                            <div>
                                <label className="modal-label">Item Name</label>
                                <input type="text" name="item_name" required placeholder="e.g. Gold Necklace" value={newTicket.item_name} onChange={handleInputChange} className="modal-input" />
                            </div>

                            <div>
                                <label className="modal-label">Issue Description</label>
                                <textarea name="issue_description" required placeholder="Describe the repair needed..." value={newTicket.issue_description} onChange={handleInputChange} className="modal-input h-20 resize-none"></textarea>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="modal-label">Estimated Cost</label>
                                    <input type="number" name="estimated_cost" value={newTicket.estimated_cost} onChange={handleInputChange} className="modal-input" />
                                </div>
                                <div>
                                    <label className="modal-label">Delivery Date</label>
                                    <input type="date" name="due_date" value={newTicket.due_date} onChange={handleInputChange} className="modal-input" />
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" onClick={() => setShowModal(false)} className="modal-btn-cancel">Cancel</button>
                                <button type="submit" className="modal-btn-primary">Create Ticket</button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* View Details Modal - Portal to Body */}
            {selectedTicket && createPortal(
                <div className="modal-overlay">
                    <div className="absolute inset-0" onClick={() => setSelectedTicket(null)}></div>

                    <div className="modal-container max-w-4xl h-[75vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="modal-header">
                            <div>
                                <h2 className="modal-title mb-1.5">Repair Ticket Details</h2>
                                <p className="text-primary-gold font-mono text-base">{selectedTicket.ticket_id}</p>
                            </div>
                            <button
                                onClick={() => setSelectedTicket(null)}
                                className="modal-close-btn"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                                {/* Left Column: Customer & Item */}
                                <div className="lg:col-span-2 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-[#121418] p-5 rounded-2xl border border-white/5 h-full">
                                            <h3 className="text-xs text-gray-400 uppercase font-bold mb-4 tracking-wider">Customer Info</h3>
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xl">
                                                    {selectedTicket.customer_name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="text-white font-bold text-lg">{selectedTicket.customer_name}</p>
                                                    <p className="text-gray-400 font-mono">{selectedTicket.customer_phone}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-[#121418] p-5 rounded-2xl border border-white/5 h-full">
                                            <h3 className="text-xs text-gray-400 uppercase font-bold mb-4 tracking-wider text-center">Status</h3>
                                            <div className="flex flex-col gap-2 items-center">
                                                <div className="relative w-full max-w-[260px]">
                                                    <select
                                                        value={selectedTicket.status}
                                                        onChange={(e) => updateStatus(selectedTicket.id, e.target.value)}
                                                        className={`w-full px-4 py-2.5 rounded-lg text-left font-semibold border focus:outline-none appearance-none pr-9 bg-[#0B0D10] hover:border-primary-gold/40 ${getStatusTone(selectedTicket.status)}`}
                                                    >
                                                        {ticketStatuses.map((status) => (
                                                            <option key={status} value={status} className="text-white bg-[#0B0D10]">
                                                                {status}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-500 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                                    </svg>
                                                </div>
                                                <p className="text-xs text-gray-500 text-center mt-1">Select status from dropdown</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-[#121418] p-5 rounded-2xl border border-white/5">
                                        <h3 className="text-xs text-gray-400 uppercase font-bold mb-4 tracking-wider">Item & Issue Details</h3>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-gray-500 text-xs">Item Name</label>
                                                <p className="text-white font-bold text-xl">{selectedTicket.item_name}</p>
                                            </div>
                                            <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                                                <label className="text-gray-500 text-xs block mb-2">Description of Issue</label>
                                                <p className="text-gray-300 leading-relaxed">{selectedTicket.issue_description}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-[#121418] p-4 rounded-xl border border-white/5 flex justify-between items-center">
                                            <span className="text-gray-400 text-sm">Received Date</span>
                                            <span className="text-white font-mono">{new Date(selectedTicket.received_date).toLocaleDateString()}</span>
                                        </div>
                                        <div className="bg-[#121418] p-4 rounded-xl border border-white/5 flex justify-between items-center">
                                            <span className="text-gray-400 text-sm">Due Date</span>
                                            <span className="text-white font-mono">{selectedTicket.due_date ? new Date(selectedTicket.due_date).toLocaleDateString() : 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Financials & Actions */}
                                <div className="space-y-6 flex flex-col h-full">
                                    <div className="bg-[#121418] p-5 rounded-2xl border border-white/5 flex-1 flex flex-col">
                                        <h3 className="text-xs text-gray-400 uppercase font-bold mb-6 tracking-wider">Billing Summary</h3>

                                        <div className="flex-1">
                                            <div className="flex justify-between items-center mb-6 p-4 bg-primary-gold/5 rounded-xl border border-primary-gold/10">
                                                <span className="text-gray-300">Estimated Cost</span>
                                                <span className="text-2xl font-bold text-primary-gold">৳ {selectedTicket.estimated_cost}</span>
                                            </div>

                                            {/* Placeholder for future billing items */}
                                            <div className="space-y-3">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-500">Service Charge</span>
                                                    <span className="text-gray-500">--</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-500">Spare Parts</span>
                                                    <span className="text-gray-500">--</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-6 space-y-3 pt-5 border-t border-white/5">
                                            <button className="w-full bg-white/5 hover:bg-white/10 text-white py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                                                </svg>
                                                Generate Invoice
                                            </button>
                                            <button className="w-full bg-primary-gold hover:bg-yellow-400 text-black py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-primary-gold/20 flex items-center justify-center gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                                                </svg>
                                                Contact Customer
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="modal-footer justify-end border-t border-white/10 p-5 mt-0">
                            <button
                                onClick={() => setSelectedTicket(null)}
                                className="modal-btn-cancel flex-none px-8"
                            >
                                CloseDetails
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default Repairs;
