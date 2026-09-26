import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import CustomAlert from '../../../components/CustomAlert';
import { fileToDataUrl } from '../../../utils/demoUpload';

const INVENTORY_CATEGORIES = [
    { value: 'Ring', label: 'Rings' },
    { value: 'Necklace', label: 'Necklaces' },
    { value: 'Earring', label: 'Earrings' },
    { value: 'Bracelet', label: 'Bracelets' },
    { value: 'Bangle', label: 'Bangles' },
    { value: 'Pendant', label: 'Pendants' },
    { value: 'Anklet', label: 'Anklets' },
    { value: 'Nose Pin', label: 'Nose Pins' },
    { value: 'Coin', label: 'Coins' },
    { value: 'Brooch', label: 'Brooches' },
    { value: 'Watch', label: 'Watches' },
    { value: 'Cufflink', label: 'Cufflinks' },
    { value: 'Tiara', label: 'Tiaras' },
    { value: 'Bridal Set', label: 'Bridal Sets' },
    { value: 'Chain', label: 'Chain' }
];
const CUSTOM_CATEGORY_VALUE = '__custom__';
const PREDEFINED_CATEGORY_VALUES = INVENTORY_CATEGORIES.map((category) => category.value);

const Inventory = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [uploading, setUploading] = useState(false);

    // Alert State
    const [alertConfig, setAlertConfig] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'info', // success, danger, info
        onConfirm: null
    });

    const showAlert = (title, message, type = 'info', onConfirm = null) => {
        setAlertConfig({
            isOpen: true,
            title,
            message,
            type,
            onConfirm
        });
    };

    const closeAlert = () => {
        setAlertConfig(prev => ({ ...prev, isOpen: false }));
    };

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        category: '',
        karat: '22K',
        weight: '',
        price: '',
        stock_quantity: '',
        status: 'In Stock'
    });
    const [customCategory, setCustomCategory] = useState(null);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
    const categoryDropdownRef = useRef(null);
    const LOW_STOCK_THRESHOLD = 3;

    // Filtered Products
    const filteredProducts = products.filter(product => {
        const query = searchQuery.toLowerCase();
        return (
            product.name.toLowerCase().includes(query) ||
            (product.product_code && product.product_code.toLowerCase().includes(query)) ||
            (product.category && product.category.toLowerCase().includes(query))
        );
    });
    const lowStockCount = products.filter((product) => (
        product.status === 'Low Stock' || Number(product.stock_quantity) < LOW_STOCK_THRESHOLD
    )).length;

    const fetchProducts = async () => {
        try {
            const activeBranch = localStorage.getItem('activeBranch') || 'Main Branch';
            const userId = localStorage.getItem('userId');
            const shopownerId = localStorage.getItem('shopownerId');

            const queryParam = shopownerId ? `shopownerId=${shopownerId}` : `userId=${userId}`;
            const res = await fetch(`/api/inventory?branch=${encodeURIComponent(activeBranch)}&${queryParam}`);
            const data = await res.json();
            setProducts(data);
            setLoading(false);
        } catch (err) {
            console.error("Error fetching products:", err);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    useEffect(() => {
        const handleOutsideClick = (event) => {
            if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
                setIsCategoryDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, []);

    const resetForm = () => {
        setFormData({
            name: '',
            category: '',
            karat: '22K',
            weight: '',
            price: '',
            stock_quantity: '',
            status: 'In Stock'
        });
        setCustomCategory(null);
        setIsCategoryDropdownOpen(false);
        setImageFile(null);
        setImagePreview(null);
        setEditingProduct(null);
    };

    const handleOpenModal = (product = null) => {
        if (product) {
            const productCategory = String(product.category || '').trim();
            const isPredefinedCategory = PREDEFINED_CATEGORY_VALUES.includes(productCategory);

            setEditingProduct(product);
            setFormData({
                name: product.name,
                category: productCategory,
                karat: product.karat,
                weight: product.weight,
                price: product.price,
                stock_quantity: product.stock_quantity,
                status: product.status
            });
            setCustomCategory(isPredefinedCategory ? null : productCategory);
            setImagePreview(product.image_url || null);
        } else {
            resetForm();
        }
        setIsCategoryDropdownOpen(false);
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const normalizedCategory = String(formData.category || '').trim();
        if (!normalizedCategory) {
            showAlert('Validation Error', 'Please select or enter a category.', 'danger');
            return;
        }
        setUploading(true);

        try {
            let imageUrl = editingProduct?.image_url || null;

            if (imageFile) {
                imageUrl = await fileToDataUrl(imageFile);
            }

            const activeBranch = localStorage.getItem('activeBranch') || 'Main Branch';
            const userId = localStorage.getItem('userId');
            let response;
            if (editingProduct) {
                // Update
                response = await fetch(`/api/inventory/${editingProduct.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...formData, category: normalizedCategory, image_url: imageUrl, branch: activeBranch, userId })
                });
            } else {
                // Create
                const shopownerId = localStorage.getItem('shopownerId');
                response = await fetch('/api/inventory', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...formData, category: normalizedCategory, image_url: imageUrl, branch: activeBranch, userId, shopownerId })
                });
            }

            if (response.ok) {
                showAlert(
                    'Success',
                    editingProduct ? 'Product updated successfully' : 'Product added successfully',
                    'success'
                );
                setIsModalOpen(false);
                fetchProducts();
                resetForm();
            } else {
                showAlert('Error', 'Failed to save product. Please try again.', 'danger');
            }
        } catch (error) {
            console.error("Error saving product:", error);
            showAlert('Error', 'An unexpected error occurred.', 'danger');
        } finally {
            setUploading(false);
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDelete = async (id) => {
        showAlert(
            'Delete Product?',
            'Are you sure you want to delete this product? This action cannot be undone.',
            'danger',
            async () => {
                try {
                    const response = await fetch(`/api/inventory/${id}`, {
                        method: 'DELETE'
                    });

                    if (response.ok) {
                        fetchProducts(); // Refresh list silently or show success
                        // Optional: show secondary success alert
                        // setTimeout(() => showAlert('Deleted', 'Product has been removed.', 'success'), 300);
                    } else {
                        showAlert('Error', 'Failed to delete product.', 'danger');
                    }
                } catch (error) {
                    console.error("Error deleting product:", error);
                }
            }
        );
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'In Stock': return 'bg-green-500/10 text-green-400 border-green-500/20';
            case 'Low Stock': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
            case 'Out of Stock': return 'bg-red-500/10 text-red-400 border-red-500/20';
            default: return 'bg-gray-500/10 text-gray-400';
        }
    };

    if (loading) return <div className="text-white">Loading Inventory...</div>;

    const isCurrentCategoryPredefined = PREDEFINED_CATEGORY_VALUES.includes(String(formData.category || '').trim());
    const isCustomCategorySelected = customCategory !== null;
    const selectedCategoryValue = isCustomCategorySelected
        ? CUSTOM_CATEGORY_VALUE
        : (isCurrentCategoryPredefined ? formData.category : '');
    const showCustomCategoryInput = isCustomCategorySelected;
    const selectedCategoryLabel = selectedCategoryValue
        ? (selectedCategoryValue === CUSTOM_CATEGORY_VALUE
            ? 'Custom Category'
            : (INVENTORY_CATEGORIES.find((category) => category.value === selectedCategoryValue)?.label || selectedCategoryValue))
        : 'Select Category';

    const selectCategoryValue = (value) => {
        if (value === CUSTOM_CATEGORY_VALUE) {
            const nextCustomCategory = isCurrentCategoryPredefined
                ? ''
                : String(formData.category || '').trim();
            setCustomCategory(nextCustomCategory);
            setFormData({ ...formData, category: nextCustomCategory });
            setIsCategoryDropdownOpen(false);
            return;
        }

        setCustomCategory(null);
        setFormData({ ...formData, category: value });
        setIsCategoryDropdownOpen(false);
    };

    return (
        <div className="space-y-8 animate-fade-in relative">
            {/* Custom Alert */}
            <CustomAlert
                isOpen={alertConfig.isOpen}
                onClose={closeAlert}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                onConfirm={alertConfig.onConfirm}
            />

            {/* Modal */}
            {isModalOpen && createPortal(
                <div className="modal-overlay">
                    <div className="absolute inset-0" onClick={() => setIsModalOpen(false)}></div>
                    <div className="modal-container max-w-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="modal-close-btn">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="modal-content">
                            <div>
                                <label className="modal-label">Product Name</label>
                                <input
                                    type="text"
                                    required
                                    className="modal-input"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            {/* Image Upload */}
                            <div>
                                <label className="modal-label">Product Image</label>
                                <div className="flex items-center gap-4">
                                    <div className="relative w-20 h-20 bg-white/5 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center group">
                                        {imagePreview ? (
                                            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-gray-500">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                                            </svg>
                                        )}
                                        <label htmlFor="image-upload" className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-white">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                            </svg>
                                        </label>
                                        <input
                                            id="image-upload"
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleImageChange}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-gray-400">Upload a product image.</p>
                                        <p className="text-xs text-gray-500">PNG, JPG up to 5MB</p>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="modal-label">Category</label>
                                    <div className="relative" ref={categoryDropdownRef}>
                                        <button
                                            type="button"
                                            className="modal-input flex items-center justify-between text-left"
                                            onClick={() => setIsCategoryDropdownOpen((prev) => !prev)}
                                            aria-haspopup="listbox"
                                            aria-expanded={isCategoryDropdownOpen}
                                        >
                                            <span className={selectedCategoryValue ? 'text-white' : 'text-gray-400'}>
                                                {selectedCategoryLabel}
                                            </span>
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                strokeWidth={1.8}
                                                stroke="currentColor"
                                                className={`w-4 h-4 text-gray-400 transition-transform ${isCategoryDropdownOpen ? 'rotate-180' : ''}`}
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                            </svg>
                                        </button>
                                        {isCategoryDropdownOpen && (
                                            <div className="absolute z-50 mt-2 w-full rounded-xl border border-white/10 bg-[#0B0D10] shadow-xl max-h-40 overflow-y-auto custom-scrollbar">
                                                <button
                                                    type="button"
                                                    className={`w-full h-10 px-4 text-left text-sm transition-colors ${selectedCategoryValue === '' ? 'bg-white/10 text-white' : 'text-gray-200 hover:bg-white/5'}`}
                                                    onClick={() => selectCategoryValue('')}
                                                >
                                                    Select Category
                                                </button>
                                                {INVENTORY_CATEGORIES.map((category) => {
                                                    const isActive = selectedCategoryValue === category.value;
                                                    return (
                                                        <button
                                                            key={category.value}
                                                            type="button"
                                                            className={`w-full h-10 px-4 text-left text-sm transition-colors ${isActive ? 'bg-white/10 text-white' : 'text-gray-200 hover:bg-white/5'}`}
                                                            onClick={() => selectCategoryValue(category.value)}
                                                        >
                                                            {category.label}
                                                        </button>
                                                    );
                                                })}
                                                <button
                                                    type="button"
                                                    className={`w-full h-10 px-4 text-left text-sm transition-colors ${selectedCategoryValue === CUSTOM_CATEGORY_VALUE ? 'bg-white/10 text-white' : 'text-gray-200 hover:bg-white/5'}`}
                                                    onClick={() => selectCategoryValue(CUSTOM_CATEGORY_VALUE)}
                                                >
                                                    Custom Category
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    {showCustomCategoryInput && (
                                        <input
                                            type="text"
                                            className="modal-input mt-2"
                                            placeholder="Enter category name"
                                            value={customCategory ?? ''}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setCustomCategory(value);
                                                setFormData({ ...formData, category: value.trim() });
                                            }}
                                            required
                                        />
                                    )}
                                </div>
                                <div>
                                    <label className="modal-label">Karat</label>
                                    <select
                                        className="modal-input"
                                        value={formData.karat}
                                        onChange={e => setFormData({ ...formData, karat: e.target.value })}
                                    >
                                        <option value="24K">24K</option>
                                        <option value="22K">22K</option>
                                        <option value="21K">21K</option>
                                        <option value="18K">18K</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="modal-label">Weight (g)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="modal-input"
                                        value={formData.weight}
                                        onChange={e => setFormData({ ...formData, weight: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="modal-label">Price (BDT)</label>
                                    <input
                                        type="number"
                                        required
                                        className="modal-input"
                                        value={formData.price}
                                        onChange={e => setFormData({ ...formData, price: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="modal-label">Stock Quantity</label>
                                    <input
                                        type="number"
                                        className="modal-input"
                                        value={formData.stock_quantity}
                                        onChange={e => setFormData({ ...formData, stock_quantity: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="modal-label">Status</label>
                                    <select
                                        className="modal-input"
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                                    >
                                        <option value="In Stock">In Stock</option>
                                        <option value="Low Stock">Low Stock</option>
                                        <option value="Out of Stock">Out of Stock</option>
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="modal-btn-cancel">Cancel</button>
                                <button type="submit" className="modal-btn-primary" disabled={uploading}>
                                    {uploading ? 'Processing...' : (editingProduct ? 'Update Product' : 'Add Product')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Inventory & Supply Chain</h1>
                    <p className="text-gray-400 mt-1">Manage your jewelry stock and materials.</p>
                </div>
                <button onClick={() => handleOpenModal()} className="bg-primary-gold text-black px-6 py-3 rounded-xl font-bold hover:bg-yellow-400 transition-colors shadow-lg shadow-primary-gold/20 flex items-center gap-2 w-full md:w-auto justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Add New Product
                </button>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#121418] p-6 rounded-2xl border border-white/5">
                    <p className="text-gray-400 text-sm">Total Items</p>
                    <p className="text-2xl font-bold text-white mt-1">{products.length}</p>
                </div>
                <div className="bg-[#121418] p-6 rounded-2xl border border-white/5">
                    <p className="text-gray-400 text-sm">Total Value</p>
                    <p className="text-2xl font-bold text-primary-gold mt-1">৳ {products.reduce((acc, p) => acc + (p.price * p.stock_quantity), 0).toLocaleString()}</p>
                </div>
                <div className="bg-[#121418] p-6 rounded-2xl border border-white/5">
                    <p className="text-gray-400 text-sm">Low Stock Alerts</p>
                    <p className="text-2xl font-bold text-red-400 mt-1">{lowStockCount} Items</p>
                </div>
            </div>
            <div className="bg-[#121418] rounded-2xl border border-white/5 overflow-hidden">
                <div className="p-6 border-b border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h2 className="text-xl font-bold text-white">Product List</h2>
                    <div className="flex gap-3 w-full md:w-auto">
                        <input
                            type="text"
                            placeholder="Search products..."
                            className="bg-[#0B0D10] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-primary-gold/50 flex-1 md:w-64"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <button className="bg-white/5 text-white px-4 py-2 rounded-lg text-sm hover:bg-white/10">Filter</button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-400">
                        <thead className="bg-white/5 text-xs uppercase font-medium text-gray-300">
                            <tr>
                                <th className="p-4">Product Name</th>
                                <th className="p-4">Category</th>
                                <th className="p-4">Karat</th>
                                <th className="p-4">Weight</th>
                                <th className="p-4">Price</th>
                                <th className="p-4">Stock</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredProducts.map((product) => (
                                <tr key={product.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-gray-800 border border-gray-700 overflow-hidden flex-shrink-0">
                                                {product.image_url ? (
                                                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-600 font-bold text-xs">IMG</div>
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-bold text-white">{product.name}</p>
                                                <p className="text-xs text-gray-500">{product.product_code}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">{product.category}</td>
                                    <td className="p-4"><span className="bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded text-xs font-bold">{product.karat}</span></td>
                                    <td className="p-4 font-mono text-white">{product.weight} g</td>
                                    <td className="p-4 font-bold text-primary-gold">৳ {product.price?.toLocaleString()}</td>
                                    <td className="p-4">{product.stock_quantity}</td>
                                    <td className="p-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(product.status)}`}>
                                            {product.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleOpenModal(product)}
                                                className="text-gray-500 hover:text-white transition-colors"
                                                title="Edit"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleDelete(product.id)}
                                                className="text-gray-500 hover:text-red-400 transition-colors"
                                                title="Delete"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                </svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Inventory;
