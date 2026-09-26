import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Save, Trash2, X } from 'lucide-react';

const buildDefaultFormData = (initialData = null) => {
    if (!initialData) {
        return {
            customer_id: '',
            customer_name: '',
            customer_email: '',
            product_name: '',
            karigar_name: '',
            gold_weight: '',
            due_date: '',
            notes: ''
        };
    }

    const dueDate = initialData?.due_date ? String(initialData.due_date).slice(0, 10) : '';
    return {
        customer_id: initialData.customer_id
            ? String(initialData.customer_id)
            : (initialData.customer_name ? '__existing__' : ''),
        customer_name: initialData.customer_name || '',
        customer_email: initialData.customer_email || '',
        product_name: initialData.product_name || '',
        karigar_name: initialData.karigar_name || '',
        gold_weight: initialData.gold_weight ?? '',
        due_date: dueDate,
        notes: initialData.notes || ''
    };
};

const NewManufacturingOrderModal = ({
    isOpen,
    mode = 'create',
    initialData = null,
    onClose,
    onSave,
    onDelete,
    customers = [],
    customersLoading = false,
    staff = [],
    staffLoading = false
}) => {
    const isEditMode = mode === 'edit';
    const [formData, setFormData] = useState(buildDefaultFormData(initialData));

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCustomerSelect = (e) => {
        const selectedId = e.target.value;
        const selectedCustomer = selectableCustomers.find((c) => String(c.id) === String(selectedId));
        setFormData((prev) => ({
            ...prev,
            customer_id: selectedId,
            customer_name: selectedCustomer?.name || '',
            customer_email: selectedCustomer?.email || ''
        }));
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

    const selectableCustomers = useMemo(() => {
        if (!isEditMode || !formData.customer_name) return customerOptions;

        const exists = customerOptions.some((customer) =>
            String(customer.id) === String(formData.customer_id)
            || (customer?.name || '').trim().toLowerCase() === formData.customer_name.trim().toLowerCase()
        );

        if (exists) return customerOptions;

        return [
            {
                id: formData.customer_id || `existing-${formData.customer_name}`,
                name: formData.customer_name,
                email: formData.customer_email || '',
                phone: ''
            },
            ...customerOptions
        ];
    }, [customerOptions, formData.customer_email, formData.customer_id, formData.customer_name, isEditMode]);

    const staffOptions = useMemo(() => {
        const seen = new Set();
        return staff
            .filter((s) => (s?.status || 'Active') === 'Active')
            .filter((s) => {
                const key = `${(s?.full_name || '').trim().toLowerCase()}|${(s?.phone || '').trim()}`;
                if (!s?.full_name || seen.has(key)) return false;
                seen.add(key);
                return true;
            });
    }, [staff]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const rawCustomerId = String(formData.customer_id ?? '').trim();
        const customerIdValue = /^\d+$/.test(rawCustomerId) ? Number(rawCustomerId) : null;

        onSave({
            ...formData,
            customer_id: customerIdValue,
            gold_weight: parseFloat(formData.gold_weight) || 0
        });

        if (!isEditMode) {
            setFormData(buildDefaultFormData());
        }
    };

    const handleDelete = () => {
        if (!onDelete) return;

        const confirmed = window.confirm('Delete this manufacturing order? This action cannot be undone.');
        if (!confirmed) return;

        onDelete();
    };

    useEffect(() => {
        if (!isOpen) return undefined;

        setFormData(buildDefaultFormData(isEditMode ? initialData : null));

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const onKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);

        return () => {
            document.body.style.overflow = originalOverflow;
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [initialData, isEditMode, isOpen, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fade-in">
            <div
                className="absolute inset-0 bg-black/75 backdrop-blur-md"
                onClick={onClose}
            />
            <div className="modal-container relative z-[201]">
                <div className="absolute inset-0 bg-gradient-to-b from-primary-gold/5 to-transparent pointer-events-none"></div>

                <div className="modal-header">
                    <h2 className="modal-title">{isEditMode ? 'Edit Manufacturing Order' : 'New Manufacturing Order'}</h2>
                    <button onClick={onClose} className="modal-close-btn">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="modal-content">
                    <div className="space-y-4">
                        <div>
                            <label className="modal-label">Customer Name *</label>
                            <select
                                name="customer_id"
                                required
                                value={formData.customer_id}
                                onChange={handleCustomerSelect}
                                className="modal-input appearance-none"
                                disabled={customersLoading || (!isEditMode && customerOptions.length === 0)}
                            >
                                <option value="">
                                    {customersLoading
                                        ? 'Loading customers...'
                                        : selectableCustomers.length > 0
                                            ? 'Select customer'
                                            : 'No customer found in CRM'}
                                </option>
                                {selectableCustomers.map((customer) => (
                                    <option key={customer.id || `${customer.name}-${customer.phone}`} value={customer.id}>
                                        {customer.name}{customer.phone ? ` (${customer.phone})` : ''}
                                    </option>
                                ))}
                            </select>
                            {!customersLoading && customerOptions.length === 0 && !isEditMode && (
                                <p className="text-xs text-yellow-400 mt-2">
                                    Add customers from CRM first, then select here.
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="modal-label">Items (Product Name) *</label>
                            <input
                                type="text"
                                name="product_name"
                                required
                                value={formData.product_name}
                                onChange={handleChange}
                                className="modal-input"
                                placeholder="e.g. Diamond Ring"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="modal-label">Gold Weight (g)</label>
                                <input
                                    type="number"
                                    name="gold_weight"
                                    step="0.01"
                                    value={formData.gold_weight}
                                    onChange={handleChange}
                                    className="modal-input"
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <label className="modal-label">Due Date</label>
                                <input
                                    type="date"
                                    name="due_date"
                                    value={formData.due_date}
                                    onChange={handleChange}
                                    className="modal-input"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="modal-label">Assign Karigar (Optional)</label>
                            <select
                                name="karigar_name"
                                value={formData.karigar_name}
                                onChange={handleChange}
                                className="modal-input appearance-none"
                                disabled={staffLoading || staffOptions.length === 0}
                            >
                                <option value="">
                                    {staffLoading
                                        ? 'Loading staff...'
                                        : staffOptions.length > 0
                                            ? 'Select staff'
                                            : 'No active staff found'}
                                </option>
                                {staffOptions.map((member) => (
                                    <option key={member.id || `${member.full_name}-${member.phone}`} value={member.full_name}>
                                        {member.full_name}
                                        {member.role ? ` (${member.role})` : ''}
                                        {member.phone ? ` - ${member.phone}` : ''}
                                    </option>
                                ))}
                            </select>
                            {!staffLoading && staffOptions.length === 0 && (
                                <p className="text-xs text-yellow-400 mt-2">
                                    Add active staff from Manage Staff first, then assign here.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="modal-footer pt-6 mt-2 border-t border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        {isEditMode && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="h-12 px-5 rounded-xl border border-red-500/40 bg-red-500/5 text-red-300 hover:bg-red-500/15 hover:border-red-400/70 hover:text-red-200 transition-all font-semibold flex items-center justify-center gap-2 shadow-lg shadow-red-900/20"
                            >
                                <Trash2 size={16} />
                                Delete Order
                            </button>
                        )}
                        <div className="flex w-full sm:w-auto gap-3 sm:ml-auto">
                            <button
                                type="button"
                                onClick={onClose}
                                className="h-12 px-6 rounded-xl border border-white/15 bg-[#161a22] text-gray-200 hover:bg-[#1b2130] hover:border-white/25 transition-all font-semibold flex items-center justify-center"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="h-12 px-6 rounded-xl bg-gradient-to-r from-primary-gold to-[#f2c94c] text-black font-bold hover:brightness-110 transition-all shadow-lg shadow-primary-gold/25 flex items-center justify-center gap-2"
                            >
                                <Save size={16} />
                                {isEditMode ? 'Save Changes' : 'Create Order'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default NewManufacturingOrderModal;
