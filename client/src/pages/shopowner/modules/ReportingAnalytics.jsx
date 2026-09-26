import { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertTriangle,
    BarChart3,
    CircleDollarSign,
    Package,
    ArrowUpRight,
    ArrowDownRight,
    TrendingUp,
    Calendar,
    Filter
} from 'lucide-react';

const currencyFormatter = new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    maximumFractionDigits: 0
});

const compactFormatter = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1
});

const formatCurrency = (value) => currencyFormatter.format(Number(value || 0));
const formatCompact = (value) => compactFormatter.format(Number(value || 0));

const monthLabel = (year, month) =>
    new Date(Number(year), Number(month) - 1, 1).toLocaleString('en-US', { month: 'short' });

const normalizeStoredValue = (value) => {
    if (value === null || value === undefined) return null;
    const normalized = String(value).trim();
    if (!normalized || normalized === 'null' || normalized === 'undefined') {
        return null;
    }
    return normalized;
};

const normalizeUserId = (value) => {
    const normalized = normalizeStoredValue(value);
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : null;
};

const toNumber = (value) => Number(value || 0);

const toYmd = (dateValue) => {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const buildEmptyReport = () => ({
    summary: {
        gross_revenue: 0,
        collected_revenue: 0,
        at_risk_revenue: 0,
        total_orders: 0,
        completed_orders: 0,
        pending_orders: 0,
        failed_orders: 0,
        average_order_value: 0
    },
    sales_trend: [],
    profit_loss: [],
    top_products: [],
    revenue_by_branch: [],
    generated_at: new Date().toISOString()
});

const getYtdDays = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    return Math.max(1, Math.floor((now - start) / 86400000) + 1);
};

const getRangeConfig = (key, customDays = 14) => {
    if (key === '30d') return { key, label: 'Last 30 Days', days: 30, months: 6 };
    if (key === 'ytd') {
        const days = getYtdDays();
        return { key, label: 'This Year', days, months: 12 };
    }
    if (key === 'custom') {
        const safeDays = Math.min(Math.max(Number(customDays) || 14, 7), 400);
        return {
            key,
            label: `Last ${safeDays} Days`,
            days: safeDays,
            months: Math.min(Math.max(Math.ceil(safeDays / 30), 3), 18)
        };
    }
    return { key: '14d', label: 'Last 14 Days', days: 14, months: 6 };
};

const formatDelta = (delta, suffix = '%') => {
    const value = Number.isFinite(delta) ? delta : 0;
    const sign = value > 0 ? '+' : value < 0 ? '' : '';
    return `${sign}${value.toFixed(1)}${suffix}`;
};

const pctChange = (current, previous) => {
    const cur = Number(current || 0);
    const prev = Number(previous || 0);
    if (prev === 0) return cur === 0 ? 0 : 100;
    return ((cur - prev) / Math.abs(prev)) * 100;
};

const clampDaysInput = (days) => Math.min(Math.max(Number(days) || 14, 7), 400);

const fetchJsonWithTimeout = async (url, timeoutMs = 8000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
            throw new Error(`Request failed (${response.status})`);
        }
        return response.json();
    } finally {
        clearTimeout(timeoutId);
    }
};

const buildFallbackReport = async ({ shopownerId, userId, days = 14, months = 6, topLimit = 6 }) => {
    const params = new URLSearchParams();
    if (shopownerId) {
        params.set('shopownerId', shopownerId);
    } else if (userId) {
        params.set('userId', userId);
    }

    const queryParam = params.toString();
    const activeBranch = normalizeStoredValue(localStorage.getItem('activeBranch')) || 'Main Branch';

    const branchesRes = await fetch(`/api/branches?${queryParam}`);
    if (!branchesRes.ok) {
        throw new Error('Failed to fetch branch data');
    }
    const branches = await branchesRes.json();
    const branchNames = [...new Set([
        ...branches.map((branch) => branch.name).filter(Boolean),
        activeBranch
    ])];

    const salesByBranch = await Promise.all(
        branchNames.map(async (branchName) => {
            const salesRes = await fetch(`/api/sales?branch=${encodeURIComponent(branchName)}&${queryParam}`);
            if (!salesRes.ok) return [];
            return salesRes.json();
        })
    );

    const allSalesRaw = salesByBranch
        .flatMap((sales, index) => sales.map((sale) => ({ ...sale, branch: sale.branch || branchNames[index] })))
        .filter((sale) => sale && sale.branch !== 'Subscription');

    const safeDays = clampDaysInput(days);
    const safeMonths = Math.min(Math.max(Number(months) || 6, 3), 18);
    const today = new Date();
    const periodStart = new Date(today);
    periodStart.setHours(0, 0, 0, 0);
    periodStart.setDate(periodStart.getDate() - (safeDays - 1));
    const periodEnd = new Date(today);
    periodEnd.setHours(23, 59, 59, 999);

    const isWithinPeriod = (saleDate) => {
        const d = new Date(saleDate);
        if (Number.isNaN(d.getTime())) return false;
        return d >= periodStart && d <= periodEnd;
    };

    const allSales = allSalesRaw.filter((sale) => isWithinPeriod(sale.sale_date));
    const completedSales = allSales.filter((sale) => sale.status === 'Completed');
    const pendingOrFailedSales = allSales.filter((sale) => sale.status === 'Pending' || sale.status === 'Failed');

    const grossRevenue = allSales.reduce((sum, sale) => sum + toNumber(sale.final_amount), 0);
    const collectedRevenue = completedSales.reduce((sum, sale) => sum + toNumber(sale.final_amount), 0);
    const atRiskRevenue = pendingOrFailedSales.reduce((sum, sale) => sum + toNumber(sale.final_amount), 0);

    const trendStart = new Date(today);
    trendStart.setDate(today.getDate() - (safeDays - 1));
    const trendMap = new Map();

    for (let i = 0; i < safeDays; i += 1) {
        const day = new Date(trendStart);
        day.setDate(trendStart.getDate() + i);
        trendMap.set(toYmd(day), { date: toYmd(day), revenue: 0, orders: 0 });
    }

    completedSales.forEach((sale) => {
        const key = toYmd(sale.sale_date);
        if (trendMap.has(key)) {
            const current = trendMap.get(key);
            current.revenue += toNumber(sale.final_amount);
            current.orders += 1;
            trendMap.set(key, current);
        }
    });

    const monthMap = new Map();
    const monthCursor = new Date(today.getFullYear(), today.getMonth(), 1);
    for (let i = 0; i < safeMonths; i += 1) {
        const year = monthCursor.getFullYear();
        const month = monthCursor.getMonth() + 1;
        monthMap.set(`${year}-${month}`, { year, month, profit: 0, loss: 0 });
        monthCursor.setMonth(monthCursor.getMonth() - 1);
    }

    allSales.forEach((sale) => {
        const date = new Date(sale.sale_date);
        if (Number.isNaN(date.getTime())) return;
        const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
        if (!monthMap.has(key)) return;

        const current = monthMap.get(key);
        if (sale.status === 'Completed') {
            current.profit += toNumber(sale.final_amount);
        } else if (sale.status === 'Pending' || sale.status === 'Failed') {
            current.loss += toNumber(sale.final_amount);
        }
        monthMap.set(key, current);
    });

    const branchRevenueMap = new Map();
    completedSales.forEach((sale) => {
        const key = sale.branch || 'Unknown';
        if (!branchRevenueMap.has(key)) {
            branchRevenueMap.set(key, { branch: key, revenue: 0, orders: 0 });
        }
        const current = branchRevenueMap.get(key);
        current.revenue += toNumber(sale.final_amount);
        current.orders += 1;
        branchRevenueMap.set(key, current);
    });

    const topSaleIds = completedSales
        .slice()
        .sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date))
        .slice(0, Math.min(20, Math.max(8, topLimit * 2)))
        .map((sale) => sale.id)
        .filter(Boolean);

    const saleDetails = await Promise.allSettled(
        topSaleIds.map(async (saleId) => {
            const detail = await fetchJsonWithTimeout(`/api/sales/${saleId}`, 2500);
            return detail?.items || [];
        })
    );

    const productMap = new Map();
    saleDetails
        .filter((result) => result.status === 'fulfilled')
        .flatMap((result) => result.value || [])
        .forEach((item) => {
        const name = item.product_name || 'Unnamed Product';
        if (!productMap.has(name)) {
            productMap.set(name, { name, quantity: 0, revenue: 0 });
        }
        const current = productMap.get(name);
        current.quantity += toNumber(item.quantity);
        current.revenue += toNumber(item.total_price);
        productMap.set(name, current);
        });

    const totalOrders = allSales.length;
    const completedOrders = completedSales.length;

    return {
        summary: {
            gross_revenue: grossRevenue,
            collected_revenue: collectedRevenue,
            at_risk_revenue: atRiskRevenue,
            total_orders: totalOrders,
            completed_orders: completedOrders,
            pending_orders: allSales.filter((sale) => sale.status === 'Pending').length,
            failed_orders: allSales.filter((sale) => sale.status === 'Failed').length,
            average_order_value: completedOrders > 0 ? collectedRevenue / completedOrders : 0
        },
        sales_trend: Array.from(trendMap.values()),
        profit_loss: Array.from(monthMap.values()).sort((a, b) =>
            new Date(a.year, a.month - 1, 1) - new Date(b.year, b.month - 1, 1)
        ),
        top_products: Array.from(productMap.values())
            .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
            .slice(0, topLimit),
        revenue_by_branch: Array.from(branchRevenueMap.values()).sort((a, b) => b.revenue - a.revenue),
        generated_at: new Date().toISOString()
    };
};

const Card = ({ children, className = "" }) => (
    <div className={`bg-[#1A1D24]/80 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-xl shadow-black/20 ${className}`}>
        {children}
    </div>
);

const SalesTrendChart = ({ data }) => {
    const [hoveredData, setHoveredData] = useState(null);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const chartRef = useRef(null);

    if (!data || data.length === 0) {
        return <p className="text-sm text-gray-500">No sales trend data found.</p>;
    }

    const width = 800;
    const height = 300;
    const pad = 40;
    const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);
    const stepX = data.length > 1 ? (width - pad * 2) / (data.length - 1) : 0;

    // Create smooth curve (Catmull-Rom like or simple cubic bezier)
    const points = data.map((d, i) => ({
        x: pad + i * stepX,
        y: height - pad - (d.revenue / maxRevenue) * (height - pad * 2),
        data: d
    }));

    const pathData = points.reduce((acc, point, i, arr) => {
        if (i === 0) return `M ${point.x},${point.y}`;
        const prev = arr[i - 1];
        // Simple smoothing: control points
        const cp1x = prev.x + (point.x - prev.x) / 3;
        const cp1y = prev.y;
        const cp2x = point.x - (point.x - prev.x) / 3;
        const cp2y = point.y;
        return `${acc} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${point.x},${point.y}`;
    }, "");

    // Close the area for gradient fill
    const areaPath = `${pathData} L ${points[points.length - 1].x},${height - pad} L ${points[0].x},${height - pad} Z`;

    const updateTooltipPosition = (event) => {
        if (!chartRef.current) return;
        const rect = chartRef.current.getBoundingClientRect();
        const tooltipWidth = 170;
        const x = Math.min(
            Math.max(event.clientX - rect.left + 10, 8),
            Math.max(rect.width - tooltipWidth, 8)
        );
        const y = Math.max(event.clientY - rect.top - 8, 60);
        setTooltipPosition({ x, y });
    };

    return (
        <div className="relative group">
            <div ref={chartRef} className="h-[300px] w-full">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                    <defs>
                        <linearGradient id="salesArea" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#D4A017" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#D4A017" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="lineGradient" x1="0" x2="1" y1="0" y2="0">
                            <stop offset="0%" stopColor="#D4A017" />
                            <stop offset="100%" stopColor="#FCD34D" />
                        </linearGradient>
                    </defs>

                    {/* Grid Lines */}
                    {[0, 1, 2, 3].map((line) => {
                        const y = pad + ((height - pad * 2) * line) / 3;
                        return (
                            <line
                                key={line}
                                x1={pad}
                                y1={y}
                                x2={width - pad}
                                y2={y}
                                stroke="rgba(255,255,255,0.05)"
                                strokeWidth="1"
                                strokeDasharray="4 4"
                            />
                        );
                    })}

                    {/* Area Fill */}
                    <path d={areaPath} fill="url(#salesArea)" />

                    {/* Main Line */}
                    <path
                        d={pathData}
                        fill="none"
                        stroke="url(#lineGradient)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="drop-shadow-[0_0_10px_rgba(212,160,23,0.3)]"
                    />

                    {/* Interactive Points */}
                    {points.map((p, i) => (
                        <g key={i}
                            onMouseEnter={(e) => {
                                setHoveredData(p.data);
                                updateTooltipPosition(e);
                            }}
                            onMouseMove={updateTooltipPosition}
                            onMouseLeave={() => setHoveredData(null)}
                        >
                            <circle
                                cx={p.x}
                                cy={p.y}
                                r="6"
                                fill="#121418"
                                stroke="#D4A017"
                                strokeWidth="2"
                                className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer hover:r-8 hover:stroke-white"
                            />
                            {/* Invisible touch area */}
                            <circle cx={p.x} cy={p.y} r="20" fill="transparent" className="cursor-pointer" />
                        </g>
                    ))}
                </svg>

                {/* Tooltip */}
                {hoveredData && (
                    <div
                        className="absolute bg-[#0F1115] border border-primary-gold/30 rounded-lg p-3 shadow-xl pointer-events-none transition-all duration-150 z-10"
                        style={{
                            left: `${tooltipPosition.x}px`,
                            top: `${tooltipPosition.y}px`,
                            transform: 'translate(0, -100%)'
                        }}
                    >
                        <p className="text-xs text-gray-400 mb-1">{new Date(hoveredData.date).toLocaleDateString()}</p>
                        <p className="text-sm font-bold text-white">{formatCurrency(hoveredData.revenue)}</p>
                        <p className="text-xs text-primary-gold">{hoveredData.orders} orders</p>
                    </div>
                )}
            </div>

            <div className="flex justify-between px-4 mt-2">
                {data
                    .filter((_, i) => i === 0 || i === data.length - 1 || i % Math.ceil(data.length / 5) === 0)
                    .map((d) => (
                        <div key={`label-${d.date}`} className="text-[11px] text-gray-500 font-medium">
                            {new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                    ))}
            </div>
        </div>
    );
};

const ProfitLossChart = ({ data }) => {
    if (!data || data.length === 0) {
        return <p className="text-sm text-gray-500">No profit/loss data found.</p>;
    }

    const allZero = data.every((d) => toNumber(d.profit) === 0 && toNumber(d.loss) === 0);
    const maxValue = Math.max(...data.flatMap((d) => [d.profit, d.loss]), 1);

    if (allZero) {
        return (
            <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                <p className="text-sm text-gray-400">No profit/loss movement in the selected period.</p>
                <div className="mt-4 grid grid-cols-6 gap-2">
                    {data.map((d) => (
                        <div key={`${d.year}-${d.month}`} className="text-center">
                            <div className="h-10 rounded-md bg-white/5 border border-white/5" />
                            <p className="mt-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                {monthLabel(d.year, d.month)}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-end gap-4 text-xs font-medium text-gray-400 mb-2">
                <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                    Profit
                </span>
                <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" />
                    Loss
                </span>
            </div>

            <div className="flex justify-between items-end h-52 px-2 gap-2">
                {data.map((d) => {
                    const profitHeight = (d.profit / maxValue) * 100;
                    const lossHeight = (d.loss / maxValue) * 100;
                    return (
                        <div key={`${d.year}-${d.month}`} className="flex flex-col items-center gap-2 group w-full">
                            <div className="relative w-full flex gap-1 justify-center items-end h-full">
                                {/* Profit Bar */}
                                <div
                                    className="w-full max-w-[16px] bg-gradient-to-t from-emerald-500/80 to-emerald-400 rounded-t-lg transition-all duration-500 group-hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                                    style={{ height: `${profitHeight}%` }}
                                >
                                    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-1 rounded text-[10px] text-white whitespace-nowrap z-10 border border-emerald-500/30">
                                        +{formatCompact(d.profit)}
                                    </div>
                                </div>
                                {/* Loss Bar */}
                                {d.loss > 0 && (
                                    <div
                                        className="w-full max-w-[16px] bg-gradient-to-t from-rose-500/80 to-rose-400 rounded-t-lg transition-all duration-500 group-hover:shadow-[0_0_15px_rgba(244,63,94,0.3)]"
                                        style={{ height: `${lossHeight}%` }}
                                    >
                                        <div className="opacity-0 group-hover:opacity-100 absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-1 rounded text-[10px] text-white whitespace-nowrap z-10 border border-rose-500/30">
                                            -{formatCompact(d.loss)}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{monthLabel(d.year, d.month)}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const TopProductsChart = ({ data }) => {
    if (!data || data.length === 0) {
        return <p className="text-sm text-gray-500">No top-selling products yet.</p>;
    }

    const maxQty = Math.max(...data.map((d) => d.quantity), 1);
    return (
        <div className="space-y-4">
            {data.map((item, i) => (
                <div key={item.name} className="group relative">
                    <div className="flex justify-between text-sm mb-1.5 relative z-10">
                        <span className="font-medium text-white group-hover:text-primary-gold transition-colors truncate pr-3 flex items-center gap-2">
                            <span className="text-[10px] text-gray-600 bg-white/5 w-5 h-5 flex items-center justify-center rounded-full">#{i + 1}</span>
                            {item.name}
                        </span>
                        <div className="text-right">
                            <span className="block text-white font-semibold">{formatCurrency(item.revenue)}</span>
                            <span className="text-[10px] text-gray-500">{item.quantity} units</span>
                        </div>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-primary-gold to-yellow-300 relative overflow-hidden"
                            style={{ width: `${(item.quantity / maxQty) * 100}%` }}
                        >
                            <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite] skew-x-12" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

const BranchRevenueChart = ({ data }) => {
    if (!data || data.length === 0) {
        return <p className="text-sm text-gray-500">No branch revenue data found.</p>;
    }

    const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);

    return (
        <div className="grid grid-cols-1 gap-3">
            {data.map((branch, i) => (
                <div key={branch.branch} className="relative overflow-hidden rounded-xl bg-gradient-to-r from-white/5 to-transparent p-4 border border-white/5 group hover:border-primary-gold/30 transition-all">
                    <div className="flex justify-between items-center relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary-gold/10 flex items-center justify-center text-primary-gold">
                                {i === 0 ? <TrendingUp size={16} /> : <div className="w-1.5 h-1.5 rounded-full bg-primary-gold" />}
                            </div>
                            <div>
                                <p className="text-sm font-medium text-white group-hover:text-primary-gold transition-colors">{branch.branch}</p>
                                <p className="text-xs text-gray-500">{branch.orders} Orders</p>
                            </div>
                        </div>
                        <p className="font-bold text-white">{formatCurrency(branch.revenue)}</p>
                    </div>
                    {/* Background Progress Bar */}
                    <div
                        className="absolute bottom-0 left-0 h-[2px] bg-primary-gold/50 transition-all duration-1000"
                        style={{ width: `${(branch.revenue / maxRevenue) * 100}%` }}
                    />
                </div>
            ))}
        </div>
    );
};

const ReportingAnalytics = () => {
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [rangeKey, setRangeKey] = useState('14d');
    const [customDays, setCustomDays] = useState(14);
    const [showAllProducts, setShowAllProducts] = useState(false);
    const [branchSortMode, setBranchSortMode] = useState('revenue');
    const [reloadToken, setReloadToken] = useState(0);
    const [deltaMetrics, setDeltaMetrics] = useState({
        collected: 0,
        atRisk: 0,
        orders: 0,
        gross: 0,
        netMargin: 0,
        netMarginDelta: 0
    });

    const activeRange = useMemo(() => getRangeConfig(rangeKey, customDays), [rangeKey, customDays]);

    useEffect(() => {
        let cancelled = false;

        const fetchAnalytics = async () => {
            const userId = normalizeUserId(localStorage.getItem('userId'));
            const shopownerId = normalizeStoredValue(localStorage.getItem('shopownerId'));

            if (!userId && !shopownerId) {
                setError('Shop owner context missing. Please sign in again.');
                setLoading(false);
                return;
            }

            if (!report) {
                setLoading(true);
            } else {
                setRefreshing(true);
            }

            const fetchFromEndpoint = async ({ offsetDays = 0, topLimit = 6, summaryOnly = false }) => {
                const params = new URLSearchParams();
                if (shopownerId) {
                    params.set('shopownerId', shopownerId);
                } else if (userId) {
                    params.set('userId', userId);
                }
                params.set('days', String(activeRange.days));
                params.set('months', String(activeRange.months));
                params.set('topLimit', String(topLimit));
                if (summaryOnly) {
                    params.set('summaryOnly', '1');
                }
                if (offsetDays > 0) {
                    params.set('offsetDays', String(offsetDays));
                }
                return fetchJsonWithTimeout(`/api/reports/analytics?${params.toString()}`, 9000);
            };

            const computeAndSetDelta = (currentSummary, previousSummary) => {
                const current = currentSummary || {};
                const previous = previousSummary || {};
                const currentGross = toNumber(current.gross_revenue);
                const previousGross = toNumber(previous.gross_revenue);

                const currentNetMargin = currentGross > 0
                    ? ((toNumber(current.collected_revenue) - toNumber(current.at_risk_revenue)) / currentGross) * 100
                    : 0;
                const previousNetMargin = previousGross > 0
                    ? ((toNumber(previous.collected_revenue) - toNumber(previous.at_risk_revenue)) / previousGross) * 100
                    : 0;

                setDeltaMetrics({
                    collected: pctChange(current.collected_revenue, previous.collected_revenue),
                    atRisk: pctChange(current.at_risk_revenue, previous.at_risk_revenue),
                    orders: pctChange(current.total_orders, previous.total_orders),
                    gross: pctChange(current.gross_revenue, previous.gross_revenue),
                    netMargin: currentNetMargin,
                    netMarginDelta: currentNetMargin - previousNetMargin
                });
            };

            try {
                const topLimit = showAllProducts ? 20 : 6;
                const [currentReport, previousReport] = await Promise.all([
                    fetchFromEndpoint({ topLimit }),
                    fetchFromEndpoint({ topLimit: 1, offsetDays: activeRange.days, summaryOnly: true })
                ]);

                if (!cancelled) {
                    const safeCurrentReport = currentReport || buildEmptyReport();
                    setReport(safeCurrentReport);
                    computeAndSetDelta(safeCurrentReport.summary, previousReport?.summary);
                    setError('');
                }
            } catch (fetchError) {
                try {
                    const fallbackData = await buildFallbackReport({
                        shopownerId,
                        userId,
                        days: activeRange.days,
                        months: activeRange.months,
                        topLimit: showAllProducts ? 20 : 6
                    });

                    if (!cancelled) {
                        const safeFallback = fallbackData || buildEmptyReport();
                        setReport(safeFallback);
                        computeAndSetDelta(safeFallback.summary, null);
                        setError('');
                    }
                } catch (fallbackError) {
                    console.error('Analytics fetch error:', fetchError);
                    console.error('Analytics fallback error:', fallbackError);
                    if (!cancelled) {
                        setError('Could not load analytics data right now.');
                    }
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                    setRefreshing(false);
                }
            }
        };

        fetchAnalytics();
        return () => {
            cancelled = true;
        };
    }, [activeRange.days, activeRange.months, showAllProducts, reloadToken]);

    const summaryCards = useMemo(() => {
        const summary = report?.summary || {};
        return [
            {
                title: 'Total Collections',
                value: formatCompact(summary.collected_revenue),
                fullValue: formatCurrency(summary.collected_revenue),
                subtext: 'Completed payments',
                change: formatDelta(deltaMetrics.collected),
                isPositive: deltaMetrics.collected >= 0,
                icon: CircleDollarSign,
                color: 'text-emerald-400',
                bg: 'bg-emerald-500/10',
                border: 'border-emerald-500/20'
            },
            {
                title: 'Unsettled / At Risk',
                value: formatCompact(summary.at_risk_revenue),
                fullValue: formatCurrency(summary.at_risk_revenue),
                subtext: 'Pending & Failed',
                change: formatDelta(deltaMetrics.atRisk),
                isPositive: deltaMetrics.atRisk <= 0,
                icon: AlertTriangle,
                color: 'text-rose-400',
                bg: 'bg-rose-500/10',
                border: 'border-rose-500/20'
            },
            {
                title: 'Order Volume',
                value: String(summary.total_orders || 0),
                fullValue: String(summary.total_orders || 0),
                subtext: 'Total orders recorded',
                change: formatDelta(deltaMetrics.orders),
                isPositive: deltaMetrics.orders >= 0,
                icon: Package,
                color: 'text-blue-400',
                bg: 'bg-blue-500/10',
                border: 'border-blue-500/20'
            },
            {
                title: 'Gross Revenue',
                value: formatCompact(summary.gross_revenue),
                fullValue: formatCurrency(summary.gross_revenue),
                subtext: 'All statuses included',
                change: formatDelta(deltaMetrics.gross),
                isPositive: deltaMetrics.gross >= 0,
                icon: BarChart3,
                color: 'text-primary-gold',
                bg: 'bg-primary-gold/10',
                border: 'border-primary-gold/20'
            }
        ];
    }, [report, deltaMetrics]);

    const sortedBranchData = useMemo(() => {
        const rows = [...(report?.revenue_by_branch || [])];
        rows.sort((a, b) => {
            if (branchSortMode === 'orders') {
                return toNumber(b.orders) - toNumber(a.orders);
            }
            return toNumber(b.revenue) - toNumber(a.revenue);
        });
        return rows;
    }, [report, branchSortMode]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[600px]">
                <div className="relative w-16 h-16">
                    <div className="absolute inset-0 border-4 border-white/10 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-primary-gold rounded-full border-t-transparent animate-spin"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-[500px]">
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-8 text-center max-w-md">
                    <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">Something went wrong</h3>
                    <p className="text-rose-300">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-6 px-6 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in pb-10">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-4xl font-bold text-white tracking-tight">Reporting <span className="text-primary-gold">&</span> Analytics</h1>
                    <p className="text-gray-400 mt-2 max-w-xl">
                        Gain insights into your business performance with real-time data on sales, profit/loss, and inventory movement.
                    </p>
                </div>
                <div className="flex items-center gap-3 bg-[#1A1D24] p-1.5 rounded-xl border border-white/5">
                    <button
                        onClick={() => setRangeKey('14d')}
                        className={`px-4 py-2 font-semibold rounded-lg text-sm transition-colors ${rangeKey === '14d'
                            ? 'bg-primary-gold text-black shadow-lg shadow-primary-gold/20'
                            : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        Last 14 Days
                    </button>
                    <button
                        onClick={() => setRangeKey('30d')}
                        className={`px-4 py-2 font-semibold rounded-lg text-sm transition-colors ${rangeKey === '30d'
                            ? 'bg-primary-gold text-black shadow-lg shadow-primary-gold/20'
                            : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        Last 30 Days
                    </button>
                    <button
                        onClick={() => setRangeKey('ytd')}
                        className={`hidden sm:block px-4 py-2 font-semibold rounded-lg text-sm transition-colors ${rangeKey === 'ytd'
                            ? 'bg-primary-gold text-black shadow-lg shadow-primary-gold/20'
                            : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        This Year
                    </button>
                    <div className="w-[1px] h-6 bg-white/10 mx-1"></div>
                    <button
                        className="p-2 text-gray-400 hover:text-white transition-colors"
                        title="Set custom day range"
                        onClick={() => {
                            const input = window.prompt('Enter day range (7 - 400):', String(activeRange.days));
                            if (input === null) return;
                            const days = clampDaysInput(input);
                            setCustomDays(days);
                            setRangeKey('custom');
                        }}
                    >
                        <Calendar size={18} />
                    </button>
                    <button
                        className={`p-2 transition-colors ${branchSortMode === 'orders' ? 'text-primary-gold' : 'text-gray-400 hover:text-white'}`}
                        title={`Sort branches by ${branchSortMode === 'revenue' ? 'orders' : 'revenue'}`}
                        onClick={() => setBranchSortMode((prev) => (prev === 'revenue' ? 'orders' : 'revenue'))}
                    >
                        <Filter size={18} />
                    </button>
                </div>
            </div>

            {/* Bento Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

                {/* KPI Cards */}
                {summaryCards.map((card, i) => {
                    const Icon = card.icon;
                    return (
                        <Card key={i} className="relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                            <div className="flex items-start justify-between mb-4 relative z-10">
                                <div className={`p-3 rounded-2xl ${card.bg} ${card.border} border`}>
                                    <Icon className={`w-6 h-6 ${card.color}`} />
                                </div>
                                <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${card.isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                    {card.isPositive ? <TrendingUp size={12} /> : <TrendingUp size={12} className="rotate-180" />}
                                    {card.change}
                                </div>
                            </div>
                            <div className="relative z-10">
                                <p className="text-sm font-medium text-gray-400 mb-1">{card.title}</p>
                                <h3 className="text-3xl font-bold text-white tracking-tight">{card.value}</h3>
                                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span>
                                    {card.subtext}
                                </p>
                            </div>
                        </Card>
                    );
                })}

                {/* Sales Trend Chart (Large Span) */}
                <Card className="md:col-span-2 xl:col-span-3 min-h-[400px]">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <BarChart3 className="text-primary-gold" size={20} />
                                Sales Trend
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">Revenue performance over {activeRange.label.toLowerCase()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/5">
                                <div className="w-2 h-2 rounded-full bg-primary-gold animate-pulse"></div>
                                <span className="text-xs text-primary-gold font-medium">
                                    {refreshing ? 'Refreshing...' : 'Live Data'}
                                </span>
                            </div>
                            <span className="hidden sm:block text-[11px] text-gray-500">
                                Updated: {report?.generated_at ? new Date(report.generated_at).toLocaleTimeString() : '-'}
                            </span>
                        </div>
                    </div>
                    <SalesTrendChart data={report?.sales_trend || []} />
                </Card>

                {/* Profit / Loss (Tall Vertical) */}
                <Card className="xl:col-span-1">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-white">Profit / Loss</h2>
                        <button
                            className="text-gray-500 hover:text-white"
                            title="Refresh current range"
                            onClick={() => {
                                setReloadToken((prev) => prev + 1);
                            }}
                        >
                            {deltaMetrics.netMarginDelta >= 0 ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                        </button>
                    </div>
                    <p className="text-sm text-gray-400 mb-6">{activeRange.months} months comparison</p>
                    <ProfitLossChart data={report?.profit_loss || []} />
                    <div className="mt-6 pt-6 border-t border-white/5">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-400">Net Margin</span>
                            <span className={`font-bold ${deltaMetrics.netMargin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {formatDelta(deltaMetrics.netMargin)}
                            </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                            Compared to previous period ({formatDelta(deltaMetrics.netMarginDelta)})
                        </p>
                    </div>
                </Card>

                {/* Top Products */}
                <Card className="md:col-span-2 xl:col-span-4">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-white">Top Performers</h2>
                        <button
                            className="text-xs text-primary-gold hover:underline"
                            onClick={() => setShowAllProducts((prev) => !prev)}
                        >
                            {showAllProducts ? 'Show Top 6' : 'View All'}
                        </button>
                    </div>
                    <TopProductsChart data={report?.top_products || []} />
                </Card>

                {/* Branch Revenue */}
                <Card className="md:col-span-2 xl:col-span-4">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-white">Branch Performance</h2>
                        <button
                            className="text-xs text-primary-gold hover:underline"
                            onClick={() => setBranchSortMode((prev) => (prev === 'revenue' ? 'orders' : 'revenue'))}
                        >
                            Sort by {branchSortMode === 'revenue' ? 'Orders' : 'Revenue'}
                        </button>
                    </div>
                    <BranchRevenueChart data={sortedBranchData} />
                </Card>

            </div>
        </div>
    );
};

export default ReportingAnalytics;
