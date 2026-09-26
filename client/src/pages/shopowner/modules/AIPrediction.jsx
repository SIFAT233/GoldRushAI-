import { useState, useEffect } from 'react';
import { fetchGoldForecast, getCachedGoldForecast } from '../../../utils/goldForecastCache';

const KARAT_MULTIPLIER = {
    '22K Gold': 1,
    '21K Gold': 21 / 22,
    '18K Gold': 18 / 22
};

const AIPrediction = () => {
    const [predictions, setPredictions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currency, setCurrency] = useState('USD');
    const [selectedKarat, setSelectedKarat] = useState('22K Gold');

    useEffect(() => {
        const cached = getCachedGoldForecast();
        if (Array.isArray(cached) && cached.length > 0) {
            setPredictions(cached);
            setLoading(false);
        }

        const fetchPredictions = async () => {
            try {
                const data = await fetchGoldForecast();
                setPredictions(data);
                setError(null);
                setLoading(false);
            } catch (err) {
                console.error("Error fetching AI predictions:", err);
                if (!cached || cached.length === 0) {
                    setError("Failed to load prediction data.");
                }
                setLoading(false);
            }
        };

        fetchPredictions();
    }, []);

    const displayPredictions = predictions.slice(0, 7);
    const usdToBdtRate = Number(import.meta.env.VITE_USD_TO_BDT) || 110;
    const karatFactor = KARAT_MULTIPLIER[selectedKarat] || 1;
    const convertPrice = (value) => {
        const karatAdjusted = value * karatFactor;
        return currency === 'USD' ? karatAdjusted : karatAdjusted * usdToBdtRate;
    };
    const formatPrice = (value) => {
        const converted = convertPrice(value);
        const formatted = Number(converted).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        return currency === 'USD' ? `$ ${formatted}` : `BDT ${formatted}`;
    };

    // Calculate min and max for chart scaling
    const prices = displayPredictions.map(p => p.price);
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const maxPrice = prices.length ? Math.max(...prices) : 0;
    const priceRange = maxPrice - minPrice;

    // Get tomorrow's prediction (assuming the API returns future dates starting from tomorrow/today)
    const tomorrowsPrediction = displayPredictions.length > 0 ? displayPredictions[0] : null;

    // Calculate generic trend (compare first and last or just first two for immediate trend)
    const trendPercentage = displayPredictions.length >= 2
        ? (((displayPredictions[1].price - displayPredictions[0].price) / displayPredictions[0].price) * 100).toFixed(2)
        : "0.00";
    const isPositiveTrend = parseFloat(trendPercentage) >= 0;

    if (loading) return <div className="text-white text-center p-8">Loading AI Predictions...</div>;
    if (error) return <div className="text-red-400 text-center p-8">{error}</div>;

    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold text-white">AI Gold Price Prediction</h1>
                <p className="text-gray-400 mt-1">Market forecasting powered by Machine Learning.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Chart Area */}
                <div className="lg:col-span-2 bg-[#121418] rounded-2xl border border-white/5 p-6 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-white">Price Trend Forecast (Next 7 Days)</h2>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center bg-[#0B0D10] border border-white/10 rounded-lg p-1">
                                <button
                                    type="button"
                                    onClick={() => setCurrency('USD')}
                                    className={`px-3 py-1 text-xs rounded-md transition-colors ${currency === 'USD'
                                        ? 'bg-primary-gold text-black'
                                        : 'text-gray-300 hover:text-white'}`}
                                >
                                    USD
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCurrency('BDT')}
                                    className={`px-3 py-1 text-xs rounded-md transition-colors ${currency === 'BDT'
                                        ? 'bg-primary-gold text-black'
                                        : 'text-gray-300 hover:text-white'}`}
                                >
                                    BDT
                                </button>
                            </div>
                            <select
                                value={selectedKarat}
                                onChange={(e) => setSelectedKarat(e.target.value)}
                                className="bg-[#0B0D10] border border-white/10 rounded-lg px-3 py-1 text-sm text-white focus:outline-none"
                            >
                                <option>22K Gold</option>
                                <option>21K Gold</option>
                                <option>18K Gold</option>
                            </select>
                        </div>
                    </div>

                    {/* Dynamic Chart Visualization */}
                    <div className="flex-1 relative min-h-[300px] bg-gradient-to-b from-primary-gold/5 to-transparent rounded-xl border border-white/5 p-4 flex items-end justify-between gap-2">
                        {/* Grid Lines */}
                        <div className="absolute inset-0 flex flex-col justify-between p-4 pointer-events-none opacity-20">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="border-t border-white/20 w-full h-0"></div>
                            ))}
                        </div>

                        {/* Data Bars */}
                        {displayPredictions.map((item, i) => {
                            // visual height percentage: relative to the range, but keep a base height so it doesn't disappear
                            // (val - min) / (max - min) * 80 + 10  -> maps to 10% - 90% height
                            const heightPercent = priceRange === 0 ? 50 : ((item.price - minPrice) / priceRange) * 70 + 20;

                            return (
                                <div key={i} className="flex flex-col items-center gap-2 w-full h-full justify-end group relative">
                                    <div
                                        className="w-full max-w-[40px] bg-primary-gold/20 border-t-2 border-primary-gold rounded-t-sm transition-all duration-500 hover:bg-primary-gold/40 relative"
                                        style={{ height: `${heightPercent}%` }}
                                    >
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-black text-xs font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                            {formatPrice(item.price)}
                                        </div>
                                    </div>
                                    <span className="text-[10px] sm:text-xs text-primary-gold/80 font-semibold">
                                        {formatPrice(item.price)}
                                    </span>
                                    <span className="text-[10px] sm:text-xs text-gray-500 truncate w-full text-center">
                                        {new Date(item.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Prediction Stats & Insights */}
                <div className="space-y-6">
                    <div className="bg-gradient-to-br from-[#121418] to-primary-gold/10 p-6 rounded-2xl border border-primary-gold/30">
                        <h3 className="text-gray-400 text-sm mb-1">Tomorrow's Prediction</h3>
                        {tomorrowsPrediction && (
                            <>
                                <div className="flex items-end gap-2">
                                    <h2 className="text-4xl font-bold text-white">{formatPrice(tomorrowsPrediction.price)}</h2>
                                    <span className={`${isPositiveTrend ? 'text-green-400' : 'text-red-400'} font-bold mb-1 text-sm`}>
                                        {isPositiveTrend ? '▲' : '▼'} {trendPercentage}%
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    Predicted Range: {formatPrice(tomorrowsPrediction.price * 0.99)} - {formatPrice(tomorrowsPrediction.price * 1.01)}
                                </p>
                            </>
                        )}
                        <button className="w-full mt-6 bg-primary-gold text-black font-bold py-3 rounded-xl hover:bg-yellow-400 transition-colors shadow-lg shadow-primary-gold/20">
                            Adjust Shop Prices
                        </button>
                    </div>

                    <div className="bg-[#121418] p-6 rounded-2xl border border-white/5">
                        <h3 className="font-bold text-white mb-4">Market Insights</h3>
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5"></div>
                                <div>
                                    <p className="text-sm text-white font-medium">Global Inflation Impact</p>
                                    <p className="text-xs text-gray-500">Rising inflation rates in US market may push gold prices up.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5"></div>
                                <div>
                                    <p className="text-sm text-white font-medium">Wedding Season Demand</p>
                                    <p className="text-xs text-gray-500">Local demand expected to rise by 15% next week.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIPrediction;
