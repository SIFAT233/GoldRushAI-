const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

let cachedForecast = null;
let cachedAt = 0;
let inFlightRequest = null;

const getApiBaseUrl = () => (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

const getTtlMs = () => {
    const configured = Number(import.meta.env.VITE_GOLD_FORECAST_TTL_MS);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TTL_MS;
};

const isCacheFresh = () => {
    if (!Array.isArray(cachedForecast) || cachedForecast.length === 0) return false;
    return Date.now() - cachedAt < getTtlMs();
};

const normalizeForecastPayload = (payload) => {
    if (!payload || typeof payload !== 'object') return [];

    const formattedData = Object.entries(payload).map(([date, price]) => ({
        date,
        price: parseFloat(Number(price).toFixed(2))
    }));

    formattedData.sort((a, b) => new Date(a.date) - new Date(b.date));
    return formattedData;
};

export const getCachedGoldForecast = () => cachedForecast;

export const fetchGoldForecast = async ({ force = false } = {}) => {
    if (!force && isCacheFresh()) {
        return cachedForecast;
    }

    if (!force && inFlightRequest) {
        return inFlightRequest;
    }

    const apiBaseUrl = getApiBaseUrl();
    const endpoint = `${apiBaseUrl}/api/gold-forecast`;

    inFlightRequest = fetch(endpoint)
        .then(async (response) => {
            if (!response.ok) {
                throw new Error('Failed to fetch predictions');
            }

            const payload = await response.json();
            const normalized = normalizeForecastPayload(payload);
            cachedForecast = normalized;
            cachedAt = Date.now();
            return normalized;
        })
        .finally(() => {
            inFlightRequest = null;
        });

    return inFlightRequest;
};

export const prefetchGoldForecast = () => fetchGoldForecast().catch(() => null);
