const nowIso = () => new Date().toISOString();

const tomorrowIso = () => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString();
};

const nextId = (items) => items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const matchBranch = (item, branch, allBranches = false) => {
    if (allBranches || !branch) return true;
    return String(item.branch || item.name || '').trim().toLowerCase() === String(branch).trim().toLowerCase();
};

const createDemoState = () => {
    const demoUser = {
        id: 1,
        full_name: 'Demo Shop Owner',
        phone: '01700000000',
        identifier: 'admin',
        password: 'admin',
        shop_name: 'Gold Rush Demo Jewellers',
        shopowner_id: 'SP-DEMO',
        branch_count: 2,
        tax_id: 'DEMO-TAX',
        subscription_plan: 'free',
        subscription_status: 'active',
        subscription_end_date: null,
        account_approval_status: 'approved',
        approval_note: '',
        created_at: nowIso(),
        latitude: 23.8103,
        longitude: 90.4125,
        shop_logo_url: ''
    };

    return {
        users: [demoUser],
        branches: [
            {
                id: 1,
                name: 'Main Branch',
                location: 'Bashundhara City, Dhaka',
                status: 'Active',
                daily_sales: 186000,
                stock_value: '2450000',
                branch_passcode: '123456',
                is_main: 1,
                user_id: 1,
                shopowner_id: 'SP-DEMO',
                created_at: nowIso()
            }
        ],
        products: [
            {
                id: 1,
                product_code: 'GR-RING-001',
                name: 'Classic Gold Ring',
                category: 'Ring',
                karat: '22K',
                weight: 4.25,
                price: 42000,
                stock_quantity: 8,
                image_url: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=600&q=80',
                branch: 'Main Branch',
                status: 'In Stock',
                user_id: 1,
                shopowner_id: 'SP-DEMO',
                is_marketplace_live: 1,
                created_at: nowIso()
            },
            {
                id: 2,
                product_code: 'GR-NECK-001',
                name: 'Bridal Necklace Set',
                category: 'Necklace',
                karat: '22K',
                weight: 18.7,
                price: 228000,
                stock_quantity: 3,
                image_url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80',
                branch: 'Main Branch',
                status: 'Low Stock',
                user_id: 1,
                shopowner_id: 'SP-DEMO',
                is_marketplace_live: 1,
                created_at: nowIso()
            },
            {
                id: 3,
                product_code: 'CTG-BGL-001',
                name: 'Main Branch Gold Bangle',
                category: 'Bangle',
                karat: '21K',
                weight: 11.2,
                price: 118000,
                stock_quantity: 5,
                image_url: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=600&q=80',
                branch: 'Main Branch',
                status: 'In Stock',
                user_id: 1,
                shopowner_id: 'SP-DEMO',
                is_marketplace_live: 1,
                created_at: nowIso()
            }
        ],
        customers: [
            { id: 1, name: 'Nadia Rahman', phone: '01711111111', email: 'nadia@example.com', type: 'VIP', total_spent: 315000, branch: 'Main Branch', user_id: 1, shopowner_id: 'SP-DEMO', last_visit: nowIso() },
            { id: 2, name: 'Karim Ullah', phone: '01812345678', email: 'karim@example.com', type: 'Regular', total_spent: 86000, branch: 'Main Branch', user_id: 1, shopowner_id: 'SP-DEMO', last_visit: nowIso() }
        ],
        sales: [
            { id: 1, transaction_id: 'TXN-DEMO-101', customer_name: 'Nadia Rahman', customer_phone: '01711111111', total_amount: 228000, tax_amount: 11400, final_amount: 239400, payment_method: 'Cash', status: 'Completed', branch: 'Main Branch', user_id: 1, shopowner_id: 'SP-DEMO', sale_date: nowIso(), created_at: nowIso() },
            { id: 2, transaction_id: 'TXN-DEMO-102', customer_name: 'Karim Ullah', customer_phone: '01812345678', total_amount: 118000, tax_amount: 5900, final_amount: 123900, payment_method: 'Card', status: 'Completed', branch: 'Main Branch', user_id: 1, shopowner_id: 'SP-DEMO', sale_date: nowIso(), created_at: nowIso() }
        ],
        repairs: [
            { id: 1, ticket_id: 'REP-DEMO-001', customer_name: 'Karim Ullah', customer_phone: '01812345678', item_name: 'Broken Chain', issue_description: 'Soldering needed', estimated_cost: 800, status: 'Active', branch: 'Main Branch', user_id: 1, shopowner_id: 'SP-DEMO', created_at: nowIso() }
        ],
        manufacturing: [
            { id: 1, order_id: 'MFG-DEMO-001', customer_name: 'Nadia Rahman', customer_phone: '01711111111', product_name: 'Custom Bridal Ring', karigar_name: 'Rahim', status: 'In Progress', gold_weight: 6.4, due_date: tomorrowIso(), branch: 'Main Branch', user_id: 1, shopowner_id: 'SP-DEMO', created_at: nowIso() }
        ],
        installments: [
            { id: 1, customer_name: 'Nadia Rahman', product_name: 'Bridal Necklace Set', total_amount: 228000, paid_amount: 100000, due_amount: 128000, status: 'Active', branch: 'Main Branch', user_id: 1, shopowner_id: 'SP-DEMO', created_at: nowIso() }
        ],
        staff: [
            { id: 1, full_name: 'Rahim Ahmed', phone: '01722222222', email: 'rahim@example.com', role: 'Manager', branch: 'Main Branch', status: 'Active', user_id: 1, shopowner_id: 'SP-DEMO', created_at: nowIso() },
            { id: 2, full_name: 'Shila Akter', phone: '01733333333', email: 'shila@example.com', role: 'Sales', branch: 'Main Branch', status: 'Active', user_id: 1, shopowner_id: 'SP-DEMO', created_at: nowIso() }
        ],
        transfers: [],
        coupons: [
            { id: 1, code: 'DEMO10', title: 'Demo Discount', description: '10% off for demo checkout', discount_type: 'percentage', discount_value: 10, minimum_order_amount: 1000, maximum_discount_amount: 5000, starts_at: nowIso(), expires_at: tomorrowIso(), usage_limit: 100, usage_count: 2, is_active: 1, shopowner_user_id: 1, shopowner_id: 'SP-DEMO' }
        ],
        conversations: [
            { id: 1, customer_name: 'Marketplace Customer', customer_phone: '01900000000', last_message: 'Is the bridal set available today?', unread_count: 1, updated_at: nowIso(), user_id: 1, shopowner_id: 'SP-DEMO' }
        ],
        messages: [
            { id: 1, conversation_id: 1, sender_type: 'user', message: 'Is the bridal set available today?', is_read: 0, created_at: nowIso() },
            { id: 2, conversation_id: 1, sender_type: 'shopowner', message: 'Yes, it is available at Main Branch.', is_read: 1, created_at: nowIso() }
        ],
        shopProfile: {
            shop_slug: 'gold-rush-demo-jewellers',
            shop_name: 'Gold Rush Demo Jewellers',
            logo_url: '',
            banner_url: '',
            logo_position_x: 50,
            logo_position_y: 50,
            logo_zoom: 100,
            banner_position_x: 50,
            banner_position_y: 50,
            banner_zoom: 100,
            is_live: 1
        }
    };
};

const state = createDemoState();

const listByBranch = (items, req) => {
    const allBranches = String(req.query.allBranches || '').toLowerCase() === 'true' || req.query.allBranches === '1';
    return items.filter((item) => matchBranch(item, req.query.branch, allBranches));
};

const sendList = (res, items) => res.json(items);

const sendSaved = (res, collection, payload, defaults = {}) => {
    const item = {
        id: nextId(collection),
        ...defaults,
        ...payload,
        created_at: nowIso()
    };
    collection.unshift(item);
    return res.status(201).json(item);
};

const updateItem = (collection, id, payload) => {
    const index = collection.findIndex((item) => String(item.id) === String(id));
    if (index === -1) return null;
    collection[index] = { ...collection[index], ...payload, updated_at: nowIso() };
    return collection[index];
};

const deleteItem = (collection, id) => {
    const index = collection.findIndex((item) => String(item.id) === String(id));
    if (index === -1) return false;
    collection.splice(index, 1);
    return true;
};

const dashboardInsights = () => ({
    stats: {
        today_sales_total: state.sales.reduce((sum, sale) => sum + toNumber(sale.final_amount), 0),
        pending_orders: state.manufacturing.filter((order) => String(order.status).toLowerCase() !== 'completed').length,
        active_repairs: state.repairs.filter((repair) => String(repair.status).toLowerCase() !== 'completed').length
    },
    customers: {
        total_customers: state.customers.length,
        vip_customers: state.customers.filter((customer) => String(customer.type).toLowerCase() === 'vip').length,
        active_customers_30d: state.customers.length,
        top_customer: state.customers[0] || null
    },
    products: {
        top_trending: state.products.slice(0, 4).map((product) => ({
            product_name: product.name,
            total_quantity: Math.max(1, Math.min(8, toNumber(product.stock_quantity))),
            total_revenue: toNumber(product.price)
        }))
    },
    operations: {
        low_stock_count: state.products.filter((product) => toNumber(product.stock_quantity) <= 3).length,
        overdue_repairs: 0,
        due_manufacturing_7d: state.manufacturing.length
    },
    recent_activity: state.sales.map((sale) => ({
        id: `sale-${sale.id}`,
        type: 'Sale',
        message: `Sale completed: ${sale.transaction_id}`,
        customer_name: sale.customer_name,
        customer_phone: sale.customer_phone,
        amount_label: `Tk ${toNumber(sale.final_amount).toLocaleString()}`,
        status: sale.status,
        timestamp: sale.created_at || sale.sale_date || nowIso()
    }))
});

const adminDetails = (userId) => {
    const user = state.users.find((item) => String(item.id) === String(userId)) || state.users[0];
    const branches = state.branches.filter((branch) => String(branch.user_id) === String(user.id));
    const products = state.products.filter((product) => String(product.user_id) === String(user.id));
    return {
        user,
        summary: {
            total_branches: branches.length,
            total_products: products.length,
            total_stock_value: products.reduce((sum, product) => sum + (toNumber(product.price) * toNumber(product.stock_quantity)), 0)
        },
        branches,
        products,
        documents: [
            {
                id: 1,
                document_type: 'trade_license',
                document_label: 'Demo Trade License',
                file_name: 'demo-license.txt',
                mime_type: 'text/plain',
                file_size_bytes: 32,
                uploaded_at: nowIso()
            }
        ]
    };
};

const demoForecast = () => {
    const output = {};
    for (let i = 0; i < 7; i += 1) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        output[date.toISOString().slice(0, 10)] = 22755 + (i * 55);
    }
    return output;
};

const createDemoMiddleware = ({ enabled = true } = {}) => {
    if (!enabled) return (req, res, next) => next();

    return (req, res, next) => {
        if (!req.path.startsWith('/api')) return next();

        const method = req.method.toUpperCase();
        const path = req.path;
        const body = req.body || {};

        if (path === '/api/health') {
            return res.json({ status: 'connected', mode: 'demo', message: 'Demo server is healthy' });
        }

        if (path === '/api/auth/signin' && method === 'POST') {
            const identifier = String(body.identifier || '').trim().toLowerCase();
            const password = String(body.password || '').trim().toLowerCase();
            if (identifier === 'admin' && password === 'admin') {
                return res.json({ message: 'Demo shop owner login successful', user: state.users[0] });
            }
            return res.json({ message: 'Demo login successful', user: state.users[0] });
        }

        if (path === '/api/auth/signup' && method === 'POST') {
            const user = {
                ...state.users[0],
                id: nextId(state.users),
                full_name: body.fullName || body.full_name || 'Demo User',
                phone: body.phone || '01700000000',
                identifier: body.identifier || `demo-${Date.now()}@example.com`,
                shop_name: body.shop_name || 'Demo Shop',
                shopowner_id: `SP-${Date.now().toString().slice(-5)}`,
                account_approval_status: 'approved'
            };
            state.users.unshift(user);
            return res.status(201).json({ message: 'Demo user registered successfully', user, awaiting_approval: false });
        }

        if (path === '/api/auth/google' && method === 'POST') {
            return res.json({ message: 'Demo Google login successful', user: state.users[0] });
        }

        if (path === '/api/admin/users' && method === 'GET') return sendList(res, state.users);
        if (/^\/api\/admin\/users\/[^/]+\/details$/.test(path) && method === 'GET') {
            return res.json(adminDetails(path.split('/')[4]));
        }
        if (/^\/api\/admin\/users\/[^/]+\/documents\/[^/]+$/.test(path) && method === 'GET') {
            return res.json({
                id: path.split('/')[6],
                file_name: 'demo-license.txt',
                mime_type: 'text/plain',
                file_data: 'data:text/plain;base64,RGVtbyBkb2N1bWVudCBwcmV2aWV3'
            });
        }
        if (/^\/api\/admin\/users\/[^/]+$/.test(path) && method === 'PUT') {
            const updated = updateItem(state.users, path.split('/')[4], body) || state.users[0];
            return res.json({ ...updated, trial_granted: body.account_approval_status === 'approved' });
        }
        if (/^\/api\/admin\/users\/[^/]+$/.test(path) && method === 'DELETE') {
            deleteItem(state.users, path.split('/')[4]);
            return res.json({ success: true });
        }
        if (/^\/api\/admin\/branches\/[^/]+$/.test(path) && method === 'DELETE') {
            deleteItem(state.branches, path.split('/')[4]);
            return res.json({ success: true });
        }
        if (/^\/api\/admin\/products\/[^/]+$/.test(path) && method === 'DELETE') {
            deleteItem(state.products, path.split('/')[4]);
            return res.json({ success: true });
        }

        if (path === '/api/branches' && method === 'GET') return sendList(res, state.branches);
        if (path === '/api/branches' && method === 'POST') {
            return sendSaved(res, state.branches, body, { status: 'Active', daily_sales: 0, stock_value: '0', branch_passcode: '123456', is_main: 0, user_id: 1, shopowner_id: 'SP-DEMO' });
        }
        if (/^\/api\/branches\/[^/]+$/.test(path) && method === 'PUT') {
            return res.json(updateItem(state.branches, path.split('/')[3], body) || {});
        }
        if (/^\/api\/branches\/[^/]+$/.test(path) && method === 'DELETE') {
            deleteItem(state.branches, path.split('/')[3]);
            return res.json({ success: true });
        }
        if (path === '/api/branches/verify-passcode' && method === 'POST') {
            return res.json({ success: true, verified: true });
        }

        if (path === '/api/inventory' && method === 'GET') return sendList(res, listByBranch(state.products, req));
        if (path === '/api/inventory' && method === 'POST') {
            return sendSaved(res, state.products, body, { product_code: `GR-DEMO-${Date.now().toString().slice(-4)}`, status: 'In Stock', user_id: 1, shopowner_id: 'SP-DEMO', is_marketplace_live: 1 });
        }
        if (/^\/api\/inventory\/[^/]+$/.test(path) && method === 'PUT') return res.json(updateItem(state.products, path.split('/')[3], body) || {});
        if (/^\/api\/inventory\/[^/]+$/.test(path) && method === 'DELETE') {
            deleteItem(state.products, path.split('/')[3]);
            return res.json({ success: true });
        }

        if (path === '/api/sales' && method === 'GET') return sendList(res, listByBranch(state.sales, req));
        if (/^\/api\/sales\/[^/]+$/.test(path) && method === 'GET') {
            const sale = state.sales.find((item) => String(item.id) === String(path.split('/')[3]));
            return res.json({ sale: sale || null, items: state.products.slice(0, 2).map((product) => ({ ...product, quantity: 1 })) });
        }
        if (/^\/api\/sales\/[^/]+$/.test(path) && method === 'PUT') return res.json(updateItem(state.sales, path.split('/')[3], body) || {});
        if (/^\/api\/sales\/[^/]+$/.test(path) && method === 'DELETE') {
            deleteItem(state.sales, path.split('/')[3]);
            return res.json({ success: true });
        }
        if (path === '/api/payment/init' && method === 'POST') {
            const sale = {
                id: nextId(state.sales),
                transaction_id: body.tran_id || `TXN-DEMO-${Date.now()}`,
                customer_name: body.customerName || body.customer_name || 'Walk-in Customer',
                total_amount: toNumber(body.totalAmount || body.total_amount),
                tax_amount: toNumber(body.taxAmount || body.tax_amount),
                final_amount: toNumber(body.finalAmount || body.final_amount || body.amount),
                payment_method: body.paymentMethod || body.payment_method || 'Cash',
                status: 'Completed',
                branch: body.branch || 'Main Branch',
                user_id: 1,
                shopowner_id: 'SP-DEMO',
                created_at: nowIso()
            };
            state.sales.unshift(sale);
            return res.json({ success: true, sale, paymentUrl: null, redirectUrl: null, tran_id: sale.transaction_id });
        }

        if (path === '/api/dashboard/insights' && method === 'GET') return res.json(dashboardInsights());
        if (path === '/api/reports/analytics' && method === 'GET') return res.json(dashboardInsights());
        if (path === '/api/gold-forecast' && method === 'GET') return res.json(demoForecast());
        if (path === '/api/blog' && method === 'GET') return res.json([]);
        if (path === '/api/contact' && method === 'POST') return res.json({ message: 'Demo contact request received' });
        if (path === '/api/crm/send-email' && method === 'POST') return res.json({ success: true, message: 'Demo email queued' });

        const crudMap = [
            ['/api/repairs', state.repairs],
            ['/api/customers', state.customers],
            ['/api/installments', state.installments],
            ['/api/manufacturing', state.manufacturing],
            ['/api/staff', state.staff],
            ['/api/stock-transfers', state.transfers]
        ];

        for (const [basePath, collection] of crudMap) {
            if (path === basePath && method === 'GET') return sendList(res, listByBranch(collection, req));
            if (path === basePath && method === 'POST') {
                const defaults = basePath === '/api/stock-transfers'
                    ? { transfer_id: `TR-DEMO-${Date.now().toString().slice(-4)}`, transfer_date: nowIso(), status: 'Pending', user_id: 1, shopowner_id: 'SP-DEMO' }
                    : { user_id: 1, shopowner_id: 'SP-DEMO' };
                return sendSaved(res, collection, body, defaults);
            }
            if (path.startsWith(`${basePath}/`) && method === 'GET') {
                const item = collection.find((entry) => String(entry.id) === String(path.split('/')[3]));
                return res.json(item || {});
            }
            if (path.startsWith(`${basePath}/`) && (method === 'PUT' || method === 'PATCH')) {
                return res.json(updateItem(collection, path.split('/')[3], body) || {});
            }
            if (path.startsWith(`${basePath}/`) && method === 'DELETE') {
                deleteItem(collection, path.split('/')[3]);
                return res.json({ success: true });
            }
        }

        if (/^\/api\/installments\/[^/]+\/payments$/.test(path)) {
            return method === 'GET' ? res.json([]) : res.status(201).json({ success: true });
        }

        if (path === '/api/user-profile' && method === 'GET') return res.json(state.users[0]);
        if (path === '/api/user-profile' && method === 'PUT') {
            Object.assign(state.users[0], body, { updated_at: nowIso() });
            return res.json(state.users[0]);
        }
        if (path === '/api/change-password' && method === 'POST') return res.json({ success: true });
        if (path === '/api/subscription/update' && method === 'POST') {
            state.users[0].subscription_plan = body.plan || state.users[0].subscription_plan;
            return res.json({ success: true, user: state.users[0], paymentUrl: null });
        }

        if (path === '/api/gl/shop-visibility' && method === 'GET') return res.json({ is_live: state.shopProfile.is_live });
        if (path === '/api/gl/shop-visibility' && method === 'PUT') {
            state.shopProfile.is_live = body.isLive ?? body.is_live ? 1 : 0;
            return res.json({ is_live: state.shopProfile.is_live });
        }
        if (path === '/api/gl/shop-profile' && method === 'GET') return res.json(state.shopProfile);
        if (path === '/api/gl/shop-profile' && method === 'PUT') {
            Object.assign(state.shopProfile, {
                logo_url: body.logoUrl ?? body.logo_url ?? state.shopProfile.logo_url,
                banner_url: body.bannerUrl ?? body.banner_url ?? state.shopProfile.banner_url,
                logo_position_x: body.logoPositionX ?? body.logo_position_x ?? state.shopProfile.logo_position_x,
                logo_position_y: body.logoPositionY ?? body.logo_position_y ?? state.shopProfile.logo_position_y,
                logo_zoom: body.logoZoom ?? body.logo_zoom ?? state.shopProfile.logo_zoom,
                banner_position_x: body.bannerPositionX ?? body.banner_position_x ?? state.shopProfile.banner_position_x,
                banner_position_y: body.bannerPositionY ?? body.banner_position_y ?? state.shopProfile.banner_position_y,
                banner_zoom: body.bannerZoom ?? body.banner_zoom ?? state.shopProfile.banner_zoom
            });
            return res.json(state.shopProfile);
        }
        if (path === '/api/gl/overview-stats' && method === 'GET') return res.json({ cartCustomers: 4, cartItems: 9, engagedVisitors: 28, orders30d: state.sales.length });
        if (path === '/api/gl/sales-history' && method === 'GET') return res.json(state.sales);
        if (path === '/api/gl/product-visibility' && method === 'PUT') {
            const product = updateItem(state.products, body.productId || body.product_id, { is_marketplace_live: body.isLive ?? body.is_live ? 1 : 0 });
            return res.json(product || { success: true });
        }
        if (path === '/api/gl/products/trending' && method === 'GET') return res.json(state.products);
        if (path === '/api/gl/coupons' && method === 'GET') return res.json(state.coupons);
        if (path === '/api/gl/coupons' && method === 'POST') return sendSaved(res, state.coupons, body, { usage_count: 0, is_active: body.isActive ? 1 : 0, shopowner_user_id: 1, shopowner_id: 'SP-DEMO' });
        if (/^\/api\/gl\/coupons\/[^/]+\/usage-history$/.test(path) && method === 'GET') return res.json([]);
        if (/^\/api\/gl\/coupons\/[^/]+\/status$/.test(path) && method === 'PUT') return res.json(updateItem(state.coupons, path.split('/')[4], { is_active: body.isActive ?? body.is_active ? 1 : 0 }) || {});
        if (/^\/api\/gl\/coupons\/[^/]+$/.test(path) && method === 'DELETE') {
            deleteItem(state.coupons, path.split('/')[4]);
            return res.json({ success: true });
        }
        if (path === '/api/gl/coupons/validate' && method === 'POST') return res.json({ valid: true, coupon: state.coupons[0], discount_amount: 100 });
        if (path === '/api/gl/coupons/redeem' && method === 'POST') return res.json({ success: true, coupon: state.coupons[0] });
        if (path === '/api/gl/shops' && method === 'GET') return res.json([{ ...state.shopProfile, owner_user_id: 1, owner_shopowner_id: 'SP-DEMO' }]);
        if (/^\/api\/gl\/shops\/[^/]+$/.test(path) && method === 'GET') return res.json({ ...state.shopProfile, owner_user_id: 1, owner_shopowner_id: 'SP-DEMO' });
        if (/^\/api\/gl\/shops\/[^/]+\/branches$/.test(path) && method === 'GET') return res.json(state.branches);
        if (/^\/api\/gl\/shops\/[^/]+\/products$/.test(path) && method === 'GET') return res.json(state.products.filter((product) => product.is_marketplace_live));

        if (path === '/api/chat/conversations' && method === 'GET') return res.json(state.conversations);
        if (/^\/api\/chat\/messages\/[^/]+$/.test(path) && method === 'GET') {
            return res.json(state.messages.filter((message) => String(message.conversation_id) === String(path.split('/')[4])));
        }
        if (path === '/api/chat/messages' && method === 'POST') {
            const conversationId = Number(body.conversationId || body.conversation_id || 1);
            const message = { id: nextId(state.messages), conversation_id: conversationId, sender_type: body.senderType || body.sender_type || 'shopowner', message: body.message || '', is_read: 0, created_at: nowIso() };
            state.messages.push(message);
            return res.status(201).json(message);
        }
        if (path === '/api/chat/typing' && method === 'PUT') return res.json({ success: true, is_typing: Boolean(body.isTyping ?? body.is_typing) });
        if (/^\/api\/chat\/typing\/[^/]+$/.test(path) && method === 'GET') return res.json({ is_typing: false, ttl_seconds: 4 });
        if (/^\/api\/chat\/messages\/read\/[^/]+$/.test(path) && method === 'PUT') return res.json({ success: true });

        return res.json({ success: true, mode: 'demo' });
    };
};

module.exports = createDemoMiddleware;
