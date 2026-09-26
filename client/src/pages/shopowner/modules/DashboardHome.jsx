import { useState, useEffect } from 'react';
import { SalesIcon, InventoryIcon, RepairsIcon } from '../components/Icons';

const DashboardHome = () => {
    const activeBranch = localStorage.getItem('activeBranch') || 'Main Branch';
    const [stats, setStats] = useState([
        { title: 'Total Sales (Today)', value: 'Tk 0', trend: '0%', isPositive: true, icon: SalesIcon, color: 'text-green-400' },
        { title: 'Gold Rate (22K)', value: 'Tk 22,755 / g', trend: '+0.8%', isPositive: true, icon: InventoryIcon, color: 'text-primary-gold' },
        { title: 'Pending Orders', value: '0', trend: '0', isPositive: true, icon: InventoryIcon, color: 'text-blue-400' },
        { title: 'Active Repairs', value: '0', trend: '0', isPositive: false, icon: RepairsIcon, color: 'text-orange-400' }
    ]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [topCustomer, setTopCustomer] = useState(null);
    const [topProducts, setTopProducts] = useState([]);
    const [customerMetrics, setCustomerMetrics] = useState({
        total_customers: 0,
        vip_customers: 0,
        active_customers_30d: 0
    });
    const [operations, setOperations] = useState({
        low_stock_count: 0,
        overdue_repairs: 0,
        due_manufacturing_7d: 0
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const shopownerId = localStorage.getItem('shopownerId');
                const userId = localStorage.getItem('userId');
                const ownerQuery = shopownerId
                    ? `shopownerId=${encodeURIComponent(shopownerId)}`
                    : (userId ? `userId=${encodeURIComponent(userId)}` : '');
                const endpoint = `/api/dashboard/insights?branch=${encodeURIComponent(activeBranch)}${ownerQuery ? `&${ownerQuery}` : ''}`;

                const insightsRes = await fetch(endpoint);
                const insights = await insightsRes.json();
                const statsData = insights?.stats || {};
                const customersData = insights?.customers || {};
                const productsData = insights?.products || {};
                const operationsData = insights?.operations || {};
                const recentData = Array.isArray(insights?.recent_activity) ? insights.recent_activity : [];

                setStats((prev) => [
                    { ...prev[0], value: `Tk ${Number(statsData.today_sales_total || 0).toLocaleString()}` },
                    prev[1],
                    { ...prev[2], value: Number(statsData.pending_orders || 0).toString() },
                    { ...prev[3], value: Number(statsData.active_repairs || 0).toString() }
                ]);

                setRecentActivity(recentData);
                setTopCustomer(customersData.top_customer || null);
                setTopProducts(Array.isArray(productsData.top_trending) ? productsData.top_trending : []);
                setCustomerMetrics({
                    total_customers: Number(customersData.total_customers || 0),
                    vip_customers: Number(customersData.vip_customers || 0),
                    active_customers_30d: Number(customersData.active_customers_30d || 0)
                });
                setOperations({
                    low_stock_count: Number(operationsData.low_stock_count || 0),
                    overdue_repairs: Number(operationsData.overdue_repairs || 0),
                    due_manufacturing_7d: Number(operationsData.due_manufacturing_7d || 0)
                });
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            }
        };

        fetchData();
    }, [activeBranch]);

    const formatDate = (value) => {
        if (!value) return '--';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '--';
        return date.toLocaleDateString();
    };

    const formatDateTime = (value) => {
        if (!value) return '--';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '--';
        return date.toLocaleString();
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-white">Dashboard Overview</h1>
                    <p className="text-gray-400 mt-1">
                        Displaying data for <span className="text-primary-gold font-bold">{activeBranch}</span>
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-sm text-gray-400">Current Gold Rate (22K)</p>
                    <p className="text-2xl font-bold text-primary-gold">Tk 22,755 <span className="text-sm text-gray-500 font-normal">/ gram</span></p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                        <div key={index} className="bg-[#121418] p-6 rounded-2xl border border-white/5 hover:border-primary-gold/20 transition-all duration-300 group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Icon className="w-16 h-16 text-white" />
                            </div>
                            <div className="relative z-10">
                                <h3 className="text-gray-400 text-sm font-medium mb-2">{stat.title}</h3>
                                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                                <div className="flex items-center mt-2 gap-2">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${stat.isPositive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                        {stat.trend}
                                    </span>
                                    <span className="text-xs text-gray-500">vs yesterday</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-[#121418] rounded-2xl border border-white/5 overflow-hidden">
                    <div className="p-6 border-b border-white/5 flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white">Recent Activity</h2>
                        <span className="text-xs text-gray-400">Customer enriched feed</span>
                    </div>
                    <div className="divide-y divide-white/5">
                        {recentActivity.length > 0 ? recentActivity.map((activity) => (
                            <div key={activity.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${activity.type === 'Sale' ? 'bg-green-500/10 text-green-400' : activity.type === 'Repair' ? 'bg-orange-500/10 text-orange-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                        {activity.type === 'Sale'
                                            ? <SalesIcon className="w-5 h-5" />
                                            : activity.type === 'Repair'
                                                ? <RepairsIcon className="w-5 h-5" />
                                                : <InventoryIcon className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <p className="text-white font-medium">{activity.message}</p>
                                        <p className="text-xs text-gray-400">
                                            {activity.customer_name || 'Customer'}
                                            {activity.customer_phone ? ` • ${activity.customer_phone}` : ''}
                                        </p>
                                        <p className="text-xs text-gray-500">{formatDateTime(activity.timestamp)}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-sm font-bold text-gray-300">{activity.amount_label}</span>
                                    {activity.status ? <p className="text-xs text-gray-500 mt-1">{activity.status}</p> : null}
                                </div>
                            </div>
                        )) : (
                            <p className="p-4 text-gray-500 text-center">No recent activity for this branch.</p>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-[#121418] rounded-2xl border border-primary-gold/20 p-5">
                        <h2 className="text-lg font-bold text-white">Top Customer</h2>
                        {topCustomer ? (
                            <div className="mt-4 space-y-2">
                                <p className="text-primary-gold font-semibold text-lg">{topCustomer.name}</p>
                                <p className="text-sm text-gray-400">{topCustomer.phone || topCustomer.email || 'No contact'}</p>
                                <p className="text-sm text-gray-300">
                                    Spent: <span className="font-bold text-white">Tk {Number(topCustomer.total_spent || 0).toLocaleString()}</span>
                                </p>
                                <p className="text-xs text-gray-500">Last visit: {formatDate(topCustomer.last_visit)}</p>
                                <span className="inline-flex mt-1 text-xs px-2 py-1 rounded-full bg-primary-gold/10 text-primary-gold border border-primary-gold/30">
                                    {topCustomer.type || 'Regular'}
                                </span>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 mt-3">No customer data available.</p>
                        )}
                    </div>

                    <div className="bg-[#121418] rounded-2xl border border-white/5 p-5">
                        <h2 className="text-lg font-bold text-white">Top Trending Products</h2>
                        <div className="mt-4 space-y-3">
                            {topProducts.length > 0 ? topProducts.slice(0, 4).map((product, idx) => (
                                <div key={`${product.product_name}-${idx}`} className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2">
                                    <div>
                                        <p className="text-sm text-white font-medium">{product.product_name}</p>
                                        <p className="text-xs text-gray-500">Qty sold: {Number(product.total_quantity || 0).toLocaleString()}</p>
                                    </div>
                                    <p className="text-sm font-semibold text-primary-gold">Tk {Number(product.total_revenue || 0).toLocaleString()}</p>
                                </div>
                            )) : (
                                <p className="text-sm text-gray-500">No product trend data available.</p>
                            )}
                        </div>
                    </div>

                    <div className="bg-[#121418] rounded-2xl border border-white/5 p-5">
                        <h2 className="text-lg font-bold text-white">Store Pulse</h2>
                        <div className="grid grid-cols-2 gap-3 mt-4">
                            <div className="bg-white/5 rounded-xl p-3">
                                <p className="text-xs text-gray-400">Total Customers</p>
                                <p className="text-lg text-white font-bold">{customerMetrics.total_customers}</p>
                            </div>
                            <div className="bg-white/5 rounded-xl p-3">
                                <p className="text-xs text-gray-400">VIP Customers</p>
                                <p className="text-lg text-white font-bold">{customerMetrics.vip_customers}</p>
                            </div>
                            <div className="bg-white/5 rounded-xl p-3">
                                <p className="text-xs text-gray-400">Active (30d)</p>
                                <p className="text-lg text-white font-bold">{customerMetrics.active_customers_30d}</p>
                            </div>
                            <div className="bg-white/5 rounded-xl p-3">
                                <p className="text-xs text-gray-400">Low Stock Items</p>
                                <p className="text-lg text-white font-bold">{operations.low_stock_count}</p>
                            </div>
                            <div className="bg-white/5 rounded-xl p-3">
                                <p className="text-xs text-gray-400">Overdue Repairs</p>
                                <p className="text-lg text-white font-bold">{operations.overdue_repairs}</p>
                            </div>
                            <div className="bg-white/5 rounded-xl p-3">
                                <p className="text-xs text-gray-400">Due in 7 days</p>
                                <p className="text-lg text-white font-bold">{operations.due_manufacturing_7d}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardHome;
