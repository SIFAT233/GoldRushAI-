const express = require('express');
const cors = require('cors');
const { sql, connectDB } = require('./db');
const SSLCommerzPayment = require('sslcommerz-lts');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { sendEmail } = require('./emailService');
const createDemoMiddleware = require('./demoMode');


const app = express();
const PORT = 5000;
const DEMO_MODE = process.env.DEMO_MODE !== 'false';

app.use(cors());
app.use(express.json({ limit: '80mb' }));
app.use(createDemoMiddleware({ enabled: DEMO_MODE }));
app.use('/api/gl', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

const GL_DB_SCHEMA = '[gold_lagbe_main].[dbo]';
const GL_SHOP_PROFILES_TABLE = `${GL_DB_SCHEMA}.[GL_ShopProfiles]`;
const GL_SHOP_PROFILES_OBJECT = 'gold_lagbe_main.dbo.GL_ShopProfiles';
const GL_ORDERS_TABLE = `${GL_DB_SCHEMA}.[GL_Orders]`;
const GL_ORDER_ITEMS_TABLE = `${GL_DB_SCHEMA}.[GL_OrderItems]`;
const GL_CART_TABLE = `${GL_DB_SCHEMA}.[GL_Cart]`;
const GL_REVIEWS_TABLE = `${GL_DB_SCHEMA}.[GL_Reviews]`;
const GL_CONVERSATIONS_TABLE = `${GL_DB_SCHEMA}.[GL_Conversations]`;
const GL_MESSAGES_TABLE = `${GL_DB_SCHEMA}.[GL_Messages]`;
const GL_COUPONS_TABLE = `${GL_DB_SCHEMA}.[GL_Coupons]`;
const GL_COUPONS_OBJECT = 'gold_lagbe_main.dbo.GL_Coupons';
const GL_COUPON_USAGE_TABLE = `${GL_DB_SCHEMA}.[GL_CouponUsage]`;
const GL_COUPON_USAGE_OBJECT = 'gold_lagbe_main.dbo.GL_CouponUsage';

const normalizeUrlValue = (value) => {
    if (!value) return null;
    const text = String(value).trim();
    if (!text || text === 'null' || text === 'undefined') return null;
    return text.replace(/\/+$/, '');
};

const normalizeTranId = (value) => {
    if (!value) return null;
    const text = String(value).trim();
    if (!text || text === 'null' || text === 'undefined') return null;
    return text;
};

const getApiBaseUrl = (req) => normalizeUrlValue(process.env.API_BASE_URL) || `${req.protocol}://${req.get('host')}`;
const getClientUrl = (req) =>
    normalizeUrlValue(process.env.CLIENT_URL) ||
    normalizeUrlValue(req.get('origin')) ||
    normalizeUrlValue(req.get('referer')) ||
    `${req.protocol}://${req.get('host')}`;

const getRedirectBase = (req) =>
    normalizeUrlValue(process.env.CLIENT_URL) ||
    normalizeUrlValue(req.query?.redirect) ||
    normalizeUrlValue(req.get('origin')) ||
    normalizeUrlValue(req.get('referer')) ||
    `${req.protocol}://${req.get('host')}`;

const buildRedirectUrl = (req, path) => {
    const base = getRedirectBase(req);
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${normalizedPath}`;
};

const getTranId = (req) =>
    normalizeTranId(req.params?.tran_id) ||
    normalizeTranId(req.body?.tran_id) ||
    normalizeTranId(req.query?.tran_id);

const REQUIRED_LEGAL_DOCUMENT_TYPES = Object.freeze([
    'nid',
    'trade_license',
    'etin_certificate',
    'vat_bin_registration',
    'gold_license',
    'bajus_membership',
    'irc'
]);

const MAX_SIGNUP_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

const normalizeDocumentType = (value) =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_');

const estimateBase64Bytes = (dataUrl) => {
    const payload = String(dataUrl || '').split(',')[1] || '';
    const normalized = payload.replace(/\s+/g, '');
    const paddingMatch = normalized.match(/=+$/);
    const padding = paddingMatch ? paddingMatch[0].length : 0;
    return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
};

const normalizeSignupDocuments = (rawDocuments) => {
    if (!Array.isArray(rawDocuments)) {
        return { documents: [], errors: ['Documents payload must be an array.'] };
    }

    const documents = [];
    const errors = [];

    for (const item of rawDocuments) {
        if (!item || typeof item !== 'object') continue;

        const normalizedType = normalizeDocumentType(item.document_type || item.documentType || item.type);
        const documentType = REQUIRED_LEGAL_DOCUMENT_TYPES.includes(normalizedType) ? normalizedType : 'unspecified';

        const fileData = String(item.file_data || item.fileData || item.data_url || item.dataUrl || '').trim();
        if (!fileData || !fileData.startsWith('data:')) {
            errors.push('Invalid file data found in uploaded documents.');
            continue;
        }

        const providedSize = Number(item.file_size_bytes ?? item.fileSizeBytes ?? item.size_bytes ?? item.size);
        const fileSizeBytes = Number.isFinite(providedSize) && providedSize > 0
            ? Math.floor(providedSize)
            : estimateBase64Bytes(fileData);

        if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
            errors.push('Invalid file size found in uploaded documents.');
            continue;
        }

        if (fileSizeBytes > MAX_SIGNUP_DOCUMENT_SIZE_BYTES) {
            errors.push('One or more files exceed 10MB.');
            continue;
        }

        const fileName = String(item.file_name || item.fileName || item.name || `${documentType}.file`).trim();
        const mimeType = String(item.mime_type || item.mimeType || item.type || '').trim();
        const documentLabel = String(item.document_label || item.documentLabel || item.label || '').trim();

        documents.push({
            documentType,
            documentLabel: documentLabel || null,
            fileName: fileName || `${documentType}.file`,
            mimeType: mimeType || null,
            fileSizeBytes,
            fileData
        });
    }

    return { documents, errors };
};

const ensureOwnerMainBranch = async (pool, { userId, shopownerId, shopName, fullName }) => {
    const parsedUserId = Number(userId);
    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) return;

    const resolvedShopownerId = String(shopownerId || '').trim() || null;
    const ownerWhere = resolvedShopownerId
        ? '(user_id = @user_id OR shopowner_id = @shopowner_id)'
        : '(user_id = @user_id)';

    const existingRequest = pool.request().input('user_id', sql.Int, parsedUserId);
    if (resolvedShopownerId) {
        existingRequest.input('shopowner_id', sql.NVarChar, resolvedShopownerId);
    }

    const existingBranch = await existingRequest.query(`
        SELECT TOP 1 id
        FROM branches
        WHERE ${ownerWhere}
        ORDER BY CASE WHEN ISNULL(is_main, 0) = 1 THEN 0 ELSE 1 END, created_at ASC, id ASC
    `);

    if (existingBranch.recordset.length > 0) {
        return;
    }

    const fallbackName = String(shopName || fullName || 'Shop').trim() || 'Shop';
    await pool.request()
        .input('name', sql.NVarChar, 'Main Branch')
        .input('location', sql.NVarChar, `${fallbackName} Location`)
        .input('branch_passcode', sql.NVarChar, '123456')
        .input('shopowner_id', sql.NVarChar, resolvedShopownerId)
        .input('user_id', sql.Int, parsedUserId)
        .query(`
            INSERT INTO branches (name, location, status, daily_sales, stock_value, branch_passcode, is_main, user_id, shopowner_id)
            VALUES (@name, @location, 'Active', 0, '0', @branch_passcode, 1, @user_id, @shopowner_id)
        `);
};

const applyStockDeduction = async (pool, items) => {
    for (const item of items) {
        const productId = item.product_id ?? item.id;
        const quantity = item.quantity ?? item.qty;
        if (!productId || !quantity) continue;

        await pool.request()
            .input('product_id', sql.Int, productId)
            .input('quantity', sql.Int, quantity)
            .query(`
                UPDATE products
                SET stock_quantity = CASE
                        WHEN stock_quantity - @quantity < 0 THEN 0
                        ELSE stock_quantity - @quantity
                    END,
                    status = CASE
                        WHEN stock_quantity - @quantity <= 0 THEN 'Out of Stock'
                        ELSE status
                    END
                WHERE id = @product_id
            `);
    }
};

const INVENTORY_LOW_STOCK_THRESHOLD = 3;

const normalizeInventoryQuantity = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.floor(parsed));
};

const deriveInventoryStatus = (stockQuantity) => {
    if (stockQuantity <= 0) return 'Out of Stock';
    if (stockQuantity <= INVENTORY_LOW_STOCK_THRESHOLD) return 'Low Stock';
    return 'In Stock';
};

let productMarketplaceSchemaReady = false;
let ensureProductMarketplaceLiveSchemaPromise = null;

const ensureProductMarketplaceLiveSchema = async (pool) => {
    if (productMarketplaceSchemaReady) return;
    if (!ensureProductMarketplaceLiveSchemaPromise) {
        ensureProductMarketplaceLiveSchemaPromise = pool.request().query(`
            IF OBJECT_ID('dbo.products', 'U') IS NOT NULL
            BEGIN
                IF COL_LENGTH('dbo.products', 'is_marketplace_live') IS NULL
                    ALTER TABLE dbo.products ADD is_marketplace_live BIT NULL;

                IF COL_LENGTH('dbo.products', 'is_marketplace_live') IS NOT NULL
                BEGIN
                    UPDATE dbo.products
                    SET is_marketplace_live = 1
                    WHERE is_marketplace_live IS NULL;

                    IF EXISTS (
                        SELECT 1
                        FROM sys.columns
                        WHERE object_id = OBJECT_ID('dbo.products')
                          AND name = 'is_marketplace_live'
                          AND is_nullable = 1
                    )
                    BEGIN
                        ALTER TABLE dbo.products ALTER COLUMN is_marketplace_live BIT NOT NULL;
                    END

                    BEGIN TRY
                        EXEC('ALTER TABLE dbo.products ADD DEFAULT (1) FOR is_marketplace_live;');
                    END TRY
                    BEGIN CATCH
                        IF ERROR_NUMBER() NOT IN (1781, 1750, 2714)
                            THROW;
                    END CATCH
                END
            END
        `).then(() => {
            productMarketplaceSchemaReady = true;
        }).catch((err) => {
            ensureProductMarketplaceLiveSchemaPromise = null;
            throw err;
        });
    }

    await ensureProductMarketplaceLiveSchemaPromise;
};

const syncInventoryStatusByScope = async (pool, { branch, shopownerId, resolvedUserId, allBranches = false }) => {
    const request = pool.request()
        .input('low_stock_threshold', sql.Int, INVENTORY_LOW_STOCK_THRESHOLD);

    let query = `
        UPDATE products
        SET status = CASE
            WHEN ISNULL(stock_quantity, 0) <= 0 THEN 'Out of Stock'
            WHEN ISNULL(stock_quantity, 0) <= @low_stock_threshold THEN 'Low Stock'
            ELSE 'In Stock'
        END
        WHERE 1 = 1
    `;

    if (!allBranches) {
        query += ' AND branch = @branch';
        request.input('branch', sql.NVarChar, branch || 'Main Branch');
    }

    if (shopownerId && resolvedUserId) {
        query += ' AND (shopowner_id = @shopownerId OR user_id = @resolvedUserId)';
        request.input('shopownerId', sql.NVarChar, shopownerId);
        request.input('resolvedUserId', sql.Int, resolvedUserId);
    } else if (shopownerId) {
        query += ' AND shopowner_id = @shopownerId';
        request.input('shopownerId', sql.NVarChar, shopownerId);
    } else if (resolvedUserId) {
        query += ' AND user_id = @resolvedUserId';
        request.input('resolvedUserId', sql.Int, resolvedUserId);
    }

    await request.query(query);
};

const normalizeBranchName = (value) => String(value || '').trim();

const branchNamesMatch = (left, right) =>
    normalizeBranchName(left).toLowerCase() === normalizeBranchName(right).toLowerCase();

const applyOwnerScopeClause = (request, scope, options = {}) => {
    const {
        shopownerField = 'shopowner_id',
        userField = 'user_id',
        shopownerParam = 'ownerShopownerId',
        userParam = 'ownerUserId'
    } = options;

    const { resolvedShopownerId, resolvedUserId } = scope || {};
    if (resolvedShopownerId && resolvedUserId) {
        request.input(shopownerParam, sql.NVarChar, resolvedShopownerId);
        request.input(userParam, sql.Int, resolvedUserId);
        return `(${shopownerField} = @${shopownerParam} OR ${userField} = @${userParam})`;
    }
    if (resolvedShopownerId) {
        request.input(shopownerParam, sql.NVarChar, resolvedShopownerId);
        return `${shopownerField} = @${shopownerParam}`;
    }
    if (resolvedUserId) {
        request.input(userParam, sql.Int, resolvedUserId);
        return `${userField} = @${userParam}`;
    }
    return '1 = 0';
};

const resolveOwnerScopeIds = async (pool, { shopownerId, userId }) => {
    let resolvedShopownerId = shopownerId ? String(shopownerId).trim() : null;
    let resolvedUserId = Number(userId);
    if (!Number.isFinite(resolvedUserId)) {
        resolvedUserId = null;
    }

    if (!resolvedUserId && resolvedShopownerId) {
        const userRes = await pool.request()
            .input('sid', sql.NVarChar, resolvedShopownerId)
            .query('SELECT id FROM shopowners WHERE shopowner_id = @sid');
        resolvedUserId = userRes.recordset.length > 0 ? Number(userRes.recordset[0].id) : null;
    }

    if (!resolvedShopownerId && resolvedUserId) {
        const ownerRes = await pool.request()
            .input('uid', sql.Int, resolvedUserId)
            .query('SELECT shopowner_id FROM shopowners WHERE id = @uid');
        resolvedShopownerId = ownerRes.recordset.length > 0 ? String(ownerRes.recordset[0].shopowner_id).trim() : null;
    }

    return { resolvedShopownerId, resolvedUserId };
};

const resolveBranchAccessContext = async (pool, { shopownerId, userId, activeBranch }) => {
    const ownerScope = await resolveOwnerScopeIds(pool, { shopownerId, userId });
    if (!ownerScope.resolvedShopownerId && !ownerScope.resolvedUserId) {
        return { error: 'Shop Owner ID is required', status: 400 };
    }

    const branchRequest = pool.request();
    const ownerClause = applyOwnerScopeClause(branchRequest, ownerScope);
    const branchResult = await branchRequest.query(`
        SELECT id, name, ISNULL(is_main, 0) AS is_main
        FROM branches
        WHERE ${ownerClause}
        ORDER BY CASE WHEN ISNULL(is_main, 0) = 1 THEN 0 ELSE 1 END, created_at ASC, id ASC
    `);

    const branches = branchResult.recordset || [];
    if (branches.length === 0) {
        return { error: 'No branches found for this owner', status: 404 };
    }

    const normalizedActive = normalizeBranchName(activeBranch);
    let actorBranch = normalizedActive
        ? branches.find((branch) => branchNamesMatch(branch.name, normalizedActive))
        : null;

    if (!actorBranch) {
        if (normalizedActive) {
            return { error: 'Invalid active branch for this owner', status: 403 };
        }
        actorBranch = branches.find((branch) => Number(branch.is_main || 0) === 1) || branches[0];
    }

    return {
        ...ownerScope,
        branches,
        actorBranch,
        isActorMain: Number(actorBranch?.is_main || 0) === 1
    };
};

const normalizeSlug = (value) =>
    String(value || 'shop')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-') || 'shop';

const clampMediaPercent = (value, fallback = 50) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(100, Math.max(0, parsed));
};

const clampMediaZoom = (value, fallback = 100) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(200, Math.max(50, parsed));
};

let glShopProfileSchemaReady = false;
let ensureGLShopProfileLiveSchemaPromise = null;

const ensureGLShopProfileLiveSchema = async (pool) => {
    if (glShopProfileSchemaReady) return;
    if (!ensureGLShopProfileLiveSchemaPromise) {
        ensureGLShopProfileLiveSchemaPromise = (async () => {
            await pool.request().query(`
                IF OBJECT_ID('${GL_SHOP_PROFILES_TABLE}', 'U') IS NOT NULL
                BEGIN
                    IF COL_LENGTH('${GL_SHOP_PROFILES_OBJECT}', 'logo_position_x') IS NULL
                        ALTER TABLE ${GL_SHOP_PROFILES_TABLE} ADD logo_position_x FLOAT NULL;

                    IF COL_LENGTH('${GL_SHOP_PROFILES_OBJECT}', 'logo_position_y') IS NULL
                        ALTER TABLE ${GL_SHOP_PROFILES_TABLE} ADD logo_position_y FLOAT NULL;

                    IF COL_LENGTH('${GL_SHOP_PROFILES_OBJECT}', 'logo_zoom') IS NULL
                        ALTER TABLE ${GL_SHOP_PROFILES_TABLE} ADD logo_zoom FLOAT NULL;

                    IF COL_LENGTH('${GL_SHOP_PROFILES_OBJECT}', 'banner_position_x') IS NULL
                        ALTER TABLE ${GL_SHOP_PROFILES_TABLE} ADD banner_position_x FLOAT NULL;

                    IF COL_LENGTH('${GL_SHOP_PROFILES_OBJECT}', 'banner_position_y') IS NULL
                        ALTER TABLE ${GL_SHOP_PROFILES_TABLE} ADD banner_position_y FLOAT NULL;

                    IF COL_LENGTH('${GL_SHOP_PROFILES_OBJECT}', 'banner_zoom') IS NULL
                        ALTER TABLE ${GL_SHOP_PROFILES_TABLE} ADD banner_zoom FLOAT NULL;

                    IF COL_LENGTH('${GL_SHOP_PROFILES_OBJECT}', 'is_marketplace_live') IS NULL
                        ALTER TABLE ${GL_SHOP_PROFILES_TABLE} ADD is_marketplace_live BIT NULL;
                END
            `);

            await pool.request().query(`
                IF OBJECT_ID('${GL_SHOP_PROFILES_TABLE}', 'U') IS NOT NULL
                   AND COL_LENGTH('${GL_SHOP_PROFILES_OBJECT}', 'is_marketplace_live') IS NOT NULL
                BEGIN
                    UPDATE ${GL_SHOP_PROFILES_TABLE}
                    SET is_marketplace_live = ISNULL(is_marketplace_live, 1),
                        logo_position_x = ISNULL(logo_position_x, 50),
                        logo_position_y = ISNULL(logo_position_y, 50),
                        logo_zoom = ISNULL(logo_zoom, 100),
                        banner_position_x = ISNULL(banner_position_x, 50),
                        banner_position_y = ISNULL(banner_position_y, 50),
                        banner_zoom = ISNULL(banner_zoom, 100)
                    WHERE is_marketplace_live IS NULL
                       OR logo_position_x IS NULL
                       OR logo_position_y IS NULL
                       OR logo_zoom IS NULL
                       OR banner_position_x IS NULL
                       OR banner_position_y IS NULL
                       OR banner_zoom IS NULL;
                END
            `);

            await pool.request().query(`
                IF OBJECT_ID('${GL_SHOP_PROFILES_TABLE}', 'U') IS NOT NULL
                   AND EXISTS (
                        SELECT 1
                        FROM sys.columns
                        WHERE object_id = OBJECT_ID('${GL_SHOP_PROFILES_OBJECT}')
                          AND name = 'is_marketplace_live'
                          AND is_nullable = 1
                    )
                BEGIN
                    ALTER TABLE ${GL_SHOP_PROFILES_TABLE} ALTER COLUMN is_marketplace_live BIT NOT NULL;
                END
            `);

            await pool.request().query(`
                IF OBJECT_ID('${GL_SHOP_PROFILES_TABLE}', 'U') IS NOT NULL
                   AND COL_LENGTH('${GL_SHOP_PROFILES_OBJECT}', 'is_marketplace_live') IS NOT NULL
                BEGIN
                    BEGIN TRY
                        EXEC('ALTER TABLE ${GL_SHOP_PROFILES_TABLE} ADD DEFAULT (1) FOR is_marketplace_live;');
                    END TRY
                    BEGIN CATCH
                        IF ERROR_NUMBER() NOT IN (1781, 1750, 2714)
                            THROW;
                    END CATCH
                END
            `);

            glShopProfileSchemaReady = true;
        })().catch((err) => {
            ensureGLShopProfileLiveSchemaPromise = null;
            throw err;
        });
    }

    await ensureGLShopProfileLiveSchemaPromise;
};

const resolveGlShopownerUserId = async (pool, { shopownerId, userId }) => {
    const parsedUserId = Number(userId);
    if (Number.isFinite(parsedUserId) && parsedUserId > 0) {
        return parsedUserId;
    }

    if (!shopownerId) return null;
    const ownerRes = await pool.request()
        .input('shopowner_id', sql.NVarChar, shopownerId)
        .query('SELECT TOP 1 id FROM shopowners WHERE shopowner_id = @shopowner_id');

    return ownerRes.recordset.length > 0 ? ownerRes.recordset[0].id : null;
};

const ensureGLShopProfile = async (pool, shopownerUserId) => {
    await ensureGLShopProfileLiveSchema(pool);

    let profileRes = await pool.request()
        .input('shopowner_user_id', sql.Int, shopownerUserId)
        .query(`
            SELECT TOP 1 *
            FROM ${GL_SHOP_PROFILES_TABLE}
            WHERE shopowner_id = @shopowner_user_id
            ORDER BY id DESC
        `);

    if (profileRes.recordset.length > 0) {
        return profileRes.recordset[0];
    }

    const ownerRes = await pool.request()
        .input('shopowner_user_id', sql.Int, shopownerUserId)
        .query('SELECT TOP 1 shop_name, full_name FROM shopowners WHERE id = @shopowner_user_id');

    if (ownerRes.recordset.length === 0) return null;
    const owner = ownerRes.recordset[0];
    const baseSlug = normalizeSlug(owner.shop_name || owner.full_name || 'shop');
    const shopSlug = `${baseSlug}-${shopownerUserId}`;
    const logoSeed = (owner.shop_name?.[0] || owner.full_name?.[0] || 'S').toUpperCase();

    await pool.request()
        .input('shopowner_user_id', sql.Int, shopownerUserId)
        .input('shop_slug', sql.NVarChar, shopSlug)
        .input('logo_url', sql.NVarChar, `https://placehold.co/200x200?text=${logoSeed}`)
        .input('banner_url', sql.NVarChar, 'https://placehold.co/1200x300?text=Shop+Banner')
        .query(`
            BEGIN TRY
                INSERT INTO ${GL_SHOP_PROFILES_TABLE} (shopowner_id, shop_slug, logo_url, banner_url, rating, is_verified, is_marketplace_live)
                VALUES (@shopowner_user_id, @shop_slug, @logo_url, @banner_url, 5.0, 1, 1)
            END TRY
            BEGIN CATCH
                IF ERROR_NUMBER() NOT IN (2601, 2627)
                    THROW;
            END CATCH
        `);

    profileRes = await pool.request()
        .input('shopowner_user_id', sql.Int, shopownerUserId)
        .query(`
            SELECT TOP 1 *
            FROM ${GL_SHOP_PROFILES_TABLE}
            WHERE shopowner_id = @shopowner_user_id
            ORDER BY id DESC
        `);

    return profileRes.recordset[0] || null;
};

const normalizeCouponCode = (value) =>
    String(value || '')
        .toUpperCase()
        .trim()
        .replace(/\s+/g, '')
        .replace(/[^A-Z0-9_-]/g, '');

const normalizeCouponDiscountType = (value) => {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized === 'PERCENTAGE' || normalized === 'PERCENT' || normalized === 'RATE') {
        return 'PERCENTAGE';
    }
    if (normalized === 'FIXED' || normalized === 'FLAT' || normalized === 'AMOUNT') {
        return 'FIXED';
    }
    return null;
};

const mapGLCouponRecord = (record) => ({
    id: Number(record.id),
    shopowner_user_id: Number(record.shopowner_user_id),
    shopowner_id: record.shopowner_id || null,
    code: String(record.code || '').toUpperCase(),
    title: record.title || '',
    description: record.description || '',
    discount_type: String(record.discount_type || 'PERCENTAGE').toUpperCase(),
    discount_value: Number(record.discount_value || 0),
    minimum_order_amount: record.minimum_order_amount === null || record.minimum_order_amount === undefined
        ? null
        : Number(record.minimum_order_amount),
    maximum_discount_amount: record.maximum_discount_amount === null || record.maximum_discount_amount === undefined
        ? null
        : Number(record.maximum_discount_amount),
    starts_at: record.starts_at || null,
    expires_at: record.expires_at || null,
    usage_limit: record.usage_limit === null || record.usage_limit === undefined
        ? null
        : Number(record.usage_limit),
    used_count: Number(record.usage_count ?? record.used_count ?? 0),
    usage_count: Number(record.usage_count ?? record.used_count ?? 0),
    last_redeemed_at: record.last_redeemed_at || null,
    is_active: Boolean(record.is_active),
    created_at: record.created_at || null,
    updated_at: record.updated_at || null
});

const mapGLCouponUsageRecord = (record) => ({
    id: Number(record.id),
    coupon_id: Number(record.coupon_id),
    shopowner_user_id: Number(record.shopowner_user_id),
    shopowner_id: record.shopowner_id || null,
    customer_user_id: record.customer_user_id === null || record.customer_user_id === undefined
        ? null
        : Number(record.customer_user_id),
    customer_name: record.customer_name || '',
    customer_contact: record.customer_contact || '',
    order_reference: record.order_reference || '',
    order_amount: record.order_amount === null || record.order_amount === undefined
        ? null
        : Number(record.order_amount),
    discount_amount: record.discount_amount === null || record.discount_amount === undefined
        ? null
        : Number(record.discount_amount),
    final_amount: record.final_amount === null || record.final_amount === undefined
        ? null
        : Number(record.final_amount),
    currency: record.currency || 'BDT',
    metadata: record.metadata || null,
    redeemed_at: record.redeemed_at || null,
    created_at: record.created_at || null
});

let glCouponsSchemaReady = false;
let ensureGLCouponsSchemaPromise = null;

const ensureGLCouponsSchema = async (pool) => {
    if (glCouponsSchemaReady) return;
    if (!ensureGLCouponsSchemaPromise) {
        ensureGLCouponsSchemaPromise = (async () => {
            await pool.request().query(`
                IF OBJECT_ID('${GL_COUPONS_TABLE}', 'U') IS NULL
                BEGIN
                    CREATE TABLE ${GL_COUPONS_TABLE} (
                        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                        shopowner_user_id INT NOT NULL,
                        shopowner_id NVARCHAR(255) NULL,
                        code NVARCHAR(64) NOT NULL,
                        title NVARCHAR(120) NULL,
                        description NVARCHAR(500) NULL,
                        discount_type NVARCHAR(20) NOT NULL,
                        discount_value DECIMAL(18,2) NOT NULL,
                        minimum_order_amount DECIMAL(18,2) NULL,
                        maximum_discount_amount DECIMAL(18,2) NULL,
                        starts_at DATETIME2 NULL,
                        expires_at DATETIME2 NULL,
                        usage_limit INT NULL,
                        used_count INT NOT NULL CONSTRAINT DF_GL_Coupons_used_count DEFAULT (0),
                        is_active BIT NOT NULL CONSTRAINT DF_GL_Coupons_is_active DEFAULT (1),
                        created_at DATETIME2 NOT NULL CONSTRAINT DF_GL_Coupons_created_at DEFAULT (GETDATE()),
                        updated_at DATETIME2 NOT NULL CONSTRAINT DF_GL_Coupons_updated_at DEFAULT (GETDATE())
                    );
                END
            `);

            await pool.request().query(`
                IF OBJECT_ID('${GL_COUPONS_TABLE}', 'U') IS NOT NULL
                BEGIN
                    IF COL_LENGTH('${GL_COUPONS_OBJECT}', 'title') IS NULL
                        ALTER TABLE ${GL_COUPONS_TABLE} ADD title NVARCHAR(120) NULL;

                    IF COL_LENGTH('${GL_COUPONS_OBJECT}', 'description') IS NULL
                        ALTER TABLE ${GL_COUPONS_TABLE} ADD description NVARCHAR(500) NULL;

                    IF COL_LENGTH('${GL_COUPONS_OBJECT}', 'minimum_order_amount') IS NULL
                        ALTER TABLE ${GL_COUPONS_TABLE} ADD minimum_order_amount DECIMAL(18,2) NULL;

                    IF COL_LENGTH('${GL_COUPONS_OBJECT}', 'maximum_discount_amount') IS NULL
                        ALTER TABLE ${GL_COUPONS_TABLE} ADD maximum_discount_amount DECIMAL(18,2) NULL;

                    IF COL_LENGTH('${GL_COUPONS_OBJECT}', 'starts_at') IS NULL
                        ALTER TABLE ${GL_COUPONS_TABLE} ADD starts_at DATETIME2 NULL;

                    IF COL_LENGTH('${GL_COUPONS_OBJECT}', 'usage_limit') IS NULL
                        ALTER TABLE ${GL_COUPONS_TABLE} ADD usage_limit INT NULL;

                    IF COL_LENGTH('${GL_COUPONS_OBJECT}', 'used_count') IS NULL
                        ALTER TABLE ${GL_COUPONS_TABLE} ADD used_count INT NULL;

                    IF COL_LENGTH('${GL_COUPONS_OBJECT}', 'is_active') IS NULL
                        ALTER TABLE ${GL_COUPONS_TABLE} ADD is_active BIT NULL;

                    IF COL_LENGTH('${GL_COUPONS_OBJECT}', 'created_at') IS NULL
                        ALTER TABLE ${GL_COUPONS_TABLE} ADD created_at DATETIME2 NULL;

                    IF COL_LENGTH('${GL_COUPONS_OBJECT}', 'updated_at') IS NULL
                        ALTER TABLE ${GL_COUPONS_TABLE} ADD updated_at DATETIME2 NULL;

                    UPDATE ${GL_COUPONS_TABLE}
                    SET code = CASE
                            WHEN code IS NULL THEN NULL
                            ELSE UPPER(LTRIM(RTRIM(code)))
                        END,
                        discount_type = UPPER(LTRIM(RTRIM(ISNULL(discount_type, 'PERCENTAGE')))),
                        used_count = ISNULL(used_count, 0),
                        is_active = ISNULL(is_active, 1),
                        created_at = ISNULL(created_at, GETDATE()),
                        updated_at = ISNULL(updated_at, ISNULL(created_at, GETDATE()))
                    WHERE code IS NULL
                       OR code <> UPPER(LTRIM(RTRIM(ISNULL(code, ''))))
                       OR discount_type IS NULL
                       OR used_count IS NULL
                       OR is_active IS NULL
                       OR created_at IS NULL
                       OR updated_at IS NULL;
                END
            `);

            await pool.request().query(`
                IF OBJECT_ID('${GL_COUPONS_TABLE}', 'U') IS NOT NULL
                BEGIN
                    BEGIN TRY
                        CREATE UNIQUE INDEX UX_GL_Coupons_Owner_Code
                        ON ${GL_COUPONS_TABLE} (shopowner_user_id, code)
                        WHERE code IS NOT NULL;
                    END TRY
                    BEGIN CATCH
                        IF ERROR_NUMBER() NOT IN (1913, 2714)
                            THROW;
                    END CATCH
                END
            `);

            await pool.request().query(`
                IF OBJECT_ID('${GL_COUPONS_TABLE}', 'U') IS NOT NULL
                BEGIN
                    BEGIN TRY
                        CREATE INDEX IX_GL_Coupons_Validity
                        ON ${GL_COUPONS_TABLE} (shopowner_user_id, is_active, starts_at, expires_at, created_at DESC);
                    END TRY
                    BEGIN CATCH
                        IF ERROR_NUMBER() NOT IN (1913, 2714)
                            THROW;
                    END CATCH
                END
            `);

            glCouponsSchemaReady = true;
        })().catch((err) => {
            ensureGLCouponsSchemaPromise = null;
            throw err;
        });
    }

    await ensureGLCouponsSchemaPromise;
};

let glCouponUsageSchemaReady = false;
let ensureGLCouponUsageSchemaPromise = null;

const ensureGLCouponUsageSchema = async (pool) => {
    if (glCouponUsageSchemaReady) return;
    if (!ensureGLCouponUsageSchemaPromise) {
        ensureGLCouponUsageSchemaPromise = (async () => {
            await pool.request().query(`
                IF OBJECT_ID('${GL_COUPON_USAGE_TABLE}', 'U') IS NULL
                BEGIN
                    CREATE TABLE ${GL_COUPON_USAGE_TABLE} (
                        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                        coupon_id INT NOT NULL,
                        shopowner_user_id INT NOT NULL,
                        shopowner_id NVARCHAR(255) NULL,
                        customer_user_id INT NULL,
                        customer_name NVARCHAR(120) NULL,
                        customer_contact NVARCHAR(255) NULL,
                        order_reference NVARCHAR(120) NULL,
                        order_amount DECIMAL(18,2) NULL,
                        discount_amount DECIMAL(18,2) NULL,
                        final_amount DECIMAL(18,2) NULL,
                        currency NVARCHAR(16) NULL,
                        metadata NVARCHAR(MAX) NULL,
                        redeemed_at DATETIME2 NOT NULL CONSTRAINT DF_GL_CouponUsage_redeemed_at DEFAULT (GETDATE()),
                        created_at DATETIME2 NOT NULL CONSTRAINT DF_GL_CouponUsage_created_at DEFAULT (GETDATE())
                    );
                END
            `);

            await pool.request().query(`
                IF OBJECT_ID('${GL_COUPON_USAGE_TABLE}', 'U') IS NOT NULL
                BEGIN
                    IF COL_LENGTH('${GL_COUPON_USAGE_OBJECT}', 'customer_user_id') IS NULL
                        ALTER TABLE ${GL_COUPON_USAGE_TABLE} ADD customer_user_id INT NULL;

                    IF COL_LENGTH('${GL_COUPON_USAGE_OBJECT}', 'customer_name') IS NULL
                        ALTER TABLE ${GL_COUPON_USAGE_TABLE} ADD customer_name NVARCHAR(120) NULL;

                    IF COL_LENGTH('${GL_COUPON_USAGE_OBJECT}', 'customer_contact') IS NULL
                        ALTER TABLE ${GL_COUPON_USAGE_TABLE} ADD customer_contact NVARCHAR(255) NULL;

                    IF COL_LENGTH('${GL_COUPON_USAGE_OBJECT}', 'order_reference') IS NULL
                        ALTER TABLE ${GL_COUPON_USAGE_TABLE} ADD order_reference NVARCHAR(120) NULL;

                    IF COL_LENGTH('${GL_COUPON_USAGE_OBJECT}', 'order_amount') IS NULL
                        ALTER TABLE ${GL_COUPON_USAGE_TABLE} ADD order_amount DECIMAL(18,2) NULL;

                    IF COL_LENGTH('${GL_COUPON_USAGE_OBJECT}', 'discount_amount') IS NULL
                        ALTER TABLE ${GL_COUPON_USAGE_TABLE} ADD discount_amount DECIMAL(18,2) NULL;

                    IF COL_LENGTH('${GL_COUPON_USAGE_OBJECT}', 'final_amount') IS NULL
                        ALTER TABLE ${GL_COUPON_USAGE_TABLE} ADD final_amount DECIMAL(18,2) NULL;

                    IF COL_LENGTH('${GL_COUPON_USAGE_OBJECT}', 'currency') IS NULL
                        ALTER TABLE ${GL_COUPON_USAGE_TABLE} ADD currency NVARCHAR(16) NULL;

                    IF COL_LENGTH('${GL_COUPON_USAGE_OBJECT}', 'metadata') IS NULL
                        ALTER TABLE ${GL_COUPON_USAGE_TABLE} ADD metadata NVARCHAR(MAX) NULL;

                    IF COL_LENGTH('${GL_COUPON_USAGE_OBJECT}', 'created_at') IS NULL
                        ALTER TABLE ${GL_COUPON_USAGE_TABLE} ADD created_at DATETIME2 NULL;

                    UPDATE ${GL_COUPON_USAGE_TABLE}
                    SET redeemed_at = ISNULL(redeemed_at, GETDATE()),
                        created_at = ISNULL(created_at, ISNULL(redeemed_at, GETDATE()))
                    WHERE redeemed_at IS NULL
                       OR created_at IS NULL;
                END
            `);

            await pool.request().query(`
                IF OBJECT_ID('${GL_COUPON_USAGE_TABLE}', 'U') IS NOT NULL
                BEGIN
                    BEGIN TRY
                        CREATE INDEX IX_GL_CouponUsage_CouponDate
                        ON ${GL_COUPON_USAGE_TABLE} (coupon_id, redeemed_at DESC, id DESC);
                    END TRY
                    BEGIN CATCH
                        IF ERROR_NUMBER() NOT IN (1913, 2714)
                            THROW;
                    END CATCH
                END
            `);

            await pool.request().query(`
                IF OBJECT_ID('${GL_COUPON_USAGE_TABLE}', 'U') IS NOT NULL
                BEGIN
                    BEGIN TRY
                        CREATE INDEX IX_GL_CouponUsage_ShopOwnerDate
                        ON ${GL_COUPON_USAGE_TABLE} (shopowner_user_id, redeemed_at DESC, id DESC);
                    END TRY
                    BEGIN CATCH
                        IF ERROR_NUMBER() NOT IN (1913, 2714)
                            THROW;
                    END CATCH
                END
            `);

            await pool.request().query(`
                IF OBJECT_ID('${GL_COUPON_USAGE_TABLE}', 'U') IS NOT NULL
                BEGIN
                    BEGIN TRY
                        CREATE UNIQUE INDEX UX_GL_CouponUsage_CouponOrderRef
                        ON ${GL_COUPON_USAGE_TABLE} (coupon_id, order_reference)
                        WHERE order_reference IS NOT NULL;
                    END TRY
                    BEGIN CATCH
                        IF ERROR_NUMBER() NOT IN (1913, 2714)
                            THROW;
                    END CATCH
                END
            `);

            glCouponUsageSchemaReady = true;
        })().catch((err) => {
            ensureGLCouponUsageSchemaPromise = null;
            throw err;
        });
    }

    await ensureGLCouponUsageSchemaPromise;
};

const escapeHtml = (value) =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const formatDateForEmail = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

const buildManufacturingEmailTemplate = ({
    shopName,
    headline,
    subline,
    customerName,
    statusLabel,
    orderId,
    productName,
    goldWeight,
    dueDate,
    primaryNote,
    supportPhone
}) => {
    const detailRows = [
        { label: 'Order ID', value: orderId || 'N/A' },
        { label: 'Item', value: productName || 'N/A' },
        { label: 'Gold Weight', value: `${goldWeight || 0} g` },
        { label: 'Due Date', value: dueDate || 'N/A' },
        { label: 'Status', value: statusLabel || 'N/A' }
    ];

    const rowsHtml = detailRows
        .map(
            (row) => `
                <tr>
                    <td style="padding:10px 12px; border-bottom:1px solid #eef2f7; color:#6b7280; font-size:13px; width:38%;">
                        ${escapeHtml(row.label)}
                    </td>
                    <td style="padding:10px 12px; border-bottom:1px solid #eef2f7; color:#111827; font-size:14px; font-weight:600;">
                        ${escapeHtml(row.value)}
                    </td>
                </tr>
            `
        )
        .join('');

    return `
        <div style="margin:0; padding:24px 12px; background:#f3f5f8;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:620px; margin:0 auto; border-collapse:separate;">
                <tr>
                    <td style="padding:0;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%; background:#111827; border-radius:14px 14px 0 0;">
                            <tr>
                                <td style="padding:20px 24px; border-bottom:3px solid #d4af37;">
                                    <p style="margin:0; color:#d4af37; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; font-family:Arial, sans-serif;">
                                        ${escapeHtml(shopName)}
                                    </p>
                                    <h2 style="margin:8px 0 6px; color:#ffffff; font-size:24px; line-height:1.2; font-family:Arial, sans-serif;">
                                        ${escapeHtml(headline)}
                                    </h2>
                                    <p style="margin:0; color:#d1d5db; font-size:14px; font-family:Arial, sans-serif;">
                                        ${escapeHtml(subline)}
                                    </p>
                                </td>
                            </tr>
                        </table>

                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%; background:#ffffff; border:1px solid #e5e7eb; border-top:none; border-radius:0 0 14px 14px;">
                            <tr>
                                <td style="padding:24px; font-family:Arial, sans-serif; color:#111827;">
                                    <p style="margin:0 0 12px; font-size:15px;">Hello ${escapeHtml(customerName)},</p>

                                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%; border:1px solid #eef2f7; border-radius:10px; overflow:hidden; margin:0 0 14px;">
                                        ${rowsHtml}
                                    </table>

                                    <p style="margin:0 0 10px; font-size:14px; color:#374151; line-height:1.6;">
                                        ${escapeHtml(primaryNote)}
                                    </p>

                                    ${supportPhone
            ? `<p style="margin:0 0 10px; font-size:14px; color:#374151; line-height:1.6;">For collection/delivery details, contact us: <strong>${escapeHtml(supportPhone)}</strong></p>`
            : ''}

                                    <p style="margin:14px 0 0; font-size:14px; color:#111827;">
                                        Thank you,<br />
                                        <strong>${escapeHtml(shopName)}</strong>
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </div>
    `;
};

const resolveManufacturingCustomerContact = async (pool, { customerId, customerEmail, customerName, branch, shopownerId }) => {
    if (customerEmail && String(customerEmail).trim()) {
        return { id: customerId || null, name: customerName || null, email: String(customerEmail).trim(), phone: null };
    }

    if (customerId) {
        const byIdResult = await pool.request()
            .input('customer_id', sql.Int, Number(customerId))
            .input('shopowner_id', sql.NVarChar, shopownerId || null)
            .query(`
                SELECT TOP 1 id, name, email, phone
                FROM customers
                WHERE id = @customer_id
                  AND (@shopowner_id IS NULL OR shopowner_id = @shopowner_id)
            `);
        if (byIdResult.recordset.length > 0) return byIdResult.recordset[0];
    }

    const normalizedName = String(customerName || '').trim();
    if (!normalizedName) return null;

    const primaryQuery = `
        SELECT TOP 1 id, name, email, phone
        FROM customers
        WHERE LTRIM(RTRIM(name)) = LTRIM(RTRIM(@customer_name))
          AND branch = @branch
          AND (@shopowner_id IS NULL OR shopowner_id = @shopowner_id)
        ORDER BY id DESC
    `;

    const primaryResult = await pool.request()
        .input('customer_name', sql.NVarChar, normalizedName)
        .input('branch', sql.NVarChar, branch || 'Main Branch')
        .input('shopowner_id', sql.NVarChar, shopownerId || null)
        .query(primaryQuery);

    if (primaryResult.recordset.length > 0) return primaryResult.recordset[0];

    const fallbackQuery = `
        SELECT TOP 1 id, name, email, phone
        FROM customers
        WHERE LTRIM(RTRIM(name)) = LTRIM(RTRIM(@customer_name))
          AND (@shopowner_id IS NULL OR shopowner_id = @shopowner_id)
        ORDER BY id DESC
    `;

    const fallbackResult = await pool.request()
        .input('customer_name', sql.NVarChar, normalizedName)
        .input('shopowner_id', sql.NVarChar, shopownerId || null)
        .query(fallbackQuery);

    return fallbackResult.recordset[0] || null;
};

const resolveShopownerProfile = async (pool, shopownerId) => {
    if (!shopownerId) return null;
    const result = await pool.request()
        .input('shopowner_id', sql.NVarChar, shopownerId)
        .query(`
            SELECT TOP 1 full_name, shop_name, phone
            FROM shopowners
            WHERE shopowner_id = @shopowner_id
        `);
    return result.recordset[0] || null;
};

const resolveRepairCustomerContact = async (pool, { customerId, customerEmail, customerName, customerPhone, branch, shopownerId }) => {
    if (customerEmail && String(customerEmail).trim()) {
        return {
            id: customerId || null,
            name: customerName || '',
            email: String(customerEmail).trim(),
            phone: customerPhone || null
        };
    }

    if (customerId) {
        const byIdResult = await pool.request()
            .input('customer_id', sql.Int, Number(customerId))
            .input('shopowner_id', sql.NVarChar, shopownerId || null)
            .query(`
                SELECT TOP 1 id, name, email, phone
                FROM customers
                WHERE id = @customer_id
                  AND (@shopowner_id IS NULL OR shopowner_id = @shopowner_id)
            `);
        if (byIdResult.recordset.length > 0) return byIdResult.recordset[0];
    }

    if (customerPhone) {
        const byPhoneResult = await pool.request()
            .input('customer_phone', sql.NVarChar, String(customerPhone).trim())
            .input('branch', sql.NVarChar, branch || 'Main Branch')
            .input('shopowner_id', sql.NVarChar, shopownerId || null)
            .query(`
                SELECT TOP 1 id, name, email, phone
                FROM customers
                WHERE phone = @customer_phone
                  AND branch = @branch
                  AND (@shopowner_id IS NULL OR shopowner_id = @shopowner_id)
                ORDER BY id DESC
            `);
        if (byPhoneResult.recordset.length > 0) return byPhoneResult.recordset[0];
    }

    if (customerName) {
        const byNameResult = await pool.request()
            .input('customer_name', sql.NVarChar, String(customerName).trim())
            .input('shopowner_id', sql.NVarChar, shopownerId || null)
            .query(`
                SELECT TOP 1 id, name, email, phone
                FROM customers
                WHERE LTRIM(RTRIM(name)) = LTRIM(RTRIM(@customer_name))
                  AND (@shopowner_id IS NULL OR shopowner_id = @shopowner_id)
                ORDER BY id DESC
            `);
        if (byNameResult.recordset.length > 0) return byNameResult.recordset[0];
    }

    return null;
};

const buildRepairStatusEmailTemplate = ({
    shopName,
    headline,
    subline,
    customerName,
    ticketId,
    itemName,
    issueDescription,
    estimatedCost,
    receivedDate,
    dueDate,
    statusLabel,
    supportPhone
}) => `
    <div style="margin:0; padding:24px 12px; background:#f3f5f8;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:620px; margin:0 auto; border-collapse:separate;">
            <tr>
                <td style="padding:0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%; background:#111827; border-radius:14px 14px 0 0;">
                        <tr>
                            <td style="padding:20px 24px; border-bottom:3px solid #d4af37;">
                                <p style="margin:0; color:#d4af37; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; font-family:Arial, sans-serif;">
                                    ${escapeHtml(shopName)}
                                </p>
                                <h2 style="margin:8px 0 6px; color:#ffffff; font-size:24px; line-height:1.2; font-family:Arial, sans-serif;">
                                    ${escapeHtml(headline)}
                                </h2>
                                <p style="margin:0; color:#d1d5db; font-size:14px; font-family:Arial, sans-serif;">
                                    ${escapeHtml(subline)}
                                </p>
                            </td>
                        </tr>
                    </table>

                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%; background:#ffffff; border:1px solid #e5e7eb; border-top:none; border-radius:0 0 14px 14px;">
                        <tr>
                            <td style="padding:24px; font-family:Arial, sans-serif; color:#111827;">
                                <p style="margin:0 0 12px; font-size:15px;">Hello ${escapeHtml(customerName)},</p>

                                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%; border:1px solid #eef2f7; border-radius:10px; overflow:hidden; margin:0 0 14px;">
                                    <tr><td style="padding:10px 12px; border-bottom:1px solid #eef2f7; color:#6b7280; font-size:13px; width:38%;">Ticket ID</td><td style="padding:10px 12px; border-bottom:1px solid #eef2f7; color:#111827; font-size:14px; font-weight:600;">${escapeHtml(ticketId)}</td></tr>
                                    <tr><td style="padding:10px 12px; border-bottom:1px solid #eef2f7; color:#6b7280; font-size:13px;">Item</td><td style="padding:10px 12px; border-bottom:1px solid #eef2f7; color:#111827; font-size:14px; font-weight:600;">${escapeHtml(itemName)}</td></tr>
                                    <tr><td style="padding:10px 12px; border-bottom:1px solid #eef2f7; color:#6b7280; font-size:13px;">Issue</td><td style="padding:10px 12px; border-bottom:1px solid #eef2f7; color:#111827; font-size:14px; font-weight:600;">${escapeHtml(issueDescription || 'N/A')}</td></tr>
                                    <tr><td style="padding:10px 12px; border-bottom:1px solid #eef2f7; color:#6b7280; font-size:13px;">Estimated Cost</td><td style="padding:10px 12px; border-bottom:1px solid #eef2f7; color:#111827; font-size:14px; font-weight:600;">${escapeHtml(`BDT ${Number(estimatedCost || 0).toLocaleString()}`)}</td></tr>
                                    <tr><td style="padding:10px 12px; border-bottom:1px solid #eef2f7; color:#6b7280; font-size:13px;">Received Date</td><td style="padding:10px 12px; border-bottom:1px solid #eef2f7; color:#111827; font-size:14px; font-weight:600;">${escapeHtml(receivedDate)}</td></tr>
                                    <tr><td style="padding:10px 12px; border-bottom:1px solid #eef2f7; color:#6b7280; font-size:13px;">Delivery Date</td><td style="padding:10px 12px; border-bottom:1px solid #eef2f7; color:#111827; font-size:14px; font-weight:600;">${escapeHtml(dueDate)}</td></tr>
                                    <tr><td style="padding:10px 12px; color:#6b7280; font-size:13px;">Status</td><td style="padding:10px 12px; color:#111827; font-size:14px; font-weight:700;">${escapeHtml(statusLabel)}</td></tr>
                                </table>

                                ${supportPhone ? `<p style="margin:0 0 10px; font-size:14px; color:#374151; line-height:1.6;">Need help? Contact us: <strong>${escapeHtml(supportPhone)}</strong></p>` : ''}

                                <p style="margin:14px 0 0; font-size:14px; color:#111827;">
                                    Thank you,<br />
                                    <strong>${escapeHtml(shopName)}</strong>
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </div>
`;

const sendRepairStatusEmail = async (pool, ticket, status) => {
    if (!['Active', 'Completed'].includes(status)) return false;

    const customer = await resolveRepairCustomerContact(pool, {
        customerId: ticket.customer_id,
        customerEmail: ticket.customer_email,
        customerName: ticket.customer_name,
        customerPhone: ticket.customer_phone,
        branch: ticket.branch,
        shopownerId: ticket.shopowner_id
    });

    if (!customer?.email) return false;

    const shopowner = await resolveShopownerProfile(pool, ticket.shopowner_id);
    const shopName = shopowner?.shop_name || 'Gold Rush';
    const shopPhone = shopowner?.phone || '';

    const isCompleted = status === 'Completed';
    const subject = isCompleted
        ? `Repair Completed: ${ticket.ticket_id}`
        : `Repair Ticket Active: ${ticket.ticket_id}`;

    const html = buildRepairStatusEmailTemplate({
        shopName,
        headline: isCompleted ? 'Your Repair Is Completed' : 'Your Repair Ticket Is Active',
        subline: isCompleted
            ? 'Great news. Your item has been repaired successfully.'
            : 'We have received your repair request and started processing it.',
        customerName: ticket.customer_name || customer.name || 'Customer',
        ticketId: ticket.ticket_id || 'N/A',
        itemName: ticket.item_name || 'N/A',
        issueDescription: ticket.issue_description || 'N/A',
        estimatedCost: ticket.estimated_cost || 0,
        receivedDate: formatDateForEmail(ticket.received_date || ticket.created_at),
        dueDate: formatDateForEmail(ticket.delivery_date),
        statusLabel: status,
        supportPhone: shopPhone
    });

    await sendEmail(customer.email, subject, html, shopName);
    return true;
};

const triggerRepairStatusEmailAsync = (pool, ticket, status) => {
    Promise.resolve()
        .then(async () => {
            const sent = await sendRepairStatusEmail(pool, ticket, status);
            if (!sent) {
                console.warn(`Repair ${status} email skipped: missing customer email for ticket ${ticket?.ticket_id || ticket?.id}`);
            }
        })
        .catch((mailErr) => {
            console.error(`Repair ${status} email failed for ticket ${ticket?.ticket_id || ticket?.id}:`, mailErr?.message || mailErr);
        });
};

const formatCampaignMessageToHtml = (message) => {
    const source = String(message || '');
    const hasCustomHtml = /<(?!br\s*\/?)[a-z][^>]*>/i.test(source) || /<\/[a-z][^>]*>/i.test(source);

    if (hasCustomHtml) {
        return source;
    }

    const lines = source
        .replace(/<br\s*\/?>/gi, '\n')
        .split('\n')
        .map((line) => line.trim());

    const blocks = [];
    let paragraphLines = [];
    let listItems = [];

    const flushParagraph = () => {
        if (paragraphLines.length === 0) return;
        blocks.push(
            `<p style="margin:0 0 14px; font-size:15px; line-height:1.75; color:#1f2937;">${escapeHtml(paragraphLines.join(' '))}</p>`
        );
        paragraphLines = [];
    };

    const flushList = () => {
        if (listItems.length === 0) return;
        blocks.push(
            `<ul style="margin:0 0 14px 18px; padding:0; color:#1f2937; font-size:15px; line-height:1.75;">${listItems
                .map((item) => `<li style="margin:0 0 6px;">${escapeHtml(item)}</li>`)
                .join('')}</ul>`
        );
        listItems = [];
    };

    for (const line of lines) {
        if (!line) {
            flushParagraph();
            flushList();
            continue;
        }

        if (/^[-*•]\s+/.test(line)) {
            flushParagraph();
            listItems.push(line.replace(/^[-*•]\s+/, ''));
            continue;
        }

        flushList();
        paragraphLines.push(line);
    }

    flushParagraph();
    flushList();

    if (blocks.length === 0) {
        return `<p style="margin:0; font-size:15px; line-height:1.75; color:#1f2937;">Thank you for staying with us.</p>`;
    }

    return blocks.join('');
};

const buildCrmCampaignEmailTemplate = ({
    shopName,
    subject,
    messageHtml,
    shopPhone
}) => {
    const campaignDate = formatDateForEmail(new Date());
    return `
        <div style="margin:0; padding:24px 12px; background:#f4f6fa;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:640px; margin:0 auto; border-collapse:separate;">
                <tr>
                    <td style="padding:0;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%; background:#111827; border-radius:14px 14px 0 0;">
                            <tr>
                                <td style="padding:22px 24px; border-bottom:3px solid #d4af37;">
                                    <p style="margin:0; color:#d4af37; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; font-family:Arial, sans-serif;">
                                        ${escapeHtml(shopName)}
                                    </p>
                                    <h2 style="margin:8px 0 6px; color:#ffffff; font-size:24px; line-height:1.25; font-family:Arial, sans-serif;">
                                        ${escapeHtml(subject)}
                                    </h2>
                                    <p style="margin:0; color:#d1d5db; font-size:14px; font-family:Arial, sans-serif;">
                                        A special update crafted for you.
                                    </p>
                                </td>
                            </tr>
                        </table>

                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%; background:#ffffff; border:1px solid #e5e7eb; border-top:none; border-radius:0 0 14px 14px;">
                            <tr>
                                <td style="padding:24px; font-family:Arial, sans-serif;">
                                    ${messageHtml}

                                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%; margin-top:10px; border-collapse:separate; background:#f9fafb; border:1px solid #eef2f7; border-radius:10px;">
                                        <tr>
                                            <td style="padding:12px 14px; color:#4b5563; font-size:13px;">
                                                <strong style="color:#111827;">Campaign Date:</strong> ${escapeHtml(campaignDate)}
                                            </td>
                                        </tr>
                                        ${shopPhone ? `<tr><td style="padding:0 14px 12px; color:#4b5563; font-size:13px;"><strong style="color:#111827;">Contact:</strong> ${escapeHtml(shopPhone)}</td></tr>` : ''}
                                    </table>

                                    <p style="margin:16px 0 0; font-size:14px; color:#111827;">
                                        Regards,<br />
                                        <strong>${escapeHtml(shopName)}</strong>
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </div>
    `;
};

const sendManufacturingCreatedEmail = async (pool, order) => {
    const customer = await resolveManufacturingCustomerContact(pool, {
        customerId: order.customer_id,
        customerEmail: order.customer_email,
        customerName: order.customer_name,
        branch: order.branch,
        shopownerId: order.shopowner_id
    });
    if (!customer?.email) return false;

    const shopowner = await resolveShopownerProfile(pool, order.shopowner_id);
    const shopName = shopowner?.shop_name || 'Gold Rush';

    const subject = `Order Confirmed: ${order.order_id}`;
    const html = buildManufacturingEmailTemplate({
        shopName,
        headline: 'Your Manufacturing Order Is Confirmed',
        subline: 'We have received your order and production has started.',
        customerName: order.customer_name,
        statusLabel: order.status || 'New Orders',
        orderId: order.order_id,
        productName: order.product_name,
        goldWeight: order.gold_weight || 0,
        dueDate: formatDateForEmail(order.due_date),
        primaryNote: 'We will notify you again as soon as your order is ready for delivery.',
        supportPhone: shopowner?.phone || ''
    });

    await sendEmail(customer.email, subject, html, shopName);
    return true;
};

const sendManufacturingReadyEmail = async (pool, order) => {
    const customer = await resolveManufacturingCustomerContact(pool, {
        customerId: order.customer_id,
        customerEmail: order.customer_email,
        customerName: order.customer_name,
        branch: order.branch,
        shopownerId: order.shopowner_id
    });
    if (!customer?.email) return false;

    const shopowner = await resolveShopownerProfile(pool, order.shopowner_id);
    const shopName = shopowner?.shop_name || 'Gold Rush';
    const shopPhone = shopowner?.phone || '';

    const subject = `Ready for Delivery: ${order.order_id}`;
    const html = buildManufacturingEmailTemplate({
        shopName,
        headline: 'Your Order Is Ready for Delivery',
        subline: 'Good news. Your item is now ready for handover.',
        customerName: order.customer_name,
        statusLabel: 'Ready for Delivery',
        orderId: order.order_id,
        productName: order.product_name,
        goldWeight: order.gold_weight || 0,
        dueDate: formatDateForEmail(order.due_date),
        primaryNote: `Your order from ${shopName} is now ready for delivery.`,
        supportPhone: shopPhone
    });

    await sendEmail(customer.email, subject, html, shopName);
    return true;
};

// Connect to Database
// Connect to Database
// ... (imports remain same)

// Connect to Database
if (!DEMO_MODE) {
connectDB().then(async () => {
    try {
        const pool = await sql.connect();

        // 1. Schema Initialization (Tables + Branch Column)
        const tables = [
            'products', 'sales', 'manufacturing_orders', 'repair_tickets',
            'customers', 'shopowners', 'installments', 'branches'
        ];

        for (const table of tables) {
            // Skip 'shopowners' table for generic columns as it has its own schema definition
            if (table === 'shopowners') continue;

            // Check if 'branch' column exists, if not add it
            const checkColumnQuery = `
                IF COL_LENGTH('${table}', 'branch') IS NULL
                ALTER TABLE ${table} ADD branch NVARCHAR(255) DEFAULT 'Main Branch';

                IF COL_LENGTH('${table}', 'user_id') IS NULL
                ALTER TABLE ${table} ADD user_id INT NULL;
            `;
            await pool.request().query(checkColumnQuery);


        }

        // Ensure users table has image_url for chat UI
        try {
            await pool.request().query(`
                IF COL_LENGTH('users', 'image_url') IS NULL
                ALTER TABLE users ADD image_url NVARCHAR(MAX) NULL;
            `);
        } catch (schemaErr) {
            console.error("Error verifying users.image_url schema:", schemaErr);
        }

        // Ensure chat typing columns exist for real-time typing indicator support.
        try {
            await pool.request().query(`
                IF EXISTS (
                    SELECT 1
                    FROM [gold_lagbe_main].INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'GL_Conversations'
                )
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM [gold_lagbe_main].INFORMATION_SCHEMA.COLUMNS
                        WHERE TABLE_SCHEMA = 'dbo'
                          AND TABLE_NAME = 'GL_Conversations'
                          AND COLUMN_NAME = 'shopowner_typing_at'
                    )
                        ALTER TABLE [gold_lagbe_main].[dbo].[GL_Conversations] ADD shopowner_typing_at DATETIME NULL;

                    IF NOT EXISTS (
                        SELECT 1
                        FROM [gold_lagbe_main].INFORMATION_SCHEMA.COLUMNS
                        WHERE TABLE_SCHEMA = 'dbo'
                          AND TABLE_NAME = 'GL_Conversations'
                          AND COLUMN_NAME = 'user_typing_at'
                    )
                        ALTER TABLE [gold_lagbe_main].[dbo].[GL_Conversations] ADD user_typing_at DATETIME NULL;
                END
            `);
        } catch (schemaErr) {
            console.error("Error verifying GL_Conversations typing columns:", schemaErr);
        }



        // 1.1 Specific Schema Updates for Shop Owners
        const userSchemaUpdate = `
            IF COL_LENGTH('shopowners', 'shopowner_id') IS NULL
            ALTER TABLE shopowners ADD shopowner_id NVARCHAR(50) NULL;

            IF COL_LENGTH('shopowners', 'subscription_plan') IS NULL
            ALTER TABLE shopowners ADD subscription_plan NVARCHAR(50) DEFAULT 'free';

            IF COL_LENGTH('shopowners', 'subscription_status') IS NULL
            ALTER TABLE shopowners ADD subscription_status NVARCHAR(50) DEFAULT 'active';

            IF COL_LENGTH('shopowners', 'subscription_end_date') IS NULL
            ALTER TABLE shopowners ADD subscription_end_date DATETIME NULL;

            IF COL_LENGTH('shopowners', 'account_approval_status') IS NULL
            ALTER TABLE shopowners ADD account_approval_status NVARCHAR(50) DEFAULT 'approved';

            IF COL_LENGTH('shopowners', 'approval_requested_at') IS NULL
            ALTER TABLE shopowners ADD approval_requested_at DATETIME NULL;

            IF COL_LENGTH('shopowners', 'approval_reviewed_at') IS NULL
            ALTER TABLE shopowners ADD approval_reviewed_at DATETIME NULL;

            IF COL_LENGTH('shopowners', 'approval_note') IS NULL
            ALTER TABLE shopowners ADD approval_note NVARCHAR(500) NULL;
        `;
        await pool.request().query(userSchemaUpdate);
        await pool.request().query(`
            UPDATE shopowners
            SET account_approval_status = 'approved'
            WHERE account_approval_status IS NULL
               OR LTRIM(RTRIM(account_approval_status)) = '';
        `);

        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='shopowner_documents' AND xtype='U')
            CREATE TABLE shopowner_documents (
                id INT IDENTITY(1,1) PRIMARY KEY,
                shopowner_user_id INT NOT NULL,
                shopowner_id NVARCHAR(50) NULL,
                document_type NVARCHAR(100) NOT NULL,
                document_label NVARCHAR(255) NULL,
                file_name NVARCHAR(255) NOT NULL,
                mime_type NVARCHAR(120) NULL,
                file_size_bytes BIGINT NULL,
                file_data NVARCHAR(MAX) NOT NULL,
                uploaded_at DATETIME DEFAULT GETDATE()
            );

            IF COL_LENGTH('shopowner_documents', 'shopowner_user_id') IS NULL
            ALTER TABLE shopowner_documents ADD shopowner_user_id INT NULL;

            IF COL_LENGTH('shopowner_documents', 'shopowner_id') IS NULL
            ALTER TABLE shopowner_documents ADD shopowner_id NVARCHAR(50) NULL;

            IF COL_LENGTH('shopowner_documents', 'document_type') IS NULL
            ALTER TABLE shopowner_documents ADD document_type NVARCHAR(100) NULL;

            IF COL_LENGTH('shopowner_documents', 'document_label') IS NULL
            ALTER TABLE shopowner_documents ADD document_label NVARCHAR(255) NULL;

            IF COL_LENGTH('shopowner_documents', 'file_name') IS NULL
            ALTER TABLE shopowner_documents ADD file_name NVARCHAR(255) NULL;

            IF COL_LENGTH('shopowner_documents', 'mime_type') IS NULL
            ALTER TABLE shopowner_documents ADD mime_type NVARCHAR(120) NULL;

            IF COL_LENGTH('shopowner_documents', 'file_size_bytes') IS NULL
            ALTER TABLE shopowner_documents ADD file_size_bytes BIGINT NULL;

            IF COL_LENGTH('shopowner_documents', 'file_data') IS NULL
            ALTER TABLE shopowner_documents ADD file_data NVARCHAR(MAX) NULL;

            IF COL_LENGTH('shopowner_documents', 'uploaded_at') IS NULL
            ALTER TABLE shopowner_documents ADD uploaded_at DATETIME DEFAULT GETDATE();

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_shopowner_documents_owner' AND object_id = OBJECT_ID('shopowner_documents'))
                CREATE INDEX IX_shopowner_documents_owner ON shopowner_documents (shopowner_user_id, uploaded_at DESC);
        `);

        // 1.2 Backfill shopowner_id for existing shopowners
        await pool.request().query(`
            UPDATE shopowners 
            SET shopowner_id = 'SP-' + RIGHT('000' + CAST(id AS VARCHAR(10)), 3)
            WHERE shopowner_id IS NULL
        `);

        // 1.3 Add shopowner_id to branches and sync
        const branchSchemaUpdate = `
            IF COL_LENGTH('branches', 'shopowner_id') IS NULL
            ALTER TABLE branches ADD shopowner_id NVARCHAR(50) NULL;

            IF COL_LENGTH('branches', 'branch_passcode') IS NULL
            ALTER TABLE branches ADD branch_passcode NVARCHAR(6) NULL;

            IF COL_LENGTH('branches', 'is_main') IS NULL
            ALTER TABLE branches ADD is_main BIT NULL;
        `;
        await pool.request().query(branchSchemaUpdate);

        await pool.request().query(`
            UPDATE branches
            SET branch_passcode = '123456'
            WHERE branch_passcode IS NULL
               OR LTRIM(RTRIM(branch_passcode)) = ''
               OR LEN(LTRIM(RTRIM(branch_passcode))) <> 6
        `);

        await pool.request().query(`
            UPDATE branches
            SET is_main = 0
            WHERE is_main IS NULL
        `);

        // Keep only one main branch per owner scope.
        await pool.request().query(`
            ;WITH owner_mains AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY COALESCE(shopowner_id, CONCAT('U-', CAST(user_id AS NVARCHAR(50))), 'NO_OWNER')
                        ORDER BY created_at ASC, id ASC
                    ) AS rn
                FROM branches
                WHERE is_main = 1
            )
            UPDATE b
            SET is_main = 0
            FROM branches b
            INNER JOIN owner_mains m ON m.id = b.id
            WHERE m.rn > 1
        `);

        // If an owner has no main branch, promote the earliest branch as main.
        await pool.request().query(`
            ;WITH ranked AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY COALESCE(shopowner_id, CONCAT('U-', CAST(user_id AS NVARCHAR(50))), 'NO_OWNER')
                        ORDER BY created_at ASC, id ASC
                    ) AS rn,
                    MAX(CASE WHEN is_main = 1 THEN 1 ELSE 0 END) OVER (
                        PARTITION BY COALESCE(shopowner_id, CONCAT('U-', CAST(user_id AS NVARCHAR(50))), 'NO_OWNER')
                    ) AS has_main
                FROM branches
            )
            UPDATE b
            SET is_main = 1
            FROM branches b
            INNER JOIN ranked r ON r.id = b.id
            WHERE r.has_main = 0 AND r.rn = 1
        `);

        await pool.request().query(`
            IF NOT EXISTS (
                SELECT 1
                FROM sys.default_constraints dc
                INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
                WHERE dc.parent_object_id = OBJECT_ID('branches')
                  AND c.name = 'branch_passcode'
            )
            BEGIN
                ALTER TABLE branches
                ADD CONSTRAINT DF_branches_branch_passcode DEFAULT ('123456') FOR branch_passcode;
            END
        `);

        await pool.request().query(`
            IF NOT EXISTS (
                SELECT 1
                FROM sys.default_constraints dc
                INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
                WHERE dc.parent_object_id = OBJECT_ID('branches')
                  AND c.name = 'is_main'
            )
            BEGIN
                ALTER TABLE branches
                ADD CONSTRAINT DF_branches_is_main DEFAULT (0) FOR is_main;
            END
        `);

        await pool.request().query(`
            UPDATE b
            SET b.shopowner_id = u.shopowner_id
            FROM branches b
            INNER JOIN shopowners u ON b.user_id = u.id
            WHERE b.shopowner_id IS NULL OR b.shopowner_id != u.shopowner_id
        `);

        const createManufacturingTableQuery = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='manufacturing_orders' AND xtype='U')
            CREATE TABLE manufacturing_orders (
                id INT IDENTITY(1,1) PRIMARY KEY,
                order_id NVARCHAR(50) NOT NULL,
                customer_id INT NULL,
                customer_name NVARCHAR(255) NOT NULL,
                customer_email NVARCHAR(255) NULL,
                product_name NVARCHAR(255) NOT NULL,
                karigar_name NVARCHAR(255) NULL,
                status NVARCHAR(50) NOT NULL,
                gold_weight FLOAT NULL,
                due_date DATETIME NULL,
                branch NVARCHAR(255) DEFAULT 'Main Branch',
                created_at DATETIME DEFAULT GETDATE()
            );
        `;
        await pool.request().query(createManufacturingTableQuery);

        try {
            await pool.request().query(`
                IF COL_LENGTH('manufacturing_orders', 'customer_id') IS NULL
                ALTER TABLE manufacturing_orders ADD customer_id INT NULL;

                IF COL_LENGTH('manufacturing_orders', 'customer_email') IS NULL
                ALTER TABLE manufacturing_orders ADD customer_email NVARCHAR(255) NULL;
            `);
        } catch (schemaErr) {
            console.error("Error verifying manufacturing customer columns:", schemaErr);
        }

        try {
            await pool.request().query(`
                IF COL_LENGTH('repair_tickets', 'customer_id') IS NULL
                ALTER TABLE repair_tickets ADD customer_id INT NULL;

                IF COL_LENGTH('repair_tickets', 'customer_email') IS NULL
                ALTER TABLE repair_tickets ADD customer_email NVARCHAR(255) NULL;
            `);
        } catch (schemaErr) {
            console.error("Error verifying repair ticket customer columns:", schemaErr);
        }

        // Create Stock Transfers Table (Ensure columns exist)
        const createStockTransfersQuery = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='stock_transfers' AND xtype='U')
            CREATE TABLE stock_transfers (
                id INT IDENTITY(1,1) PRIMARY KEY,
                transfer_id NVARCHAR(50) NOT NULL,
                from_branch NVARCHAR(255),
                to_branch NVARCHAR(255),
                items NVARCHAR(MAX),
                transfer_date DATETIME DEFAULT GETDATE(),
                status NVARCHAR(50) DEFAULT 'Pending',
                shopowner_id NVARCHAR(50),
                user_id INT
            );
        `;
        await pool.request().query(createStockTransfersQuery);

        const createStaffTableQuery = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='staff' AND xtype='U')
            CREATE TABLE staff (
                id INT IDENTITY(1,1) PRIMARY KEY,
                full_name NVARCHAR(255) NOT NULL,
                phone NVARCHAR(50) NULL,
                email NVARCHAR(255) NULL,
                role NVARCHAR(100) NULL,
                branch NVARCHAR(255) DEFAULT 'Main Branch',
                status NVARCHAR(50) DEFAULT 'Active',
                shopowner_id NVARCHAR(50) NULL,
                user_id INT NULL,
                created_at DATETIME DEFAULT GETDATE()
            );
        `;
        await pool.request().query(createStaffTableQuery);

        // Force ensure columns exist (Self-healing)
        try {
            await pool.request().query(`
                IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'stock_transfers' AND COLUMN_NAME = 'shopowner_id')
                ALTER TABLE stock_transfers ADD shopowner_id NVARCHAR(50);
                
                IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'stock_transfers' AND COLUMN_NAME = 'user_id')
                ALTER TABLE stock_transfers ADD user_id INT;
            `);
            console.log("Stock transfers schema verified.");
        } catch (schemaErr) {
            console.error("Error verifying stock_transfers schema:", schemaErr);
        }

        try {
            await pool.request().query(`
                IF COL_LENGTH('staff', 'branch') IS NULL
                ALTER TABLE staff ADD branch NVARCHAR(255) DEFAULT 'Main Branch';

                IF COL_LENGTH('staff', 'status') IS NULL
                ALTER TABLE staff ADD status NVARCHAR(50) DEFAULT 'Active';

                IF COL_LENGTH('staff', 'shopowner_id') IS NULL
                ALTER TABLE staff ADD shopowner_id NVARCHAR(50) NULL;

                IF COL_LENGTH('staff', 'user_id') IS NULL
                ALTER TABLE staff ADD user_id INT NULL;
            `);
            console.log("Staff schema verified.");
        } catch (schemaErr) {
            console.error("Error verifying staff schema:", schemaErr);
        }

        // 1.4 Enforce shopowner_id on generic tables and backfill
        const genericTables = ['sales', 'manufacturing_orders', 'repair_tickets', 'products', 'customers', 'installments'];
        for (const table of genericTables) {
            // Check if table exists
            const checkTable = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = '${table}'`);
            if (checkTable.recordset.length > 0) {
                // Add shopowner_id column if missing
                await pool.request().query(`
                    IF COL_LENGTH('${table}', 'shopowner_id') IS NULL
                    ALTER TABLE ${table} ADD shopowner_id NVARCHAR(50) NULL;
                `);

                // Backfill shopowner_id from linked user_id (if exists)
                // We use a dynamic query to checking if user_id exists in the table to avoid errors
                const checkUserCol = await pool.request().query(`
                    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${table}' AND COLUMN_NAME = 'user_id'
                `);

                if (checkUserCol.recordset.length > 0) {
                    await pool.request().query(`
                        UPDATE t
                        SET t.shopowner_id = s.shopowner_id
                        FROM ${table} t
                        JOIN shopowners s ON t.user_id = s.id
                        WHERE t.shopowner_id IS NULL
                    `);

                    // Fallback: If user_id is 1 (often used as default) and shopowner_id is still null, 
                    // maybe map to first shopowner? (Optional, skipping for now to be safe)
                }
            }
        }

        // 1.5 Performance indexes for super-admin details queries
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_branches_shopowner_created' AND object_id = OBJECT_ID('branches'))
                CREATE INDEX IX_branches_shopowner_created ON branches (shopowner_id, created_at DESC) INCLUDE (name, location, status, user_id);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_branches_user_created' AND object_id = OBJECT_ID('branches'))
                CREATE INDEX IX_branches_user_created ON branches (user_id, created_at DESC) INCLUDE (name, location, status, shopowner_id);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_products_shopowner_created' AND object_id = OBJECT_ID('products'))
                CREATE INDEX IX_products_shopowner_created ON products (shopowner_id, created_at DESC)
                INCLUDE (name, category, karat, price, stock_quantity, branch, product_code, status, user_id);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_products_user_created' AND object_id = OBJECT_ID('products'))
                CREATE INDEX IX_products_user_created ON products (user_id, created_at DESC)
                INCLUDE (name, category, karat, price, stock_quantity, branch, product_code, status, shopowner_id);
        `);

        // ... (Other tables create queries similar pattern if needed or rely on alter) ...
        // Re-running create queries is safe due to IF NOT EXISTS, but we need to ensure they have branch col if created now.
        // The loop above ensures added column for existing tables. For new tables, we should add it in definition.

        console.log("Database schema synchronized (branch columns added).");

        // 2. Demo Data Generation (idempotent)
        console.log("Seeding demo data for Chittagong Branch (if missing)...");

        // Demo Products
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM products WHERE product_code = 'CTG-NECK-001')
                UPDATE products
                SET product_code = 'CTG-NECK-001'
                WHERE product_code IS NULL
                  AND name = 'Chittagong Gold Necklace'
                  AND branch = 'Chittagong Branch';

            IF NOT EXISTS (SELECT 1 FROM products WHERE product_code = 'CTG-RING-001')
                UPDATE products
                SET product_code = 'CTG-RING-001'
                WHERE product_code IS NULL
                  AND name = 'Agrabad Special Ring'
                  AND branch = 'Chittagong Branch';

            IF NOT EXISTS (SELECT 1 FROM products WHERE product_code = 'CTG-NECK-001')
                INSERT INTO products (product_code, name, category, karat, weight, price, stock_quantity, image_url, branch, status)
                VALUES ('CTG-NECK-001', 'Chittagong Gold Necklace', 'Necklace', '22K', 12.5, 120000, 5, 'https://placehold.co/400', 'Chittagong Branch', 'In Stock');

            IF NOT EXISTS (SELECT 1 FROM products WHERE product_code = 'CTG-RING-001')
                INSERT INTO products (product_code, name, category, karat, weight, price, stock_quantity, image_url, branch, status)
                VALUES ('CTG-RING-001', 'Agrabad Special Ring', 'Ring', '21K', 5.0, 45000, 10, 'https://placehold.co/400', 'Chittagong Branch', 'In Stock');
        `);

        // Demo Repairs
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM repair_tickets WHERE ticket_id = 'REP-CTG-001')
                INSERT INTO repair_tickets (ticket_id, customer_name, customer_phone, item_name, issue_description, estimated_cost, branch, status)
                VALUES ('REP-CTG-001', 'Karim Ullah', '01812345678', 'Broken Chain', 'Soldering needed', 500, 'Chittagong Branch', 'Active');
        `);

        // Demo Sales
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sales WHERE transaction_id = 'TXN-CTG-101')
                INSERT INTO sales (total_amount, tax_amount, final_amount, payment_method, transaction_id, status, branch)
                VALUES (120000, 6000, 126000, 'Cash', 'TXN-CTG-101', 'Completed', 'Chittagong Branch');
        `);

    } catch (err) {
        console.error("Schema initialization failed:", err);
    }
});
} else {
    console.log("Demo mode enabled. Skipping SQL connection and schema synchronization.");
}

// ... (Mock Data & Routes)

// Helper: Filter by branch
// We'll update GET requests to use req.query.branch (default 'Main Branch')
// We'll update POST/PUT requests to accept branch in body

// GET /api/inventory
// GET /api/inventory
app.get('/api/inventory', async (req, res) => {
    const branch = req.query.branch || 'Main Branch';
    const allBranches = String(req.query.allBranches || '').toLowerCase() === 'true' || String(req.query.allBranches) === '1';
    const { userId, shopownerId } = req.query;

    if (!shopownerId && !userId) {
        return res.status(400).json({ error: "Shop Owner ID is required" });
    }

    try {
        const pool = await sql.connect();
        await ensureProductMarketplaceLiveSchema(pool);
        let resolvedUserId = userId ? Number(userId) : null;

        if ((!resolvedUserId || !Number.isFinite(resolvedUserId)) && shopownerId) {
            const userRes = await pool.request()
                .input('sid', sql.NVarChar, shopownerId)
                .query("SELECT id FROM shopowners WHERE shopowner_id = @sid");
            resolvedUserId = userRes.recordset.length > 0 ? Number(userRes.recordset[0].id) : null;
        }

        await syncInventoryStatusByScope(pool, { branch, shopownerId, resolvedUserId, allBranches });

        let query = 'SELECT * FROM products WHERE 1 = 1';

        const request = pool.request();
        if (!allBranches) {
            query += ' AND branch = @branch';
            request.input('branch', sql.NVarChar, branch);
        }

        if (shopownerId) {
            if (resolvedUserId) {
                query += ' AND (shopowner_id = @shopownerId OR user_id = @userId)';
                request.input('shopownerId', sql.NVarChar, shopownerId);
                request.input('userId', sql.Int, resolvedUserId);
            } else {
                query += ' AND shopowner_id = @shopownerId';
                request.input('shopownerId', sql.NVarChar, shopownerId);
            }
        } else if (userId) {
            if (resolvedUserId) {
                query += ' AND user_id = @userId';
                request.input('userId', sql.Int, resolvedUserId);
            }
        }

        query += ' ORDER BY created_at DESC';
        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching inventory:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST /api/inventory
// POST /api/inventory
app.post('/api/inventory', async (req, res) => {
    const { name, category, karat, weight, price, stock_quantity, image_url, supplier_id, product_code, branch, userId, shopownerId, is_marketplace_live } = req.body;

    try {
        const pool = await sql.connect();
        await ensureProductMarketplaceLiveSchema(pool);
        const normalizedStockQuantity = normalizeInventoryQuantity(stock_quantity);
        const normalizedStatus = deriveInventoryStatus(normalizedStockQuantity);
        const normalizedMarketplaceLive = String(is_marketplace_live).toLowerCase() === 'false' || String(is_marketplace_live) === '0'
            ? 0
            : 1;

        let resolvedUserId = userId;
        if (!resolvedUserId && shopownerId) {
            const userRes = await pool.request().input('sid', sql.NVarChar, shopownerId).query("SELECT id FROM shopowners WHERE shopowner_id = @sid");
            if (userRes.recordset.length > 0) resolvedUserId = userRes.recordset[0].id;
        }

        const insertQuery = `
            INSERT INTO products (name, category, karat, weight, price, stock_quantity, image_url, supplier_id, product_code, branch, user_id, shopowner_id, status, is_marketplace_live)
            OUTPUT INSERTED.*
            VALUES (@name, @category, @karat, @weight, @price, @stock_quantity, @image_url, @supplier_id, @product_code, @branch, @user_id, @shopowner_id, @status, @is_marketplace_live)
        `;
        const result = await pool.request()
            .input('name', sql.NVarChar, name)
            .input('category', sql.NVarChar, category)
            .input('karat', sql.NVarChar, karat)
            .input('weight', sql.Float, weight)
            .input('price', sql.Decimal(18, 2), price)
            .input('stock_quantity', sql.Int, normalizedStockQuantity)
            .input('image_url', sql.NVarChar, image_url || 'https://placehold.co/400')
            .input('supplier_id', sql.Int, supplier_id || null)
            .input('product_code', sql.NVarChar, product_code || `P-${Date.now()}`)
            .input('branch', sql.NVarChar, branch || 'Main Branch')
            .input('user_id', sql.Int, resolvedUserId || null)
            .input('shopowner_id', sql.NVarChar, shopownerId || null)
            .input('status', sql.NVarChar, normalizedStatus)
            .input('is_marketplace_live', sql.Bit, normalizedMarketplaceLive)
            .query(insertQuery);

        res.status(201).json(result.recordset[0]);
    } catch (err) {
        console.error("Error creating product:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// GET /api/repairs
app.get('/api/repairs', async (req, res) => {
    const branch = req.query.branch || 'Main Branch';
    const { shopownerId } = req.query;
    try {
        const pool = await sql.connect();
        let query = 'SELECT * FROM repair_tickets WHERE branch = @branch';
        const request = pool.request().input('branch', sql.NVarChar, branch);

        if (shopownerId) {
            query += ' AND shopowner_id = @shopownerId';
            request.input('shopownerId', sql.NVarChar, shopownerId);
        }

        query += ' ORDER BY created_at DESC';
        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching repair tickets:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST /api/repairs
app.post('/api/repairs', async (req, res) => {
    const {
        customer_id,
        customer_name,
        customer_phone,
        customer_email,
        item_name,
        issue_description,
        estimated_cost,
        due_date,
        branch,
        shopownerId,
        status
    } = req.body;
    try {
        const pool = await sql.connect();

        const ticket_id = `REP-${Date.now()}`;
        const initialStatus = status || 'Active';
        let resolvedCustomerEmail = customer_email || null;

        if (!resolvedCustomerEmail && customer_id) {
            const customerRes = await pool.request()
                .input('customer_id', sql.Int, Number(customer_id))
                .input('shopowner_id', sql.NVarChar, shopownerId || null)
                .query(`
                    SELECT TOP 1 email
                    FROM customers
                    WHERE id = @customer_id
                      AND (@shopowner_id IS NULL OR shopowner_id = @shopowner_id)
                `);
            resolvedCustomerEmail = customerRes.recordset[0]?.email || null;
        }

        // Map due_date to delivery_date as per schema
        const insertQuery = `
            INSERT INTO repair_tickets (ticket_id, customer_id, customer_name, customer_phone, customer_email, item_name, issue_description, estimated_cost, delivery_date, branch, shopowner_id, status)
            OUTPUT INSERTED.*
            VALUES (@ticket_id, @customer_id, @customer_name, @customer_phone, @customer_email, @item_name, @issue_description, @estimated_cost, @delivery_date, @branch, @shopowner_id, @status)
        `;

        const result = await pool.request()
            .input('ticket_id', sql.NVarChar, ticket_id)
            .input('customer_id', sql.Int, customer_id ? Number(customer_id) : null)
            .input('customer_name', sql.NVarChar, customer_name)
            .input('customer_phone', sql.NVarChar, customer_phone || null)
            .input('customer_email', sql.NVarChar, resolvedCustomerEmail || null)
            .input('item_name', sql.NVarChar, item_name)
            .input('issue_description', sql.NVarChar, issue_description)
            .input('estimated_cost', sql.Decimal(18, 2), estimated_cost || 0)
            .input('delivery_date', sql.DateTime, due_date || null)
            .input('branch', sql.NVarChar, branch || 'Main Branch')
            .input('shopowner_id', sql.NVarChar, shopownerId || null)
            .input('status', sql.NVarChar, initialStatus)
            .query(insertQuery);

        const createdTicket = result.recordset[0];

        if (createdTicket?.status === 'Active') {
            triggerRepairStatusEmailAsync(pool, createdTicket, 'Active');
        }

        res.status(201).json(createdTicket);
    } catch (err) {
        console.error("Error creating repair ticket:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// PUT /api/repairs/:id
app.put('/api/repairs/:id', async (req, res) => {
    const { id } = req.params;
    const { status, estimated_cost, delivery_date } = req.body;

    try {
        const pool = await sql.connect();
        const existingTicketResult = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT TOP 1 * FROM repair_tickets WHERE id = @id');

        if (existingTicketResult.recordset.length === 0) {
            return res.status(404).json({ error: "Ticket not found" });
        }
        const existingTicket = existingTicketResult.recordset[0];

        let query = 'UPDATE repair_tickets SET ';
        const updates = [];

        if (status !== undefined) updates.push("status = @status");
        if (estimated_cost !== undefined) updates.push("estimated_cost = @estimated_cost");
        if (delivery_date !== undefined) updates.push("delivery_date = @delivery_date");

        if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });

        query += updates.join(", ");
        query += " OUTPUT INSERTED.* WHERE id = @id";

        const request = pool.request().input('id', sql.Int, id);

        if (status !== undefined) request.input('status', sql.NVarChar, status);
        if (estimated_cost !== undefined) request.input('estimated_cost', sql.Decimal(18, 2), estimated_cost === '' || estimated_cost === null ? 0 : estimated_cost);
        if (delivery_date !== undefined) request.input('delivery_date', sql.DateTime, delivery_date || null);

        const result = await request.query(query);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: "Ticket not found" });
        }

        const updatedTicket = result.recordset[0];

        const statusChanged = existingTicket.status !== updatedTicket.status;
        if (statusChanged && ['Active', 'Completed'].includes(updatedTicket.status)) {
            triggerRepairStatusEmailAsync(pool, updatedTicket, updatedTicket.status);
        }

        res.json(updatedTicket);
    } catch (err) {
        console.error("Error updating repair ticket:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// DELETE /api/repairs/:id
app.delete('/api/repairs/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await sql.connect();
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM repair_tickets WHERE id = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: "Ticket not found" });
        }

        res.json({ message: "Ticket deleted successfully" });
    } catch (err) {
        console.error("Error deleting repair ticket:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// GET /api/sales
app.get('/api/sales', async (req, res) => {
    const branch = req.query.branch || 'Main Branch';
    const { userId, shopownerId } = req.query;

    try {
        const pool = await sql.connect();
        let query = 'SELECT * FROM sales WHERE branch = @branch';
        const request = pool.request().input('branch', sql.NVarChar, branch);

        if (shopownerId) {
            request.input('shopownerId', sql.NVarChar, shopownerId);
            const userRes = await pool.request()
                .input('sid', sql.NVarChar, shopownerId)
                .query("SELECT id FROM shopowners WHERE shopowner_id = @sid");
            const resolvedUserId = userRes.recordset.length > 0 ? userRes.recordset[0].id : null;

            query += ' AND (shopowner_id = @shopownerId';
            if (resolvedUserId) {
                query += ' OR user_id = @userId';
                request.input('userId', sql.Int, resolvedUserId);
            }
            query += ')';
        } else if (userId) {
            query += ' AND user_id = @userId';
            request.input('userId', sql.Int, userId);
        }

        query += ' ORDER BY sale_date DESC';
        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching sales:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// GET /api/dashboard/insights
app.get('/api/dashboard/insights', async (req, res) => {
    const branch = req.query.branch || 'Main Branch';
    const { shopownerId, userId } = req.query;

    try {
        const pool = await sql.connect();
        const parsedUserId = userId ? Number(userId) : null;
        let resolvedUserId = Number.isFinite(parsedUserId) && parsedUserId > 0 ? parsedUserId : null;

        if (userId && !resolvedUserId && !shopownerId) {
            return res.status(400).json({ error: "Invalid user ID" });
        }

        if (!resolvedUserId && shopownerId) {
            const userRes = await pool.request()
                .input('sid', sql.NVarChar, shopownerId)
                .query("SELECT id FROM shopowners WHERE shopowner_id = @sid");
            resolvedUserId = userRes.recordset.length > 0 ? userRes.recordset[0].id : null;
        }

        const addOwnerFilter = (request, alias = '') => {
            const prefix = alias ? `${alias}.` : '';
            if (shopownerId && resolvedUserId) {
                request.input('shopownerId', sql.NVarChar, shopownerId);
                request.input('userId', sql.Int, resolvedUserId);
                return ` AND (${prefix}shopowner_id = @shopownerId OR ${prefix}user_id = @userId)`;
            }
            if (shopownerId) {
                request.input('shopownerId', sql.NVarChar, shopownerId);
                return ` AND ${prefix}shopowner_id = @shopownerId`;
            }
            if (resolvedUserId) {
                request.input('userId', sql.Int, resolvedUserId);
                return ` AND ${prefix}user_id = @userId`;
            }
            return '';
        };

        const toNumber = (value) => Number(value || 0);
        const toIso = (value) => (value ? new Date(value).toISOString() : null);

        const statsRequest = pool.request()
            .input('branch', sql.NVarChar, branch);
        const statsOwnerFilter = addOwnerFilter(statsRequest, 's');
        const statsPromise = statsRequest.query(`
            SELECT
                ISNULL(SUM(CASE WHEN CAST(s.sale_date AS DATE) = CAST(GETDATE() AS DATE) AND s.status = 'Completed' THEN s.final_amount ELSE 0 END), 0) AS today_sales_total,
                ISNULL(SUM(CASE WHEN s.status = 'Pending' THEN 1 ELSE 0 END), 0) AS pending_sales
            FROM sales s
            WHERE s.branch = @branch
              AND s.branch <> 'Subscription'
              ${statsOwnerFilter}
        `);

        const activeRepairsRequest = pool.request()
            .input('branch', sql.NVarChar, branch);
        const activeRepairsOwnerFilter = addOwnerFilter(activeRepairsRequest, 'r');
        const activeRepairsPromise = activeRepairsRequest.query(`
            SELECT COUNT(*) AS active_repairs
            FROM repair_tickets r
            WHERE r.branch = @branch
              AND r.status = 'Active'
              ${activeRepairsOwnerFilter}
        `);

        const topCustomerRequest = pool.request()
            .input('branch', sql.NVarChar, branch);
        const topCustomerOwnerFilter = addOwnerFilter(topCustomerRequest, 'c');
        const topCustomerPromise = topCustomerRequest.query(`
            SELECT TOP 1
                c.id,
                c.name,
                c.phone,
                c.email,
                c.type,
                ISNULL(c.total_spent, 0) AS total_spent,
                c.last_visit
            FROM customers c
            WHERE c.branch = @branch
              ${topCustomerOwnerFilter}
            ORDER BY ISNULL(c.total_spent, 0) DESC, ISNULL(c.last_visit, '1900-01-01') DESC
        `);

        const customerMetricsRequest = pool.request()
            .input('branch', sql.NVarChar, branch);
        const customerMetricsOwnerFilter = addOwnerFilter(customerMetricsRequest, 'c');
        const customerMetricsPromise = customerMetricsRequest.query(`
            SELECT
                COUNT(*) AS total_customers,
                SUM(CASE WHEN c.type = 'VIP' THEN 1 ELSE 0 END) AS vip_customers,
                SUM(CASE WHEN c.last_visit >= DATEADD(DAY, -30, GETDATE()) THEN 1 ELSE 0 END) AS active_customers_30d
            FROM customers c
            WHERE c.branch = @branch
              ${customerMetricsOwnerFilter}
        `);

        const topProductsRequest = pool.request()
            .input('branch', sql.NVarChar, branch);
        const topProductsOwnerFilter = addOwnerFilter(topProductsRequest, 's');
        const topProductsPromise = topProductsRequest.query(`
            IF OBJECT_ID('sale_items', 'U') IS NOT NULL
            BEGIN
                SELECT TOP 5
                    ISNULL(NULLIF(LTRIM(RTRIM(p.name)), ''), 'Unnamed Product') AS product_name,
                    SUM(si.quantity) AS total_quantity,
                    ISNULL(SUM(si.total_price), 0) AS total_revenue
                FROM sale_items si
                INNER JOIN sales s ON si.sale_id = s.id
                LEFT JOIN products p ON si.product_id = p.id
                WHERE s.branch = @branch
                  AND s.status = 'Completed'
                  AND s.branch <> 'Subscription'
                  ${topProductsOwnerFilter}
                GROUP BY ISNULL(NULLIF(LTRIM(RTRIM(p.name)), ''), 'Unnamed Product')
                ORDER BY SUM(si.quantity) DESC, SUM(si.total_price) DESC
            END
            ELSE
            BEGIN
                SELECT TOP 0
                    CAST('' AS NVARCHAR(255)) AS product_name,
                    CAST(0 AS INT) AS total_quantity,
                    CAST(0 AS DECIMAL(18, 2)) AS total_revenue
            END
        `);

        const lowStockRequest = pool.request()
            .input('branch', sql.NVarChar, branch);
        const lowStockOwnerFilter = addOwnerFilter(lowStockRequest, 'p');
        const lowStockPromise = lowStockRequest.query(`
            SELECT COUNT(*) AS low_stock_count
            FROM products p
            WHERE p.branch = @branch
              AND ISNULL(p.stock_quantity, 0) <= 5
              ${lowStockOwnerFilter}
        `);

        const overdueRepairsRequest = pool.request()
            .input('branch', sql.NVarChar, branch);
        const overdueRepairsOwnerFilter = addOwnerFilter(overdueRepairsRequest, 'r');
        const overdueRepairsPromise = overdueRepairsRequest.query(`
            SELECT COUNT(*) AS overdue_repairs
            FROM repair_tickets r
            WHERE r.branch = @branch
              AND r.delivery_date IS NOT NULL
              AND CAST(r.delivery_date AS DATE) < CAST(GETDATE() AS DATE)
              AND ISNULL(r.status, '') NOT IN ('Completed', 'Delivered')
              ${overdueRepairsOwnerFilter}
        `);

        const dueManufacturingRequest = pool.request()
            .input('branch', sql.NVarChar, branch);
        const dueManufacturingOwnerFilter = addOwnerFilter(dueManufacturingRequest, 'm');
        const dueManufacturingPromise = dueManufacturingRequest.query(`
            SELECT COUNT(*) AS due_manufacturing_7d
            FROM manufacturing_orders m
            WHERE m.branch = @branch
              AND m.due_date IS NOT NULL
              AND CAST(m.due_date AS DATE) BETWEEN CAST(GETDATE() AS DATE) AND CAST(DATEADD(DAY, 7, GETDATE()) AS DATE)
              AND ISNULL(m.status, '') <> 'Completed'
              ${dueManufacturingOwnerFilter}
        `);

        const recentSalesRequest = pool.request()
            .input('branch', sql.NVarChar, branch);
        const recentSalesOwnerFilter = addOwnerFilter(recentSalesRequest, 's');
        const recentSalesPromise = recentSalesRequest.query(`
            SELECT TOP 8
                s.id,
                s.transaction_id,
                s.final_amount,
                s.sale_date,
                c.name AS customer_name,
                c.phone AS customer_phone
            FROM sales s
            LEFT JOIN customers c ON s.customer_id = c.id
            WHERE s.branch = @branch
              AND s.branch <> 'Subscription'
              ${recentSalesOwnerFilter}
            ORDER BY s.sale_date DESC
        `);

        const recentRepairsRequest = pool.request()
            .input('branch', sql.NVarChar, branch);
        const recentRepairsOwnerFilter = addOwnerFilter(recentRepairsRequest, 'r');
        const recentRepairsPromise = recentRepairsRequest.query(`
            SELECT TOP 8
                r.id,
                r.item_name,
                r.estimated_cost,
                r.received_date,
                r.customer_name,
                r.customer_phone
            FROM repair_tickets r
            WHERE r.branch = @branch
              ${recentRepairsOwnerFilter}
            ORDER BY r.received_date DESC
        `);

        const recentManufacturingRequest = pool.request()
            .input('branch', sql.NVarChar, branch);
        const recentManufacturingOwnerFilter = addOwnerFilter(recentManufacturingRequest, 'm');
        const recentManufacturingPromise = recentManufacturingRequest.query(`
            SELECT TOP 8
                m.id,
                m.order_id,
                m.product_name,
                m.gold_weight,
                m.status,
                m.created_at,
                m.customer_name,
                c.phone AS customer_phone
            FROM manufacturing_orders m
            LEFT JOIN customers c ON m.customer_id = c.id
            WHERE m.branch = @branch
              ${recentManufacturingOwnerFilter}
            ORDER BY m.created_at DESC
        `);

        const [
            statsResult,
            activeRepairsResult,
            topCustomerResult,
            customerMetricsResult,
            topProductsResult,
            lowStockResult,
            overdueRepairsResult,
            dueManufacturingResult,
            recentSalesResult,
            recentRepairsResult,
            recentManufacturingResult
        ] = await Promise.all([
            statsPromise,
            activeRepairsPromise,
            topCustomerPromise,
            customerMetricsPromise,
            topProductsPromise,
            lowStockPromise,
            overdueRepairsPromise,
            dueManufacturingPromise,
            recentSalesPromise,
            recentRepairsPromise,
            recentManufacturingPromise
        ]);

        const statsRow = statsResult.recordset[0] || {};
        const activeRepairsRow = activeRepairsResult.recordset[0] || {};
        const topCustomerRow = topCustomerResult.recordset[0] || null;
        const customerMetricsRow = customerMetricsResult.recordset[0] || {};
        const lowStockRow = lowStockResult.recordset[0] || {};
        const overdueRepairsRow = overdueRepairsResult.recordset[0] || {};
        const dueManufacturingRow = dueManufacturingResult.recordset[0] || {};

        const recentActivity = [
            ...recentSalesResult.recordset.map((item) => ({
                id: `sale-${item.id}`,
                type: 'Sale',
                message: `Sale #${item.transaction_id}`,
                customer_name: item.customer_name || 'Walk-in Customer',
                customer_phone: item.customer_phone || null,
                amount: toNumber(item.final_amount),
                amount_label: `+ Tk ${toNumber(item.final_amount).toLocaleString()}`,
                timestamp: toIso(item.sale_date)
            })),
            ...recentRepairsResult.recordset.map((item) => ({
                id: `repair-${item.id}`,
                type: 'Repair',
                message: `Repair: ${item.item_name || 'Jewelry Item'}`,
                customer_name: item.customer_name || 'Customer',
                customer_phone: item.customer_phone || null,
                amount: toNumber(item.estimated_cost),
                amount_label: `Est. Tk ${toNumber(item.estimated_cost).toLocaleString()}`,
                timestamp: toIso(item.received_date)
            })),
            ...recentManufacturingResult.recordset.map((item) => ({
                id: `manufacturing-${item.id}`,
                type: 'Manufacturing',
                message: `Order #${item.order_id || item.id}: ${item.product_name || 'Custom Design'}`,
                customer_name: item.customer_name || 'Customer',
                customer_phone: item.customer_phone || null,
                amount: toNumber(item.gold_weight),
                amount_label: `${toNumber(item.gold_weight).toFixed(2)} g`,
                status: item.status || null,
                timestamp: toIso(item.created_at)
            }))
        ]
            .filter((item) => item.timestamp)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 10);

        res.json({
            stats: {
                today_sales_total: toNumber(statsRow.today_sales_total),
                pending_orders: toNumber(statsRow.pending_sales),
                active_repairs: toNumber(activeRepairsRow.active_repairs)
            },
            customers: {
                total_customers: toNumber(customerMetricsRow.total_customers),
                vip_customers: toNumber(customerMetricsRow.vip_customers),
                active_customers_30d: toNumber(customerMetricsRow.active_customers_30d),
                top_customer: topCustomerRow
                    ? {
                        id: topCustomerRow.id,
                        name: topCustomerRow.name,
                        phone: topCustomerRow.phone,
                        email: topCustomerRow.email,
                        type: topCustomerRow.type,
                        total_spent: toNumber(topCustomerRow.total_spent),
                        last_visit: toIso(topCustomerRow.last_visit)
                    }
                    : null
            },
            products: {
                top_trending: topProductsResult.recordset.map((item) => ({
                    product_name: item.product_name,
                    total_quantity: toNumber(item.total_quantity),
                    total_revenue: toNumber(item.total_revenue)
                }))
            },
            operations: {
                low_stock_count: toNumber(lowStockRow.low_stock_count),
                overdue_repairs: toNumber(overdueRepairsRow.overdue_repairs),
                due_manufacturing_7d: toNumber(dueManufacturingRow.due_manufacturing_7d)
            },
            recent_activity: recentActivity
        });
    } catch (err) {
        console.error("Error fetching dashboard insights:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// GET /api/reports/analytics
app.get('/api/reports/analytics', async (req, res) => {
    const { userId, shopownerId } = req.query;
    const days = Math.min(Math.max(Number(req.query.days) || 14, 7), 400);
    const months = Math.min(Math.max(Number(req.query.months) || 6, 3), 24);
    const offsetDays = Math.min(Math.max(Number(req.query.offsetDays) || 0, 0), 4000);
    const topLimit = Math.min(Math.max(Number(req.query.topLimit) || 6, 1), 50);
    const summaryOnly = req.query.summaryOnly === '1' || req.query.summaryOnly === 'true';

    if (!shopownerId && !userId) {
        return res.status(400).json({ error: "Shop Owner ID is required" });
    }

    try {
        const pool = await sql.connect();
        const parsedUserId = userId ? Number(userId) : null;
        let resolvedUserId = Number.isFinite(parsedUserId) && parsedUserId > 0 ? parsedUserId : null;

        if (userId && !resolvedUserId && !shopownerId) {
            return res.status(400).json({ error: "Invalid user ID" });
        }

        if (!resolvedUserId && shopownerId) {
            const userRes = await pool.request()
                .input('sid', sql.NVarChar, shopownerId)
                .query("SELECT id FROM shopowners WHERE shopowner_id = @sid");
            resolvedUserId = userRes.recordset.length > 0 ? userRes.recordset[0].id : null;
        }

        const addOwnerFilter = (reqToUse, alias = '') => {
            const prefix = alias ? `${alias}.` : '';
            if (shopownerId && resolvedUserId) {
                reqToUse.input('shopownerId', sql.NVarChar, shopownerId);
                reqToUse.input('userId', sql.Int, resolvedUserId);
                return ` AND (${prefix}shopowner_id = @shopownerId OR ${prefix}user_id = @userId)`;
            }
            if (shopownerId) {
                reqToUse.input('shopownerId', sql.NVarChar, shopownerId);
                return ` AND ${prefix}shopowner_id = @shopownerId`;
            }
            if (resolvedUserId) {
                reqToUse.input('userId', sql.Int, resolvedUserId);
                return ` AND ${prefix}user_id = @userId`;
            }
            return '';
        };

        const toNumber = (value) => Number(value || 0);
        const periodStart = new Date();
        periodStart.setHours(0, 0, 0, 0);
        periodStart.setDate(periodStart.getDate() - (days - 1 + offsetDays));

        const periodEnd = new Date();
        periodEnd.setHours(23, 59, 59, 999);
        periodEnd.setDate(periodEnd.getDate() - offsetDays);

        const addDateFilter = (reqToUse, alias = '') => {
            const prefix = alias ? `${alias}.` : '';
            reqToUse.input('startDate', sql.DateTime, periodStart);
            reqToUse.input('endDate', sql.DateTime, periodEnd);
            return ` AND ${prefix}sale_date >= @startDate AND ${prefix}sale_date <= @endDate`;
        };

        const summaryRequest = pool.request();
        const summaryOwnerFilter = addOwnerFilter(summaryRequest, 's');
        const summaryDateFilter = addDateFilter(summaryRequest, 's');
        const summaryPromise = summaryRequest.query(`
            SELECT
                ISNULL(SUM(CASE WHEN s.status = 'Completed' THEN s.final_amount ELSE 0 END), 0) AS collected_revenue,
                ISNULL(SUM(CASE WHEN s.status IN ('Pending', 'Failed') THEN s.final_amount ELSE 0 END), 0) AS at_risk_revenue,
                ISNULL(SUM(s.final_amount), 0) AS gross_revenue,
                COUNT(*) AS total_orders,
                SUM(CASE WHEN s.status = 'Completed' THEN 1 ELSE 0 END) AS completed_orders,
                SUM(CASE WHEN s.status = 'Pending' THEN 1 ELSE 0 END) AS pending_orders,
                SUM(CASE WHEN s.status = 'Failed' THEN 1 ELSE 0 END) AS failed_orders
            FROM sales s
            WHERE s.branch <> 'Subscription'
            ${summaryOwnerFilter}
            ${summaryDateFilter}
        `);

        if (summaryOnly) {
            const summaryResult = await summaryPromise;
            const summary = summaryResult.recordset[0] || {};
            const completedOrders = toNumber(summary.completed_orders);
            const collectedRevenue = toNumber(summary.collected_revenue);

            return res.json({
                summary: {
                    gross_revenue: toNumber(summary.gross_revenue),
                    collected_revenue: collectedRevenue,
                    at_risk_revenue: toNumber(summary.at_risk_revenue),
                    total_orders: toNumber(summary.total_orders),
                    completed_orders: completedOrders,
                    pending_orders: toNumber(summary.pending_orders),
                    failed_orders: toNumber(summary.failed_orders),
                    average_order_value: completedOrders > 0 ? collectedRevenue / completedOrders : 0
                },
                sales_trend: [],
                profit_loss: [],
                top_products: [],
                revenue_by_branch: [],
                period: {
                    start: periodStart.toISOString(),
                    end: periodEnd.toISOString(),
                    days,
                    months,
                    offset_days: offsetDays
                },
                generated_at: new Date().toISOString()
            });
        }

        const trendRequest = pool.request()
            .input('startDate', sql.DateTime, periodStart)
            .input('endDate', sql.DateTime, periodEnd);
        const trendOwnerFilter = addOwnerFilter(trendRequest, 's');
        const trendPromise = trendRequest.query(`
            WITH DateSeries AS (
                SELECT CAST(@startDate AS DATE) AS d
                UNION ALL
                SELECT DATEADD(DAY, 1, d)
                FROM DateSeries
                WHERE d < CAST(@endDate AS DATE)
            )
            SELECT
                ds.d AS [date],
                ISNULL(SUM(CASE WHEN s.status = 'Completed' THEN s.final_amount ELSE 0 END), 0) AS revenue,
                ISNULL(SUM(CASE WHEN s.status = 'Completed' THEN 1 ELSE 0 END), 0) AS orders
            FROM DateSeries ds
            LEFT JOIN sales s
                ON CAST(s.sale_date AS DATE) = ds.d
                AND s.branch <> 'Subscription'
                ${trendOwnerFilter}
                AND s.sale_date >= @startDate
                AND s.sale_date <= @endDate
            GROUP BY ds.d
            ORDER BY ds.d
            OPTION (MAXRECURSION 500)
        `);

        const profitLossRequest = pool.request()
            .input('months', sql.Int, months)
            .input('periodEndDate', sql.DateTime, periodEnd);
        const profitLossOwnerFilter = addOwnerFilter(profitLossRequest, 's');
        const profitLossDateFilter = addDateFilter(profitLossRequest, 's');
        const profitPromise = profitLossRequest.query(`
            WITH MonthSeries AS (
                SELECT DATEFROMPARTS(YEAR(@periodEndDate), MONTH(@periodEndDate), 1) AS month_start, 1 AS n
                UNION ALL
                SELECT DATEADD(MONTH, -1, month_start), n + 1
                FROM MonthSeries
                WHERE n < @months
            )
            SELECT
                YEAR(ms.month_start) AS [year],
                MONTH(ms.month_start) AS [month],
                ISNULL(SUM(CASE WHEN s.status = 'Completed' THEN s.final_amount ELSE 0 END), 0) AS profit,
                ISNULL(SUM(CASE WHEN s.status IN ('Pending', 'Failed') THEN s.final_amount ELSE 0 END), 0) AS loss
            FROM MonthSeries ms
            LEFT JOIN sales s
                ON YEAR(s.sale_date) = YEAR(ms.month_start)
                AND MONTH(s.sale_date) = MONTH(ms.month_start)
                AND s.branch <> 'Subscription'
                ${profitLossOwnerFilter}
                ${profitLossDateFilter}
            GROUP BY ms.month_start
            ORDER BY ms.month_start
            OPTION (MAXRECURSION 100)
        `);

        const topProductsRequest = pool.request()
            .input('topLimit', sql.Int, topLimit);
        const topProductsOwnerFilter = addOwnerFilter(topProductsRequest, 's');
        const topProductsDateFilter = addDateFilter(topProductsRequest, 's');
        const topProductsPromise = topProductsRequest.query(`
            IF OBJECT_ID('sale_items', 'U') IS NOT NULL
            BEGIN
                SELECT TOP (@topLimit)
                    ISNULL(NULLIF(LTRIM(RTRIM(p.name)), ''), 'Unnamed Product') AS product_name,
                    SUM(si.quantity) AS total_quantity,
                    ISNULL(SUM(si.total_price), 0) AS total_revenue
                FROM sale_items si
                INNER JOIN sales s ON si.sale_id = s.id
                LEFT JOIN products p ON si.product_id = p.id
                WHERE s.status = 'Completed'
                    AND s.branch <> 'Subscription'
                    ${topProductsOwnerFilter}
                    ${topProductsDateFilter}
                GROUP BY ISNULL(NULLIF(LTRIM(RTRIM(p.name)), ''), 'Unnamed Product')
                ORDER BY SUM(si.quantity) DESC, SUM(si.total_price) DESC
            END
            ELSE
            BEGIN
                SELECT TOP 0
                    CAST('' AS NVARCHAR(255)) AS product_name,
                    CAST(0 AS INT) AS total_quantity,
                    CAST(0 AS DECIMAL(18, 2)) AS total_revenue
            END
        `);

        const revenueByBranchRequest = pool.request();
        const revenueByBranchOwnerFilter = addOwnerFilter(revenueByBranchRequest, 's');
        const revenueByBranchDateFilter = addDateFilter(revenueByBranchRequest, 's');
        const branchPromise = revenueByBranchRequest.query(`
            SELECT
                s.branch,
                ISNULL(SUM(CASE WHEN s.status = 'Completed' THEN s.final_amount ELSE 0 END), 0) AS revenue,
                SUM(CASE WHEN s.status = 'Completed' THEN 1 ELSE 0 END) AS completed_orders
            FROM sales s
            WHERE s.branch <> 'Subscription'
                ${revenueByBranchOwnerFilter}
                ${revenueByBranchDateFilter}
            GROUP BY s.branch
            ORDER BY revenue DESC
        `);

        const [summaryResult, salesTrendResult, profitLossResult, topProductsResult, revenueByBranchResult] = await Promise.all([
            summaryPromise,
            trendPromise,
            profitPromise,
            topProductsPromise,
            branchPromise
        ]);
        const summary = summaryResult.recordset[0] || {};
        const completedOrders = toNumber(summary.completed_orders);
        const collectedRevenue = toNumber(summary.collected_revenue);

        res.json({
            summary: {
                gross_revenue: toNumber(summary.gross_revenue),
                collected_revenue: collectedRevenue,
                at_risk_revenue: toNumber(summary.at_risk_revenue),
                total_orders: toNumber(summary.total_orders),
                completed_orders: completedOrders,
                pending_orders: toNumber(summary.pending_orders),
                failed_orders: toNumber(summary.failed_orders),
                average_order_value: completedOrders > 0 ? collectedRevenue / completedOrders : 0
            },
            sales_trend: salesTrendResult.recordset.map((item) => ({
                date: item.date,
                revenue: toNumber(item.revenue),
                orders: toNumber(item.orders)
            })),
            profit_loss: profitLossResult.recordset.map((item) => ({
                year: toNumber(item.year),
                month: toNumber(item.month),
                profit: toNumber(item.profit),
                loss: toNumber(item.loss)
            })),
            top_products: topProductsResult.recordset.map((item) => ({
                name: item.product_name,
                quantity: toNumber(item.total_quantity),
                revenue: toNumber(item.total_revenue)
            })),
            revenue_by_branch: revenueByBranchResult.recordset.map((item) => ({
                branch: item.branch,
                revenue: toNumber(item.revenue),
                orders: toNumber(item.completed_orders)
            })),
            period: {
                start: periodStart.toISOString(),
                end: periodEnd.toISOString(),
                days,
                months,
                offset_days: offsetDays
            },
            generated_at: new Date().toISOString()
        });
    } catch (err) {
        console.error("Error fetching analytics report:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ... Similar updates for other endpoints ...


// Mock Data
const mockBlogPosts = [
    {
        id: 1,
        title: "The Future of Jewellery Management",
        excerpt: "Discover how digital tools are transforming the traditional jewellery business in Bangladesh.",
        date: "2023-10-25"
    },
    {
        id: 2,
        title: "Understanding Vori, Ana, and Roti",
        excerpt: "A deep dive into the local weight units used in Bangladeshi jewellery and how to calculate them accurately.",
        date: "2023-11-10"
    },
    {
        id: 3,
        title: "Why You Need a Specialized POS",
        excerpt: "Generic POS systems often fail in jewellery shops. Learn why a specialized solution like Gold Rush is essential.",
        date: "2023-11-20"
    }
];

// Routes

// GET /api/blog
app.get('/api/blog', (req, res) => {
    res.json(mockBlogPosts);
});

// GET /api/gold-forecast
app.get('/api/gold-forecast', async (req, res) => {
    try {
        const response = await axios.get('https://gold-forecast-api.onrender.com/predict');
        res.json(response.data);
    } catch (error) {
        console.error("Error fetching gold forecast:", error.message);
        res.status(500).json({ error: "Failed to fetch gold forecast" });
    }
});

// POST /api/crm/send-email
app.post('/api/crm/send-email', async (req, res) => {
    const { recipients, subject, message, shopownerId, userId } = req.body;

    if (!recipients || !subject || !message) {
        return res.status(400).json({ error: "Recipients, subject, and message are required" });
    }

    // In a real scenario, you might loop through recipients or use BCC
    // For this implementation, we will assume 'recipients' is an array of strings (emails)
    // or a single string (if just one).

    // If user sends "All VIP Customers", frontend should resolve that to a list of emails
    // But to keep it simple, let's assume the frontend sends the *actual* email addresses.

    try {
        const pool = await sql.connect();
        let resolvedShopName = 'Shop Name';
        let resolvedShopPhone = '';

        if (shopownerId) {
            const owner = await resolveShopownerProfile(pool, shopownerId);
            resolvedShopName = owner?.shop_name || owner?.full_name || resolvedShopName;
            resolvedShopPhone = owner?.phone || '';
        } else if (userId) {
            const ownerResult = await pool.request()
                .input('uid', sql.Int, Number(userId))
                .query(`
                    SELECT TOP 1 shop_name, full_name, phone
                    FROM shopowners
                    WHERE id = @uid
                `);
            const owner = ownerResult.recordset[0];
            resolvedShopName = owner?.shop_name || owner?.full_name || resolvedShopName;
            resolvedShopPhone = owner?.phone || '';
        }

        const to = Array.isArray(recipients) ? recipients.join(',') : recipients;
        const personalizedSubject = String(subject).replace(/\{\{\s*SHOP_NAME\s*\}\}/gi, resolvedShopName);
        const personalizedMessage = String(message).replace(/\{\{\s*SHOP_NAME\s*\}\}/gi, resolvedShopName);
        const messageBodyHtml = formatCampaignMessageToHtml(personalizedMessage);
        const campaignHtml = buildCrmCampaignEmailTemplate({
            shopName: resolvedShopName,
            subject: personalizedSubject,
            messageHtml: messageBodyHtml,
            shopPhone: resolvedShopPhone
        });

        await sendEmail(to, personalizedSubject, campaignHtml, resolvedShopName); // message can be HTML
        res.json({ message: "Email sent successfully" });
    } catch (error) {
        console.error("Error sending email:", error);
        const errorMessage = typeof error === 'string' ? error : (error?.message || "Failed to send email. Check server logs.");
        res.status(500).json({ error: errorMessage });
    }
});


// POST /api/contact
app.post('/api/contact', (req, res) => {
    const { name, phone, email } = req.body;
    console.log("------------------------------------------------");
    console.log("New Contact Form Submission:");
    console.log("Name:", name);
    console.log("Phone:", phone);
    console.log("Email:", email);
    console.log("------------------------------------------------");

    res.json({ message: "Query received successfully and logged on the server." });
});




// POST /api/auth/signup
app.post('/api/auth/signup', async (req, res) => {
    const { fullName, phone, identifier, password, latitude, longitude, shop_name, branch_count, tax_id } = req.body;
    const normalizedIdentifier = String(identifier || '').trim();
    const normalizedShopName = String(shop_name || '').trim();
    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);
    const parsedBranchCount = Number(branch_count) || 1;
    const { documents: normalizedDocuments, errors: documentErrors } = normalizeSignupDocuments(req.body.documents);

    // Validate Input
    if (!fullName || !phone || !normalizedIdentifier || !password || !Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) {
        return res.status(400).json({ error: "All fields are required, including shop location" });
    }
    if (documentErrors.length > 0) {
        return res.status(400).json({ error: documentErrors[0] });
    }
    if (normalizedDocuments.length === 0) {
        return res.status(400).json({
            error: 'Please upload at least one legal document.'
        });
    }

    try {
        const pool = await sql.connect(); // Ensure we have a connection

        // Backfill shopowner_id if missing
        await pool.request().query(`
            UPDATE shopowners 
            SET shopowner_id = 'SP-' + RIGHT('000' + CAST(id AS VARCHAR(10)), 3)
            WHERE shopowner_id IS NULL
        `);

        // Check if user exists
        const checkUserQuery = 'SELECT * FROM shopowners WHERE identifier = @identifier';
        const userExists = await pool.request()
            .input('identifier', sql.NVarChar, normalizedIdentifier)
            .query(checkUserQuery);

        if (userExists.recordset.length > 0) {
            return res.status(409).json({ error: "User already exists with this email/phone" });
        }

        const selectedPlan = 'free';
        const subscriptionStatus = 'pending';
        const accountApprovalStatus = 'pending';

        // Insert new user and read inserted ID from the same SQL scope.
        const insertUserQuery = `
            INSERT INTO shopowners (
                full_name, phone, identifier, password, latitude, longitude, shop_name, branch_count, tax_id,
                subscription_plan, subscription_status, account_approval_status, approval_requested_at
            )
            VALUES (
                @fullName, @phone, @identifier, @password, @latitude, @longitude, @shop_name, @branch_count, @tax_id,
                @subscription_plan, @subscription_status, @account_approval_status, GETDATE()
            );
            SELECT CAST(SCOPE_IDENTITY() AS INT) AS inserted_id;
        `;

        const request = pool.request()
            .input('fullName', sql.NVarChar, fullName)
            .input('phone', sql.NVarChar, phone)
            .input('identifier', sql.NVarChar, normalizedIdentifier)
            .input('password', sql.NVarChar, password)
            .input('latitude', sql.Float, parsedLatitude)
            .input('longitude', sql.Float, parsedLongitude)
            .input('shop_name', sql.NVarChar, normalizedShopName || null)
            .input('branch_count', sql.Int, parsedBranchCount)
            .input('tax_id', sql.NVarChar, tax_id || null)
            .input('subscription_plan', sql.NVarChar, selectedPlan)
            .input('subscription_status', sql.NVarChar, subscriptionStatus)
            .input('account_approval_status', sql.NVarChar, accountApprovalStatus);

        const insertResult = await request.query(insertUserQuery);
        const insertedUserId = Number(insertResult.recordset?.[0]?.inserted_id);
        if (!Number.isFinite(insertedUserId) || insertedUserId <= 0) {
            throw new Error('Failed to resolve newly inserted shop owner id');
        }

        // Fetch the newly created user
        const fetchUserQuery = `SELECT TOP 1 * FROM shopowners WHERE id = @id`;
        const fetchUserResult = await pool.request()
            .input('id', sql.Int, insertedUserId)
            .query(fetchUserQuery);

        const newUser = fetchUserResult.recordset[0];

        // Generate and Update shopowner_id
        const shopownerId = `SP-${String(newUser.id).padStart(3, '0')}`;
        await pool.request()
            .input('shopownerId', sql.NVarChar, shopownerId)
            .input('id', sql.Int, newUser.id)
            .query('UPDATE shopowners SET shopowner_id = @shopownerId WHERE id = @id');

        // Return the new ID in response
        newUser.shopowner_id = shopownerId;
        newUser.account_approval_status = accountApprovalStatus;

        for (const document of normalizedDocuments) {
            await pool.request()
                .input('shopowner_user_id', sql.Int, newUser.id)
                .input('shopowner_id', sql.NVarChar, shopownerId)
                .input('document_type', sql.NVarChar, document.documentType)
                .input('document_label', sql.NVarChar, document.documentLabel)
                .input('file_name', sql.NVarChar, document.fileName)
                .input('mime_type', sql.NVarChar, document.mimeType)
                .input('file_size_bytes', sql.BigInt, document.fileSizeBytes)
                .input('file_data', sql.NVarChar, document.fileData)
                .query(`
                    INSERT INTO shopowner_documents (
                        shopowner_user_id, shopowner_id, document_type, document_label,
                        file_name, mime_type, file_size_bytes, file_data, uploaded_at
                    )
                    VALUES (
                        @shopowner_user_id, @shopowner_id, @document_type, @document_label,
                        @file_name, @mime_type, @file_size_bytes, @file_data, GETDATE()
                    )
                `);
        }

        // Branch is provisioned only after Super Admin approval.

        // Ensure GL profile exists without failing signup on duplicate slug retries.
        try {
            await ensureGLShopProfile(pool, newUser.id);
        } catch (glProfileErr) {
            console.error("Non-fatal: failed to ensure GL shop profile during signup:", glProfileErr);
        }

        console.log("New User Registered:", newUser, "Plan:", selectedPlan, "Approval:", accountApprovalStatus);

        res.status(201).json({
            message: "User registered successfully",
            user: newUser,
            paymentUrl: null,
            awaiting_approval: true
        });

    } catch (err) {
        console.error("Error in signup:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Login Endpoint
app.post('/api/auth/signin', async (req, res) => {
    const { identifier, password } = req.body;
    console.log(`Login attempt for: ${identifier}`);

    if (!identifier || !password) {
        return res.status(400).json({ error: "Email/Phone and Password are required" });
    }

    // Super Admin Check
    if (identifier === 'sadmin' && password === 'sadmin') {
        console.log("Super Admin identified. Logging in.");
        return res.json({
            message: "Super Admin Login successful",
            user: {
                id: 0,
                full_name: "Super Admin",
                role: "superadmin"
            }
        });
    }

    try {
        const pool = await sql.connect();
        const result = await pool.request()
            .input('identifier', sql.NVarChar, identifier)
            .query('SELECT * FROM shopowners WHERE identifier = @identifier');

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        const user = result.recordset[0];

        if (user.subscription_status === 'deleted') {
            return res.status(403).json({ error: "Account has been deleted" });
        }

        const approvalStatus = String(user.account_approval_status || 'approved').trim().toLowerCase();
        if (approvalStatus === 'pending') {
            return res.status(403).json({ error: "Your account is waiting for Super Admin approval." });
        }
        if (approvalStatus === 'rejected') {
            const note = String(user.approval_note || '').trim();
            return res.status(403).json({
                error: note
                    ? `Your account submission was rejected: ${note}`
                    : "Your account submission was rejected by Super Admin."
            });
        }

        // Simple password comparison (User signup uses plain text currently)
        if (user.password !== password) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        res.json({
            message: "Login successful",
            user: user
        });

    } catch (err) {
        console.error("Error in signin:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Super Admin: Get All Users
app.get('/api/admin/users', async (req, res) => {
    try {
        const pool = await sql.connect();
        const result = await pool.request().query("SELECT * FROM shopowners ORDER BY id DESC");
        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Super Admin: Get User Branch/Product Details
app.get('/api/admin/users/:id/details', async (req, res) => {
    const { id } = req.params;
    const queryShopownerId = typeof req.query.shopownerId === 'string' ? req.query.shopownerId.trim() : '';
    const userId = Number(id);

    if (!Number.isInteger(userId)) {
        return res.status(400).json({ error: "Invalid user id" });
    }

    try {
        const pool = await sql.connect();
        let owner = {
            id: userId,
            shopowner_id: queryShopownerId || null,
            full_name: null,
            shop_name: null,
            identifier: null,
            phone: null,
            created_at: null,
            account_approval_status: null,
            approval_reviewed_at: null,
            approval_note: null
        };

        const ownerResult = await pool.request()
            .input('id', sql.Int, userId)
            .query(`
                SELECT id, shopowner_id, full_name, shop_name, identifier, phone, created_at, account_approval_status, approval_reviewed_at, approval_note
                FROM shopowners
                WHERE id = @id
            `);

        if (ownerResult.recordset.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        owner = ownerResult.recordset[0];
        if (queryShopownerId) owner.shopowner_id = queryShopownerId;

        const approvalStatus = String(owner.account_approval_status || 'approved').trim().toLowerCase();
        const isApprovedOwner = approvalStatus === 'approved';

        const ownerFilter = owner.shopowner_id
            ? '(shopowner_id = @sid OR user_id = @id)'
            : '(user_id = @id)';
        const documentOwnerFilter = owner.shopowner_id
            ? '(shopowner_user_id = @id OR shopowner_id = @sid)'
            : '(shopowner_user_id = @id)';

        const detailsRequest = pool.request().input('id', sql.Int, owner.id);
        if (owner.shopowner_id) {
            detailsRequest.input('sid', sql.NVarChar, owner.shopowner_id);
        }

        let branches = [];
        let products = [];
        let documents = [];

        if (isApprovedOwner) {
            const detailsResult = await detailsRequest.query(`
                SELECT id, name, location, status, created_at
                FROM branches
                WHERE ${ownerFilter}
                ORDER BY created_at DESC;

                SELECT id, name, category, karat, price, stock_quantity, branch, product_code, status, created_at
                FROM products
                WHERE ${ownerFilter}
                ORDER BY created_at DESC;

                SELECT id, document_type, document_label, file_name, mime_type, file_size_bytes, uploaded_at
                FROM shopowner_documents
                WHERE ${documentOwnerFilter}
                ORDER BY uploaded_at DESC, id DESC;
            `);

            branches = detailsResult.recordsets?.[0] || [];
            products = detailsResult.recordsets?.[1] || [];
            documents = detailsResult.recordsets?.[2] || [];
        } else {
            const documentsResult = await detailsRequest.query(`
                SELECT id, document_type, document_label, file_name, mime_type, file_size_bytes, uploaded_at
                FROM shopowner_documents
                WHERE ${documentOwnerFilter}
                ORDER BY uploaded_at DESC, id DESC;
            `);
            documents = documentsResult.recordset || [];
        }

        const totalStockQuantity = products.reduce((sum, product) => sum + (Number(product.stock_quantity) || 0), 0);
        const totalStockValue = products.reduce((sum, product) => (
            sum + ((Number(product.price) || 0) * (Number(product.stock_quantity) || 0))
        ), 0);

        res.json({
            user: owner,
            summary: {
                branchCount: branches.length,
                productCount: products.length,
                totalStockQuantity,
                totalStockValue
            },
            branches,
            products,
            documents
        });
    } catch (err) {
        console.error("Error fetching admin user details:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Super Admin: Get Single Document Payload For Preview
app.get('/api/admin/users/:id/documents/:documentId', async (req, res) => {
    const { id, documentId } = req.params;
    const queryShopownerId = typeof req.query.shopownerId === 'string' ? req.query.shopownerId.trim() : '';
    const userId = Number(id);
    const parsedDocumentId = Number(documentId);

    if (!Number.isInteger(userId) || !Number.isInteger(parsedDocumentId)) {
        return res.status(400).json({ error: "Invalid id" });
    }

    try {
        const pool = await sql.connect();
        const ownerResult = await pool.request()
            .input('id', sql.Int, userId)
            .query(`
                SELECT id, shopowner_id
                FROM shopowners
                WHERE id = @id
            `);

        if (ownerResult.recordset.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        const owner = ownerResult.recordset[0];
        const resolvedShopownerId = queryShopownerId || owner.shopowner_id || null;
        const documentOwnerFilter = resolvedShopownerId
            ? '(shopowner_user_id = @id OR shopowner_id = @sid)'
            : '(shopowner_user_id = @id)';

        const request = pool.request()
            .input('id', sql.Int, userId)
            .input('documentId', sql.Int, parsedDocumentId);

        if (resolvedShopownerId) {
            request.input('sid', sql.NVarChar, resolvedShopownerId);
        }

        const documentResult = await request.query(`
            SELECT TOP 1 id, document_type, document_label, file_name, mime_type, file_size_bytes, file_data, uploaded_at
            FROM shopowner_documents
            WHERE id = @documentId
              AND ${documentOwnerFilter}
        `);

        if (documentResult.recordset.length === 0) {
            return res.status(404).json({ error: "Document not found" });
        }

        return res.json(documentResult.recordset[0]);
    } catch (err) {
        console.error("Error fetching admin document preview:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// Super Admin: Delete Branch
app.delete('/api/admin/branches/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await sql.connect();
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM branches WHERE id = @id');

        if ((result.rowsAffected?.[0] || 0) === 0) {
            return res.status(404).json({ error: "Branch not found" });
        }

        res.json({ message: "Branch deleted successfully" });
    } catch (err) {
        console.error("Error deleting admin branch:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Super Admin: Delete Product
app.delete('/api/admin/products/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await sql.connect();
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM products WHERE id = @id');

        if ((result.rowsAffected?.[0] || 0) === 0) {
            return res.status(404).json({ error: "Product not found" });
        }

        res.json({ message: "Product deleted successfully" });
    } catch (err) {
        console.error("Error deleting admin product:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Super Admin: Update User
app.put('/api/admin/users/:id', async (req, res) => {
    const { id } = req.params;
    const { subscription_plan, subscription_status, subscription_end_date, account_approval_status, approval_note } = req.body;
    const parsedUserId = Number(id);
    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
        return res.status(400).json({ error: "Invalid user id" });
    }

    const normalizedApprovalStatus = String(account_approval_status || '').trim().toLowerCase();
    if (normalizedApprovalStatus && !['pending', 'approved', 'rejected'].includes(normalizedApprovalStatus)) {
        return res.status(400).json({ error: "Invalid approval status" });
    }

    try {
        const pool = await sql.connect();
        const existingResult = await pool.request()
            .input('id', sql.Int, parsedUserId)
            .query(`
                SELECT TOP 1
                    id, subscription_plan, subscription_status, subscription_end_date,
                    account_approval_status, approval_reviewed_at, approval_note,
                    shopowner_id, shop_name, full_name
                FROM shopowners
                WHERE id = @id
            `);

        if (existingResult.recordset.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        const existingUser = existingResult.recordset[0];
        const previousApprovalStatus = String(existingUser.account_approval_status || 'approved').trim().toLowerCase();
        const nextApprovalStatus = normalizedApprovalStatus || previousApprovalStatus;
        const approvalStatusChanged = nextApprovalStatus !== previousApprovalStatus;

        let nextPlan = String(subscription_plan || existingUser.subscription_plan || 'free').trim().toLowerCase();
        let nextSubscriptionStatus = String(subscription_status || existingUser.subscription_status || 'pending').trim().toLowerCase();
        let nextEndDate = subscription_end_date || existingUser.subscription_end_date || null;
        let nextReviewedAt = approvalStatusChanged ? new Date() : existingUser.approval_reviewed_at || null;
        const nextApprovalNote = String(approval_note ?? existingUser.approval_note ?? '').trim() || null;
        let trialGranted = false;

        if (nextApprovalStatus === 'approved') {
            if (previousApprovalStatus !== 'approved') {
                const trialEndDate = new Date();
                trialEndDate.setDate(trialEndDate.getDate() + 7);
                nextPlan = 'free';
                nextSubscriptionStatus = 'active';
                nextEndDate = trialEndDate;
                trialGranted = true;
            } else if (!nextEndDate && nextPlan === 'free' && nextSubscriptionStatus === 'active') {
                const trialEndDate = new Date();
                trialEndDate.setDate(trialEndDate.getDate() + 7);
                nextEndDate = trialEndDate;
            }
        } else if (nextApprovalStatus === 'pending') {
            nextSubscriptionStatus = 'pending';
            nextEndDate = null;
            nextReviewedAt = null;
        } else if (nextApprovalStatus === 'rejected') {
            nextSubscriptionStatus = 'pending';
            nextEndDate = null;
        }

        await pool.request()
            .input('id', sql.Int, parsedUserId)
            .input('plan', sql.NVarChar, nextPlan)
            .input('status', sql.NVarChar, nextSubscriptionStatus)
            .input('end_date', sql.DateTime, nextEndDate || null)
            .input('approval_status', sql.NVarChar, nextApprovalStatus)
            .input('approval_reviewed_at', sql.DateTime, nextReviewedAt || null)
            .input('approval_note', sql.NVarChar, nextApprovalNote)
            .query(`
                UPDATE shopowners
                SET subscription_plan = @plan,
                    subscription_status = @status,
                    subscription_end_date = @end_date,
                    account_approval_status = @approval_status,
                    approval_reviewed_at = @approval_reviewed_at,
                    approval_note = @approval_note
                WHERE id = @id
            `);

        if (nextApprovalStatus === 'approved') {
            await ensureOwnerMainBranch(pool, {
                userId: parsedUserId,
                shopownerId: existingUser.shopowner_id,
                shopName: existingUser.shop_name,
                fullName: existingUser.full_name
            });
        }

        res.json({ message: "User updated successfully", trial_granted: trialGranted });
    } catch (err) {
        console.error("Error updating user:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Super Admin: Delete User (HARD DELETE - Cleans up all related data)
app.delete('/api/admin/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await sql.connect();

        // 1. Get Shop Owner details
        const userRes = await pool.request()
            .input('id', sql.Int, id)
            .query("SELECT id, shopowner_id FROM shopowners WHERE id = @id");

        if (userRes.recordset.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        const user = userRes.recordset[0];
        const shopownerId = user.shopowner_id;
        const userId = user.id; // Int ID

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const request = new sql.Request(transaction);
            request.input('id', sql.Int, userId);
            request.input('sid', sql.NVarChar, shopownerId || null);
            request.input('idText', sql.NVarChar, String(userId));

            console.log(`Deleting user ${userId} (${shopownerId})...`);

            if (shopownerId) {
                // --- Level 3: Grandchildren (Delete items linked to sales/orders) ---
                // Delete Sale Items - KEY FIX: Check both IDs to catch legacy data
                await request.query(`
                    DELETE FROM sale_items 
                    WHERE sale_id IN (
                        SELECT id FROM sales 
                        WHERE shopowner_id = @sid OR user_id = @id
                    )
                `);

                // Delete Installment Payments
                await request.query(`
                    DELETE FROM installment_payments 
                    WHERE installment_id IN (
                        SELECT id FROM installments 
                        WHERE shopowner_id = @sid OR user_id = @id
                    )
                `);

                // Delete Repair Orders (linked to Customers)
                await request.query(`
                    DELETE FROM repair_orders 
                    WHERE customer_id IN (
                        SELECT id FROM customers
                        WHERE shopowner_id = @sid OR user_id = @id
                    )
                `);

                // --- Level 2: Children (Transactional Data) ---
                // Delete Sales for BOTH keys
                await request.query("DELETE FROM sales WHERE shopowner_id = @sid OR user_id = @id");

                // Delete Installments for BOTH keys
                await request.query("DELETE FROM installments WHERE shopowner_id = @sid OR user_id = @id");

                await request.query("DELETE FROM repair_tickets WHERE shopowner_id = @sid OR user_id = @id");
                await request.query("DELETE FROM manufacturing_orders WHERE shopowner_id = @sid OR user_id = @id");
                await request.query("DELETE FROM stock_transfers WHERE shopowner_id = @sid OR user_id = @id");
                await request.query("DELETE FROM staff WHERE shopowner_id = @sid OR user_id = @id");
                await request.query("IF OBJECT_ID('shopowner_documents', 'U') IS NOT NULL DELETE FROM shopowner_documents WHERE shopowner_id = @sid OR shopowner_user_id = @id");

                // --- Level 2.5: Product Dependents ---
                await request.query(`
                    DELETE FROM ${GL_CART_TABLE}
                    WHERE product_id IN (
                        SELECT id FROM products
                        WHERE shopowner_id = @sid OR user_id = @id
                    )
                `);
                await request.query(`
                    DELETE FROM ${GL_REVIEWS_TABLE}
                    WHERE product_id IN (
                        SELECT id FROM products
                        WHERE shopowner_id = @sid OR user_id = @id
                    )
                `);


                // --- Level 2: Catalog Data ---
                await request.query("DELETE FROM products WHERE shopowner_id = @sid OR user_id = @id");
                await request.query("DELETE FROM customers WHERE shopowner_id = @sid OR user_id = @id");
                await request.query("DELETE FROM branches WHERE shopowner_id = @sid OR user_id = @id");
            }

            // --- Level 1: integer ID based links ---
            // Cleanup Gold-Lagbe chat data by owner code and legacy numeric-text owner ID.
            await request.query(`
                IF OBJECT_ID('${GL_MESSAGES_TABLE}', 'U') IS NOT NULL
                   AND OBJECT_ID('${GL_CONVERSATIONS_TABLE}', 'U') IS NOT NULL
                BEGIN
                    DELETE FROM ${GL_MESSAGES_TABLE}
                    WHERE conversation_id IN (
                        SELECT id
                        FROM ${GL_CONVERSATIONS_TABLE}
                        WHERE shopowner_id = @idText
                           OR (@sid IS NOT NULL AND shopowner_id = @sid)
                    );

                    DELETE FROM ${GL_CONVERSATIONS_TABLE}
                    WHERE shopowner_id = @idText
                       OR (@sid IS NOT NULL AND shopowner_id = @sid);
                END
            `);

            // GL_* cleanup: support both cross-db tables and legacy local dbo tables.
            await request.query(`
                IF OBJECT_ID('${GL_ORDER_ITEMS_TABLE}', 'U') IS NOT NULL
                   AND OBJECT_ID('${GL_ORDERS_TABLE}', 'U') IS NOT NULL
                BEGIN
                    DELETE FROM ${GL_ORDER_ITEMS_TABLE}
                    WHERE order_id IN (SELECT id FROM ${GL_ORDERS_TABLE} WHERE shopowner_id = @id);

                    DELETE FROM ${GL_ORDERS_TABLE}
                    WHERE shopowner_id = @id;
                END

                IF OBJECT_ID('${GL_SHOP_PROFILES_TABLE}', 'U') IS NOT NULL
                BEGIN
                    DELETE FROM ${GL_SHOP_PROFILES_TABLE}
                    WHERE shopowner_id = @id;
                END

                IF OBJECT_ID('dbo.GL_OrderItems', 'U') IS NOT NULL
                   AND OBJECT_ID('dbo.GL_Orders', 'U') IS NOT NULL
                BEGIN
                    DELETE FROM dbo.GL_OrderItems
                    WHERE order_id IN (SELECT id FROM dbo.GL_Orders WHERE shopowner_id = @id);

                    DELETE FROM dbo.GL_Orders
                    WHERE shopowner_id = @id;
                END

                IF OBJECT_ID('dbo.GL_ShopProfiles', 'U') IS NOT NULL
                BEGIN
                    DELETE FROM dbo.GL_ShopProfiles
                    WHERE shopowner_id = @id;
                END
            `);

            // Clean up any orphans by user_id if they exist
            await request.query("DELETE FROM staff WHERE user_id = @id");
            await request.query("DELETE FROM repair_tickets WHERE user_id = @id");
            await request.query("DELETE FROM manufacturing_orders WHERE user_id = @id");
            await request.query("DELETE FROM stock_transfers WHERE user_id = @id");
            await request.query("DELETE FROM customers WHERE user_id = @id");
            await request.query("DELETE FROM sales WHERE user_id = @id");
            await request.query("DELETE FROM installments WHERE user_id = @id");
            await request.query("DELETE FROM products WHERE user_id = @id");
            await request.query("DELETE FROM branches WHERE user_id = @id");
            await request.query("IF OBJECT_ID('shopowner_documents', 'U') IS NOT NULL DELETE FROM shopowner_documents WHERE shopowner_user_id = @id");

            // --- Final: Delete User ---
            await request.query("DELETE FROM shopowners WHERE id = @id");

            await transaction.commit();
            console.log("Delete successful.");
            res.json({ message: "User and all related data permanently deleted." });
        } catch (err) {
            console.error("Transaction failed, rolling back.", err);
            await transaction.rollback();
            throw err;
        }

    } catch (err) {
        console.error("Error deleting user:", err);
        res.status(500).json({ error: "Internal Server Error: " + err.message });
    }
});

// Update Subscription Plan
app.post('/api/subscription/update', async (req, res) => {
    const { shopownerId, plan, amount } = req.body;
    const planAmount = amount || 0;

    if (!shopownerId || !plan) {
        return res.status(400).json({ error: "Shop Owner ID and Plan are required" });
    }

    try {
        const pool = await sql.connect();

        // Find user by shopownerId
        const userRes = await pool.request().input('sid', sql.NVarChar, shopownerId).query('SELECT * FROM shopowners WHERE shopowner_id = @sid');

        if (userRes.recordset.length === 0) {
            return res.status(404).json({ error: "Shop Owner not found" });
        }

        const user = userRes.recordset[0];
        const userId = user.id;

        let subscriptionStatus = 'active'; // Default active for free
        let endDate = new Date();

        if (plan === 'free') {
            endDate.setDate(endDate.getDate() + 7); // 7 days trial
        } else if (plan === 'monthly') {
            // For paid, status pending until payment success
            subscriptionStatus = 'pending';
            // Date will be set on payment success, but we can preset it or leave null
            endDate = null;
        } else if (plan === 'yearly') {
            subscriptionStatus = 'pending';
            endDate = null;
        } else if (plan === 'lifetime') {
            subscriptionStatus = 'pending';
            endDate = null; // or far future on success
        }

        // Update User
        // If free, set date immediately. If pending, keep date null or current? 
        // Better to not touch date if pending, or set it only if free.

        let updateQuery = `
                 UPDATE shopowners 
                 SET subscription_plan = @plan, subscription_status = @status 
        `;

        if (plan === 'free') {
            updateQuery += `, subscription_end_date = @endDate `;
        }

        updateQuery += ` WHERE id = @userId `;

        const dbRequest = pool.request()
            .input('userId', sql.Int, userId)
            .input('plan', sql.NVarChar, plan)
            .input('status', sql.NVarChar, subscriptionStatus);

        if (plan === 'free') {
            dbRequest.input('endDate', sql.DateTime, endDate);
        }

        await dbRequest.query(updateQuery);

        let paymentUrl = null;

        if (plan !== 'free' && planAmount > 0 && user) {
            try {
                const tran_id = `SUB-${uuidv4()}`;
                const apiBaseUrl = getApiBaseUrl(req);
                const clientUrl = getClientUrl(req);
                const redirectParam = encodeURIComponent(clientUrl);
                const paymentData = {
                    total_amount: planAmount,
                    currency: 'BDT',
                    tran_id: tran_id,
                    success_url: `${apiBaseUrl}/api/payment/success/${tran_id}?redirect=${redirectParam}`,
                    fail_url: `${apiBaseUrl}/api/payment/fail/${tran_id}?redirect=${redirectParam}`,
                    cancel_url: `${apiBaseUrl}/api/payment/cancel/${tran_id}?redirect=${redirectParam}`,
                    ipn_url: `${apiBaseUrl}/api/payment/ipn`,
                    shipping_method: 'Courier',
                    product_name: `${plan} Subscription`,
                    product_category: 'Service',
                    product_profile: 'general',
                    cus_name: user.full_name,
                    cus_email: user.identifier,
                    cus_add1: 'Dhaka',
                    cus_add2: 'Dhaka',
                    cus_city: 'Dhaka',
                    cus_state: 'Dhaka',
                    cus_postcode: '1000',
                    cus_country: 'Bangladesh',
                    cus_phone: user.phone,
                    cus_fax: user.phone,
                    ship_name: user.full_name,
                    ship_add1: 'Dhaka',
                    ship_add2: 'Dhaka',
                    ship_city: 'Dhaka',
                    ship_state: 'Dhaka',
                    ship_postcode: 1000,
                    ship_country: 'Bangladesh',
                };

                const sslcz = new SSLCommerzPayment(
                    process.env.STORE_ID || 'testbox',
                    process.env.STORE_PASSWORD || 'qwerty',
                    process.env.IS_LIVE === 'true'
                );
                const apiResponse = await sslcz.init(paymentData);

                if (apiResponse?.GatewayPageURL) {
                    paymentUrl = apiResponse.GatewayPageURL;
                    // Log transaction
                    await pool.request()
                        .input('planAmount', sql.Decimal(18, 2), planAmount)
                        .input('tran_id', sql.NVarChar, tran_id)
                        .input('shopownerId', sql.NVarChar, shopownerId)
                        .query(`
                        INSERT INTO sales (total_amount, tax_amount, final_amount, payment_method, transaction_id, status, branch, shopowner_id)
                        VALUES (@planAmount, 0, @planAmount, 'Online', @tran_id, 'Pending', 'Subscription', @shopownerId)
                    `);
                } else {
                    console.error("SSLCommerz Init Failed", apiResponse);
                }
            } catch (paymentError) {
                console.error("Payment Init Error:", paymentError);
            }
        }

        res.json({ success: true, paymentUrl });

    } catch (err) {
        console.error("Subscription update error:", err);
        res.status(500).json({ error: "Server error" });
    }
});
// POST /api/auth/google
app.post('/api/auth/google', async (req, res) => {
    const { email, fullName, photoURL } = req.body;

    if (!email) {
        return res.status(400).json({ error: "Email is required" });
    }

    try {
        const pool = await sql.connect();

        // Check if user exists
        const checkUserQuery = 'SELECT * FROM shopowners WHERE identifier = @identifier';
        const userExists = await pool.request()
            .input('identifier', sql.NVarChar, email)
            .query(checkUserQuery);

        if (userExists.recordset.length > 0) {
            // User exists, return user info
            const user = userExists.recordset[0];
            const approvalStatus = String(user.account_approval_status || 'approved').trim().toLowerCase();
            if (approvalStatus === 'pending') {
                return res.status(403).json({ error: "Your account is waiting for Super Admin approval." });
            }
            if (approvalStatus === 'rejected') {
                return res.status(403).json({ error: "Your account submission was rejected. Please contact Super Admin." });
            }
            if (String(user.subscription_status || '').toLowerCase() === 'deleted') {
                return res.status(403).json({ error: "Account has been deleted" });
            }
            return res.json({
                message: "Logged in with Google",
                user: user
            });
        }

        res.status(403).json({
            error: "Google signup is disabled for new shops. Use regular signup and upload required legal documents."
        });

    } catch (err) {
        console.error("Error in google auth:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});




// PUT /api/inventory/:id
app.put('/api/inventory/:id', async (req, res) => {
    const { id } = req.params;
    const { name, category, karat, weight, price, stock_quantity, image_url, is_marketplace_live } = req.body;

    try {
        const pool = await sql.connect();
        await ensureProductMarketplaceLiveSchema(pool);
        const existingRes = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT TOP 1 stock_quantity, is_marketplace_live FROM products WHERE id = @id');

        if (existingRes.recordset.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }

        const currentStockQuantity = normalizeInventoryQuantity(existingRes.recordset[0].stock_quantity);
        const normalizedStockQuantity = (stock_quantity === undefined || stock_quantity === null || stock_quantity === '')
            ? currentStockQuantity
            : normalizeInventoryQuantity(stock_quantity);
        const normalizedStatus = deriveInventoryStatus(normalizedStockQuantity);
        const currentMarketplaceLive = Number(existingRes.recordset[0].is_marketplace_live) === 0 ? 0 : 1;
        const normalizedMarketplaceLive = (is_marketplace_live === undefined || is_marketplace_live === null || is_marketplace_live === '')
            ? currentMarketplaceLive
            : (String(is_marketplace_live).toLowerCase() === 'false' || String(is_marketplace_live) === '0' ? 0 : 1);

        const updateQuery = `
            UPDATE products
            SET 
                name = @name, 
                category = @category, 
                karat = @karat, 
                weight = @weight, 
                price = @price, 
                stock_quantity = @stock_quantity, 
                image_url = @image_url,
                status = @status,
                is_marketplace_live = @is_marketplace_live
            OUTPUT INSERTED.*
            WHERE id = @id
        `;

        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('name', sql.NVarChar, name)
            .input('category', sql.NVarChar, category || null)
            .input('karat', sql.NVarChar, karat || null)
            .input('weight', sql.Decimal(10, 2), weight || 0)
            .input('price', sql.Decimal(18, 2), price)
            .input('stock_quantity', sql.Int, normalizedStockQuantity)
            .input('image_url', sql.NVarChar, image_url || null)
            .input('status', sql.NVarChar, normalizedStatus)
            .input('is_marketplace_live', sql.Bit, normalizedMarketplaceLive)
            .query(updateQuery);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }

        res.json(result.recordset[0]);
    } catch (err) {
        console.error("Error updating product:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// DELETE /api/inventory/:id
app.delete('/api/inventory/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await sql.connect();
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM products WHERE id = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: "Product not found" });
        }

        res.json({ message: "Product deleted successfully" });
    } catch (err) {
        console.error("Error deleting product:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// GET /api/installments
app.get('/api/installments', async (req, res) => {
    const branch = req.query.branch || 'Main Branch';
    const { shopownerId } = req.query;

    try {
        const pool = await sql.connect();

        let query = `
            SELECT i.*, c.name as customer_name, c.phone as customer_phone
            FROM installments i
            LEFT JOIN customers c ON i.customer_id = c.id
            LEFT JOIN shopowners u ON i.shopowner_id = u.shopowner_id
            WHERE i.branch = @branch
        `;

        const request = pool.request().input('branch', sql.NVarChar, branch);

        if (shopownerId) {
            query += ' AND i.shopowner_id = @shopownerId';
            request.input('shopownerId', sql.NVarChar, shopownerId);
        }

        query += ' ORDER BY i.created_at DESC';

        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching installments:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST /api/installments
app.post('/api/installments', async (req, res) => {
    const { customer_id, item_description, total_amount, paid_amount, due_date, branch, shopownerId } = req.body;
    try {
        const pool = await sql.connect();

        await pool.request()
            .input('customer_id', sql.Int, customer_id)
            .input('item_description', sql.NVarChar, item_description)
            .input('total_amount', sql.Decimal(18, 2), total_amount)
            .input('paid_amount', sql.Decimal(18, 2), paid_amount || 0)
            .input('due_date', sql.Date, due_date)
            .input('branch', sql.NVarChar, branch || 'Main Branch')
            .input('shopowner_id', sql.NVarChar, shopownerId || null)
            .query(`
                INSERT INTO installments (customer_id, item_description, total_amount, paid_amount, due_date, status, branch, shopowner_id)
                VALUES (@customer_id, @item_description, @total_amount, @paid_amount, @due_date, 'Active', @branch, @shopowner_id)
            `);
        res.json({ message: "Installment plan created" });
    } catch (err) {
        console.error("Error creating installment:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// GET /api/installments/:id/payments
app.get('/api/installments/:id/payments', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await sql.connect();
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT * FROM installment_payments WHERE installment_id = @id ORDER BY payment_date DESC');
        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching payments:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST /api/installments/:id/payments
app.post('/api/installments/:id/payments', async (req, res) => {
    const { id } = req.params;
    const { amount, payment_method, notes } = req.body;
    try {
        const pool = await sql.connect();

        // 1. Insert Payment
        await pool.request()
            .input('installment_id', sql.Int, id)
            .input('amount', sql.Decimal(18, 2), amount)
            .input('payment_method', sql.NVarChar, payment_method)
            .input('notes', sql.NVarChar, notes)
            .query(`
                INSERT INTO installment_payments (installment_id, amount, payment_method, notes)
                VALUES (@installment_id, @amount, @payment_method, @notes)
            `);

        // 2. Update Parent Installment (Paid Amount & Status)
        await pool.request()
            .input('id', sql.Int, id)
            .input('amount', sql.Decimal(18, 2), amount)
            .query(`
                UPDATE installments 
                SET paid_amount = paid_amount + @amount,
                    status = CASE WHEN (paid_amount + @amount) >= total_amount THEN 'Completed' ELSE status END
                WHERE id = @id
            `);

        res.json({ message: "Payment recorded successfully" });
    } catch (err) {
        console.error("Error recording payment:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// GET /api/customers
app.get('/api/customers', async (req, res) => {
    const branch = req.query.branch || 'Main Branch';
    const { shopownerId, userId } = req.query;
    try {
        const pool = await sql.connect();

        let query = 'SELECT * FROM customers WHERE branch = @branch';
        const request = pool.request().input('branch', sql.NVarChar, branch);

        if (shopownerId) {
            query += ' AND shopowner_id = @shopownerId';
            request.input('shopownerId', sql.NVarChar, shopownerId);
        } else if (userId) {
            const userRes = await pool.request()
                .input('uid', sql.Int, Number(userId))
                .query("SELECT shopowner_id FROM shopowners WHERE id = @uid");
            const resolvedShopownerId = userRes.recordset.length > 0 ? userRes.recordset[0].shopowner_id : null;
            if (resolvedShopownerId) {
                query += ' AND shopowner_id = @shopownerId';
                request.input('shopownerId', sql.NVarChar, resolvedShopownerId);
            }
        }

        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching customers:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST /api/customers
app.post('/api/customers', async (req, res) => {
    const { name, phone, email, type, total_spent, last_visit, branch, shopownerId } = req.body;
    try {
        const pool = await sql.connect();

        // Ensure email column exists (Temporary fix: check on every insert to be safe since startup check might have failed)
        try {
            await pool.request().query("IF COL_LENGTH('customers', 'email') IS NULL ALTER TABLE customers ADD email NVARCHAR(255) NULL;");
        } catch (e) { console.error("Schema sync error:", e); }

        if (phone) {
            const existing = await pool.request()
                .input('phone', sql.NVarChar, phone)
                .query('SELECT TOP 1 * FROM customers WHERE phone = @phone');
            if (existing.recordset.length > 0) {
                return res.status(409).json({
                    error: 'Customer with this phone already exists',
                    customer: existing.recordset[0]
                });
            }
        }

        const insertQuery = `
            INSERT INTO customers (name, phone, email, type, total_spent, last_visit, branch, shopowner_id)
            OUTPUT INSERTED.*
            VALUES (@name, @phone, @email, @type, @total_spent, @last_visit, @branch, @shopowner_id)
        `;
        const result = await pool.request()
            .input('name', sql.NVarChar, name)
            .input('phone', sql.NVarChar, phone)
            .input('email', sql.NVarChar, email || null)
            .input('type', sql.NVarChar, type || 'New')
            .input('total_spent', sql.Decimal(18, 2), total_spent || 0)
            .input('last_visit', sql.DateTime, last_visit || new Date())
            .input('branch', sql.NVarChar, branch || 'Main Branch')
            .input('shopowner_id', sql.NVarChar, shopownerId || null)
            .query(insertQuery);

        res.status(201).json(result.recordset[0]);
    } catch (err) {
        console.error("Error creating customer:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// PUT /api/customers/:id
app.put('/api/customers/:id', async (req, res) => {
    const { id } = req.params;
    const { type, name, phone, email } = req.body;
    try {
        const pool = await sql.connect();
        let query = 'UPDATE customers SET ';
        const updates = [];
        if (type) updates.push("type = @type");
        if (name) updates.push("name = @name");
        if (phone) updates.push("phone = @phone");
        if (email !== undefined) updates.push("email = @email");

        if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });

        query += updates.join(", ");
        query += " OUTPUT INSERTED.* WHERE id = @id";

        const request = pool.request().input('id', sql.Int, id);
        if (type) request.input('type', sql.NVarChar, type);
        if (name) request.input('name', sql.NVarChar, name);
        if (phone) request.input('phone', sql.NVarChar, phone);
        if (email !== undefined) request.input('email', sql.NVarChar, email);

        const result = await request.query(query);

        if (result.recordset.length === 0) return res.status(404).json({ error: "Customer not found" });

        res.json(result.recordset[0]);
    } catch (err) {
        console.error("Error updating customer:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// DELETE /api/customers/:id
app.delete('/api/customers/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await sql.connect();
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM customers WHERE id = @id');

        if (result.rowsAffected[0] === 0) return res.status(404).json({ error: "Customer not found" });

        res.json({ message: "Customer deleted successfully" });
    } catch (err) {
        console.error("Error deleting customer:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});



// ... existing code ...



// GET /api/sales/:id
app.get('/api/sales/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await sql.connect();

        // Fetch Sale Details
        const saleResult = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT * FROM sales WHERE id = @id');

        if (saleResult.recordset.length === 0) {
            return res.status(404).json({ error: "Sale not found" });
        }

        // Fetch Sale Items
        const itemsResult = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT si.*, p.name as product_name, p.image_url, p.product_code
                FROM sale_items si
                LEFT JOIN products p ON si.product_id = p.id
                WHERE si.sale_id = @id
            `);

        res.json({
            sale: saleResult.recordset[0],
            items: itemsResult.recordset
        });
    } catch (err) {
        console.error("Error fetching sale details:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// DELETE /api/sales/:id
app.delete('/api/sales/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await sql.connect();
        // Delete items first (foreign key constraint)
        await pool.request().input('id', sql.Int, id).query('DELETE FROM sale_items WHERE sale_id = @id');
        // Delete sale
        await pool.request().input('id', sql.Int, id).query('DELETE FROM sales WHERE id = @id');

        res.json({ message: "Sale record deleted" });
    } catch (err) {
        console.error("Error deleting sale:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// PUT /api/sales/:id
app.put('/api/sales/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const pool = await sql.connect();
        await pool.request()
            .input('id', sql.Int, id)
            .input('status', sql.NVarChar, status)
            .query('UPDATE sales SET status = @status WHERE id = @id');
        res.json({ message: "Sale status updated" });
    } catch (err) {
        console.error("Error updating sale:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST /api/payment/init
app.post('/api/payment/init', async (req, res) => {
    const { cart, paymentMethod, shopownerId, userId, branch } = req.body;

    if (!cart || cart.length === 0) {
        return res.status(400).json({ error: "Cart is empty" });
    }

    try {
        console.log("Initiating Payment...");
        console.log("Store ID:", process.env.STORE_ID);

        const total_amount = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
        const tax_amount = total_amount * 0.05;
        const final_amount = total_amount + tax_amount;
        const tran_id = uuidv4();

        const pool = await sql.connect();

        let resolvedUserId = userId || null;
        let resolvedShopownerId = shopownerId || null;

        if (!resolvedShopownerId && resolvedUserId) {
            const shopownerRes = await pool.request()
                .input('uid', sql.Int, resolvedUserId)
                .query("SELECT shopowner_id FROM shopowners WHERE id = @uid");
            if (shopownerRes.recordset.length > 0) {
                resolvedShopownerId = shopownerRes.recordset[0].shopowner_id;
            }
        }

        if (!resolvedUserId && resolvedShopownerId) {
            const userRes = await pool.request()
                .input('sid', sql.NVarChar, resolvedShopownerId)
                .query("SELECT id FROM shopowners WHERE shopowner_id = @sid");
            if (userRes.recordset.length > 0) {
                resolvedUserId = userRes.recordset[0].id;
            }
        }

        // Determine status and method based on input
        const isCash = paymentMethod === 'Cash';
        const saleStatus = isCash ? 'Completed' : 'Pending';
        const method = isCash ? 'Cash' : 'SSLCommerz';

        // Insert Sale (Using shopowner_id, skipping user_id)
        const saleInsert = await pool.request()
            .input('total_amount', sql.Decimal(18, 2), total_amount)
            .input('tax_amount', sql.Decimal(18, 2), tax_amount)
            .input('final_amount', sql.Decimal(18, 2), final_amount)
            .input('payment_method', sql.NVarChar, method)
            .input('transaction_id', sql.NVarChar, tran_id)
            .input('status', sql.NVarChar, saleStatus)
            .input('branch', sql.NVarChar, branch || 'Main Branch')
            .input('user_id', sql.Int, resolvedUserId)
            .input('shopowner_id', sql.NVarChar, resolvedShopownerId)
            .query(`
                INSERT INTO sales (total_amount, tax_amount, final_amount, payment_method, transaction_id, status, branch, user_id, shopowner_id)
                OUTPUT INSERTED.id
                VALUES (@total_amount, @tax_amount, @final_amount, @payment_method, @transaction_id, @status, @branch, @user_id, @shopowner_id)
            `);

        const sale_id = saleInsert.recordset[0].id;
        console.log("Sale Created, ID:", sale_id);

        // Insert Sale Items
        for (const item of cart) {
            await pool.request()
                .input('sale_id', sql.Int, sale_id)
                .input('product_id', sql.Int, item.id)
                .input('quantity', sql.Int, item.qty)
                .input('price_at_sale', sql.Decimal(18, 2), item.price)
                .input('total_price', sql.Decimal(18, 2), item.price * item.qty)
                .query(`
                    INSERT INTO sale_items (sale_id, product_id, quantity, price_at_sale, total_price)
                    VALUES (@sale_id, @product_id, @quantity, @price_at_sale, @total_price)
                `);
        }

        // If Cash, return success immediately
        if (isCash) {
            await applyStockDeduction(pool, cart);
            return res.json({
                message: "Cash payment recorded successfully",
                success: true,
                tran_id: tran_id
            });
        }

        // Init SSLCommerz for Online Payment
        const apiBaseUrl = getApiBaseUrl(req);
        const clientUrl = getClientUrl(req);
        const redirectParam = encodeURIComponent(clientUrl);
        const data = {
            total_amount: final_amount,
            currency: 'BDT',
            tran_id: tran_id,
            success_url: `${apiBaseUrl}/api/payment/success/${tran_id}?redirect=${redirectParam}`,
            fail_url: `${apiBaseUrl}/api/payment/fail/${tran_id}?redirect=${redirectParam}`,
            cancel_url: `${apiBaseUrl}/api/payment/cancel/${tran_id}?redirect=${redirectParam}`,
            ipn_url: `${apiBaseUrl}/api/payment/ipn`,
            shipping_method: 'Courier',
            product_name: 'Jewelry Items',
            product_category: 'Jewelry',
            product_profile: 'general',
            cus_name: 'Walk-in Customer',
            cus_email: 'customer@example.com',
            cus_add1: 'Dhaka',
            cus_add2: 'Dhaka',
            cus_city: 'Dhaka',
            cus_state: 'Dhaka',
            cus_postcode: '1000',
            cus_country: 'Bangladesh',
            cus_phone: '01711111111',
            cus_fax: '01711111111',
            ship_name: 'Customer Name',
            ship_add1: 'Dhaka',
            ship_city: 'Dhaka',
            ship_state: 'Dhaka',
            ship_postcode: 1000,
            ship_country: 'Bangladesh',
        };

        console.log("Initializing SSLCommerz with data:", data);

        const sslcz = new SSLCommerzPayment(process.env.STORE_ID, process.env.STORE_PASSWORD, process.env.IS_LIVE === 'true');
        sslcz.init(data).then(apiResponse => {
            console.log("SSLCommerz Response:", apiResponse);
            let GatewayPageURL = apiResponse.GatewayPageURL;
            if (GatewayPageURL) {
                res.send({ url: GatewayPageURL });
            } else {
                console.error("SSLCommerz Init Failed:", apiResponse);
                res.status(500).json({ error: "Payment Gateway Error" });
            }
        });

    } catch (err) {
        console.error("Error initiating payment:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

const activateSubscriptionByTransaction = async (pool, tranId) => {
    const saleDetails = await pool.request()
        .input('tid', sql.NVarChar, tranId)
        .query("SELECT TOP 1 shopowner_id FROM sales WHERE transaction_id = @tid");

    if (saleDetails.recordset.length === 0) return;
    const shopownerId = saleDetails.recordset[0].shopowner_id;
    if (!shopownerId) return;

    const userRes = await pool.request()
        .input('sid', sql.NVarChar, shopownerId)
        .query("SELECT TOP 1 id, subscription_plan FROM shopowners WHERE shopowner_id = @sid");

    if (userRes.recordset.length === 0) return;
    const user = userRes.recordset[0];
    const plan = user.subscription_plan;
    let days = 30;
    if (plan === 'yearly') days = 365;
    if (plan === 'lifetime') days = 36500; // 100 years
    if (plan === 'monthly') days = 30;

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    await pool.request()
        .input('uid', sql.Int, user.id)
        .input('endDate', sql.DateTime, endDate)
        .query(`
            UPDATE shopowners
            SET subscription_status = 'active', subscription_end_date = @endDate
            WHERE id = @uid
        `);

    console.log(`Subscription activated for shopowner ${shopownerId}, Plan: ${plan}, End: ${endDate}`);
};

const completePaymentByTransaction = async (pool, tranId) => {
    const saleUpdate = await pool.request()
        .input('transaction_id', sql.NVarChar, tranId)
        .query(`
            UPDATE sales
            SET status = 'Completed'
            OUTPUT INSERTED.id, INSERTED.total_amount, INSERTED.branch, INSERTED.transaction_id, INSERTED.payment_method, INSERTED.status
            WHERE transaction_id = @transaction_id AND status <> 'Completed'
        `);

    const wasUpdated = saleUpdate.recordset.length > 0;
    let sale = wasUpdated ? saleUpdate.recordset[0] : null;

    if (!sale) {
        const saleResult = await pool.request()
            .input('transaction_id', sql.NVarChar, tranId)
            .query(`
                SELECT TOP 1 id, total_amount, branch, transaction_id, payment_method, status
                FROM sales
                WHERE transaction_id = @transaction_id
            `);
        sale = saleResult.recordset[0] || null;
    }

    if (!sale) {
        return { sale: null, wasUpdated: false, isSubscription: false };
    }

    const isSubscription = sale.branch === 'Subscription';

    if (isSubscription) {
        try {
            await activateSubscriptionByTransaction(pool, tranId);
        } catch (subErr) {
            console.error("Subscription activation error:", subErr);
        }
        return { sale, wasUpdated, isSubscription };
    }

    if (wasUpdated) {
        const saleItems = await pool.request()
            .input('sale_id', sql.Int, sale.id)
            .query('SELECT product_id, quantity FROM sale_items WHERE sale_id = @sale_id');
        await applyStockDeduction(pool, saleItems.recordset);
    }

    return { sale, wasUpdated, isSubscription };
};

// Payment Success
const handlePaymentSuccess = async (req, res) => {
    const tran_id = getTranId(req);
    if (!tran_id) {
        return res.redirect(buildRedirectUrl(req, '/shopowner/sales?status=error'));
    }

    try {
        const pool = await sql.connect();
        const result = await completePaymentByTransaction(pool, tran_id);

        if (!result.sale) {
            return res.redirect(buildRedirectUrl(req, '/shopowner/sales?status=error'));
        }

        if (result.isSubscription) {
            return res.redirect(buildRedirectUrl(req, '/shopowner/profile?status=success'));
        }

        return res.redirect(buildRedirectUrl(req, `/shopowner/sales?status=success&tran_id=${encodeURIComponent(tran_id)}`));
    } catch (err) {
        console.error("Payment success error:", err);
        return res.redirect(buildRedirectUrl(req, '/shopowner/sales?status=error'));
    }
};

// Payment IPN
app.post('/api/payment/ipn', async (req, res) => {
    const tran_id = getTranId(req);
    if (!tran_id) {
        return res.status(400).json({ error: "tran_id is required" });
    }

    const ipnStatus = String(req.body?.status || req.body?.value_a || '').toUpperCase();
    const isValidStatus = !ipnStatus || ipnStatus.startsWith('VALID');

    try {
        const pool = await sql.connect();

        if (!isValidStatus) {
            await pool.request()
                .input('transaction_id', sql.NVarChar, tran_id)
                .query("UPDATE sales SET status = 'Failed' WHERE transaction_id = @transaction_id AND status <> 'Completed'");
            return res.json({ success: true, status: 'ignored', tran_id, ipnStatus });
        }

        const result = await completePaymentByTransaction(pool, tran_id);
        if (!result.sale) {
            return res.status(404).json({ error: "Transaction not found" });
        }

        return res.json({
            success: true,
            tran_id,
            status: result.sale.status || 'Completed',
            isSubscription: result.isSubscription
        });
    } catch (err) {
        console.error("Payment IPN error:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post('/api/payment/success/:tran_id', handlePaymentSuccess);
app.get('/api/payment/success/:tran_id', handlePaymentSuccess);

// Manufacturing Routes

// GET /api/manufacturing
app.get('/api/manufacturing', async (req, res) => {
    const branch = req.query.branch || 'Main Branch';
    const { shopownerId } = req.query;

    try {
        const pool = await sql.connect();
        let query = 'SELECT * FROM manufacturing_orders WHERE branch = @branch';
        const request = pool.request().input('branch', sql.NVarChar, branch);

        if (shopownerId) {
            query += ' AND shopowner_id = @shopownerId';
            request.input('shopownerId', sql.NVarChar, shopownerId);
        }

        query += ' ORDER BY created_at DESC';
        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching manufacturing orders:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST /api/manufacturing
// POST /api/manufacturing
app.post('/api/manufacturing', async (req, res) => {
    const {
        order_id,
        customer_id,
        customer_name,
        customer_email,
        product_name,
        karigar_name,
        status,
        gold_weight,
        due_date,
        branch,
        shopownerId
    } = req.body;

    try {
        const pool = await sql.connect();

        const insertQuery = `
            INSERT INTO manufacturing_orders (order_id, customer_id, customer_name, customer_email, product_name, karigar_name, status, gold_weight, due_date, branch, shopowner_id)
            OUTPUT INSERTED.*
            VALUES (@order_id, @customer_id, @customer_name, @customer_email, @product_name, @karigar_name, @status, @gold_weight, @due_date, @branch, @shopowner_id)
        `;

        const result = await pool.request()
            .input('order_id', sql.NVarChar, order_id)
            .input('customer_id', sql.Int, customer_id || null)
            .input('customer_name', sql.NVarChar, customer_name)
            .input('customer_email', sql.NVarChar, customer_email || null)
            .input('product_name', sql.NVarChar, product_name)
            .input('karigar_name', sql.NVarChar, karigar_name || null)
            .input('status', sql.NVarChar, status || 'New Orders')
            .input('gold_weight', sql.Float, gold_weight || 0)
            .input('due_date', sql.DateTime, due_date || null)
            .input('branch', sql.NVarChar, branch || 'Main Branch')
            .input('shopowner_id', sql.NVarChar, shopownerId || null)
            .query(insertQuery);

        const savedOrder = result.recordset[0];

        try {
            const sent = await sendManufacturingCreatedEmail(pool, savedOrder);
            if (!sent) {
                console.warn(`Manufacturing create email skipped: missing customer email for order ${savedOrder.order_id}`);
            }
        } catch (mailErr) {
            console.error(`Manufacturing create email failed for order ${savedOrder.order_id}:`, mailErr?.message || mailErr);
        }

        res.status(201).json(savedOrder);
    } catch (err) {
        console.error("Error creating manufacturing order:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// PUT /api/manufacturing/:id
app.put('/api/manufacturing/:id', async (req, res) => {
    const { id } = req.params;
    const {
        customer_id,
        customer_name,
        customer_email,
        product_name,
        karigar_name,
        gold_weight,
        due_date
    } = req.body;

    try {
        const pool = await sql.connect();
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('customer_id', sql.Int, customer_id || null)
            .input('customer_name', sql.NVarChar, customer_name || null)
            .input('customer_email', sql.NVarChar, customer_email || null)
            .input('product_name', sql.NVarChar, product_name || null)
            .input('karigar_name', sql.NVarChar, karigar_name || null)
            .input('gold_weight', sql.Float, gold_weight || 0)
            .input('due_date', sql.DateTime, due_date || null)
            .query(`
                UPDATE manufacturing_orders
                SET
                    customer_id = @customer_id,
                    customer_name = @customer_name,
                    customer_email = @customer_email,
                    product_name = @product_name,
                    karigar_name = @karigar_name,
                    gold_weight = @gold_weight,
                    due_date = @due_date
                OUTPUT INSERTED.*
                WHERE id = @id
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: "Order not found" });
        }

        res.json(result.recordset[0]);
    } catch (err) {
        console.error("Error updating manufacturing order:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// PUT /api/manufacturing/:id/status
app.put('/api/manufacturing/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        const pool = await sql.connect();

        const existingOrderResult = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT TOP 1 * FROM manufacturing_orders WHERE id = @id');

        if (existingOrderResult.recordset.length === 0) {
            return res.status(404).json({ error: "Order not found" });
        }
        const existingOrder = existingOrderResult.recordset[0];

        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('status', sql.NVarChar, status)
            .query(`
                UPDATE manufacturing_orders 
                SET status = @status 
                OUTPUT INSERTED.*
                WHERE id = @id
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: "Order not found" });
        }

        const updatedOrder = result.recordset[0];
        const movedToReady =
            existingOrder.status !== 'Ready for Delivery' &&
            updatedOrder.status === 'Ready for Delivery';

        if (movedToReady) {
            try {
                const sent = await sendManufacturingReadyEmail(pool, updatedOrder);
                if (!sent) {
                    console.warn(`Ready email skipped: missing customer email for order ${updatedOrder.order_id}`);
                }
            } catch (mailErr) {
                console.error(`Ready email failed for order ${updatedOrder.order_id}:`, mailErr?.message || mailErr);
            }
        }

        res.json(updatedOrder);
    } catch (err) {
        console.error("Error updating order status:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Admin Control Routes

// GET /api/branches
// GET /api/branches
app.get('/api/branches', async (req, res) => {
    const { userId, shopownerId, activeBranch } = req.query;

    if (!shopownerId && !userId) {
        return res.status(400).json({ error: "Shop Owner ID is required" });
    }

    try {
        const pool = await sql.connect();
        const accessContext = await resolveBranchAccessContext(pool, { shopownerId, userId, activeBranch });
        if (accessContext.error) {
            return res.status(accessContext.status || 403).json({ error: accessContext.error });
        }
        const { resolvedShopownerId, resolvedUserId, isActorMain, actorBranch } = accessContext;

        const request = pool.request();
        const ownerClause = applyOwnerScopeClause(request, { resolvedShopownerId, resolvedUserId });
        let query = `
            SELECT id, name, location, status, daily_sales, stock_value, ISNULL(is_main, 0) AS is_main, created_at, branch, user_id, shopowner_id
            FROM branches
            WHERE ${ownerClause}
        `;
        if (!isActorMain) {
            query += ' AND name = @activeBranchName';
            request.input('activeBranchName', sql.NVarChar, actorBranch.name);
        }
        query += ' ORDER BY CASE WHEN ISNULL(is_main, 0) = 1 THEN 0 ELSE 1 END, created_at ASC, id ASC';

        const result = await request.query(query);
        const branches = result.recordset;

        const addOwnerFilter = (reqToUse) => {
            const statsOwnerClause = applyOwnerScopeClause(
                reqToUse,
                { resolvedShopownerId, resolvedUserId },
                { shopownerParam: 'statsShopownerId', userParam: 'statsUserId' }
            );
            return ` AND ${statsOwnerClause}`;
        };

        // Calculate Daily Sales and Stock Value for each branch
        const enrichedBranches = await Promise.all(branches.map(async (branch) => {
            try {
                // Connection for parallel requests inside map might be tricky if pool is single. 
                // mssql pool handles it, but we need new request for each query.

                // 1. Daily Sales: Sum of final_amount for today's sales in this branch
                const salesRequest = pool.request()
                    .input('branch', sql.NVarChar, branch.name);
                const salesOwnerFilter = addOwnerFilter(salesRequest);
                const salesRes = await salesRequest.query(`
                        SELECT SUM(final_amount) as total 
                        FROM sales 
                        WHERE branch = @branch 
                        ${salesOwnerFilter}
                        AND CAST(sale_date AS DATE) = CAST(GETDATE() AS DATE)
                    `);

                // 2. Stock Value: Sum of (price * stock_quantity) for products in this branch
                const stockRequest = pool.request()
                    .input('branch', sql.NVarChar, branch.name);
                const stockOwnerFilter = addOwnerFilter(stockRequest);
                const stockRes = await stockRequest.query(`
                        SELECT SUM(price * stock_quantity) as value 
                        FROM products 
                        WHERE branch = @branch 
                        ${stockOwnerFilter}
                    `);

                return {
                    ...branch,
                    daily_sales: salesRes.recordset[0].total || 0,
                    stock_value: stockRes.recordset[0].value || 0
                };
            } catch (calcErr) {
                console.error(`Error calculating stats for branch ${branch.name}:`, calcErr);
                return branch; // Return basic branch info if calc fails
            }
        }));

        res.json(enrichedBranches);
    } catch (err) {
        console.error("Error fetching branches:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST /api/branches
app.post('/api/branches', async (req, res) => {
    const { name, location, shopownerId, userId, branch_passcode, is_main, activeBranch } = req.body;

    if (!shopownerId && !userId) {
        return res.status(400).json({ error: "Shop Owner ID is required" });
    }

    const resolvedPasscode = String(branch_passcode || '123456').trim();
    if (!/^\d{6}$/.test(resolvedPasscode)) {
        return res.status(400).json({ error: "Branch passcode must be a 6-digit number" });
    }

    try {
        const pool = await sql.connect();
        const accessContext = await resolveBranchAccessContext(pool, { shopownerId, userId, activeBranch });
        if (accessContext.error) {
            return res.status(accessContext.status || 403).json({ error: accessContext.error });
        }
        if (!accessContext.isActorMain) {
            return res.status(403).json({ error: "Only main branch can add new branches." });
        }

        const requestedMain = is_main === true || is_main === 1 || String(is_main).toLowerCase() === 'true';

        // Resolve shopownerId if only userId is provided
        const resolvedShopownerId = accessContext.resolvedShopownerId;
        const resolvedUserId = accessContext.resolvedUserId;

        const ownerWhere = resolvedShopownerId
            ? 'shopowner_id = @ownerShopownerId'
            : (resolvedUserId ? 'user_id = @ownerUserId' : null);
        let shouldBeMain = requestedMain;

        if (ownerWhere) {
            const countReq = pool.request();
            if (resolvedShopownerId) {
                countReq.input('ownerShopownerId', sql.NVarChar, resolvedShopownerId);
            } else {
                countReq.input('ownerUserId', sql.Int, resolvedUserId);
            }
            const countRes = await countReq.query(`
                SELECT COUNT(*) AS total
                FROM branches
                WHERE ${ownerWhere}
            `);
            if (Number(countRes.recordset?.[0]?.total || 0) === 0) {
                shouldBeMain = true;
            }
        }

        if (shouldBeMain && ownerWhere) {
            const clearReq = pool.request();
            if (resolvedShopownerId) {
                clearReq.input('ownerShopownerId', sql.NVarChar, resolvedShopownerId);
            } else {
                clearReq.input('ownerUserId', sql.Int, resolvedUserId);
            }
            await clearReq.query(`UPDATE branches SET is_main = 0 WHERE ${ownerWhere}`);
        }

        await pool.request()
            .input('name', sql.NVarChar, name)
            .input('location', sql.NVarChar, location)
            .input('branch_passcode', sql.NVarChar, resolvedPasscode)
            .input('is_main', sql.Bit, shouldBeMain ? 1 : 0)
            .input('shopownerId', sql.NVarChar, resolvedShopownerId)
            .input('userId', sql.Int, resolvedUserId)
            .query(`
                INSERT INTO branches (name, location, status, daily_sales, stock_value, branch_passcode, is_main, shopowner_id, user_id)
                VALUES (@name, @location, 'Active', 0, '0', @branch_passcode, @is_main, @shopownerId, @userId)
            `);
        res.status(201).json({ message: "Branch created successfully" });
    } catch (err) {
        console.error("Error creating branch:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// PUT /api/branches/:id
app.put('/api/branches/:id', async (req, res) => {
    const { id } = req.params;
    const { name, location, daily_sales, stock_value, status, branch_passcode, is_main, shopownerId, userId, activeBranch } = req.body;

    if (branch_passcode !== undefined && branch_passcode !== null && String(branch_passcode).trim() !== '') {
        if (!/^\d{6}$/.test(String(branch_passcode).trim())) {
            return res.status(400).json({ error: "Branch passcode must be a 6-digit number" });
        }
    }

    try {
        const setPasscode = branch_passcode !== undefined && branch_passcode !== null && String(branch_passcode).trim() !== '';
        const setMain = is_main !== undefined && is_main !== null;
        const requestedMain = is_main === true || is_main === 1 || String(is_main).toLowerCase() === 'true';
        const normalizedDailySales = Number.isFinite(Number(daily_sales)) ? Number(daily_sales) : 0;
        const normalizedStockValue = stock_value === undefined || stock_value === null ? '' : String(stock_value);
        const pool = await sql.connect();
        const accessContext = await resolveBranchAccessContext(pool, { shopownerId, userId, activeBranch });
        if (accessContext.error) {
            return res.status(accessContext.status || 403).json({ error: accessContext.error });
        }

        const branchReq = pool.request()
            .input('id', sql.Int, id);
        const branchOwnerClause = applyOwnerScopeClause(
            branchReq,
            { resolvedShopownerId: accessContext.resolvedShopownerId, resolvedUserId: accessContext.resolvedUserId },
            { shopownerParam: 'branchShopownerId', userParam: 'branchUserId' }
        );
        const branchRes = await branchReq
            .query(`
                SELECT TOP 1 id, user_id, shopowner_id, is_main
                FROM branches
                WHERE id = @id
                  AND ${branchOwnerClause}
            `);

        if (branchRes.recordset.length === 0) {
            return res.status(404).json({ error: "Branch not found" });
        }

        const branchRow = branchRes.recordset[0];
        if (!accessContext.isActorMain && Number(branchRow.id) !== Number(accessContext.actorBranch.id)) {
            return res.status(403).json({ error: "You can only control your own branch." });
        }
        if (!accessContext.isActorMain && setMain) {
            return res.status(403).json({ error: "Only main branch can change main branch assignment." });
        }

        const ownerWhere = branchRow.shopowner_id
            ? 'shopowner_id = @ownerShopownerId'
            : (branchRow.user_id ? 'user_id = @ownerUserId' : null);

        if (setMain && requestedMain && ownerWhere) {
            const clearReq = pool.request().input('id', sql.Int, id);
            if (branchRow.shopowner_id) {
                clearReq.input('ownerShopownerId', sql.NVarChar, branchRow.shopowner_id);
            } else {
                clearReq.input('ownerUserId', sql.Int, branchRow.user_id);
            }
            await clearReq.query(`
                UPDATE branches
                SET is_main = 0
                WHERE id <> @id
                  AND ${ownerWhere}
            `);
        }

        if (setMain && !requestedMain && Number(branchRow.is_main) === 1 && ownerWhere) {
            const countReq = pool.request().input('id', sql.Int, id);
            if (branchRow.shopowner_id) {
                countReq.input('ownerShopownerId', sql.NVarChar, branchRow.shopowner_id);
            } else {
                countReq.input('ownerUserId', sql.Int, branchRow.user_id);
            }
            const countRes = await countReq.query(`
                SELECT COUNT(*) AS total
                FROM branches
                WHERE id <> @id
                  AND ${ownerWhere}
                  AND is_main = 1
            `);
            if (Number(countRes.recordset?.[0]?.total || 0) === 0) {
                return res.status(400).json({ error: "At least one main branch is required. Set another branch as main first." });
            }
        }

        await pool.request()
            .input('id', sql.Int, id)
            .input('name', sql.NVarChar, name)
            .input('location', sql.NVarChar, location)
            .input('daily_sales', sql.Decimal(18, 2), normalizedDailySales)
            .input('stock_value', sql.NVarChar, normalizedStockValue)
            .input('status', sql.NVarChar, status)
            .input('branch_passcode', sql.NVarChar, setPasscode ? String(branch_passcode).trim() : null)
            .input('is_main', sql.Bit, setMain ? (requestedMain ? 1 : 0) : null)
            .query(`
                UPDATE branches 
                SET name = @name, 
                    location = @location, 
                    daily_sales = @daily_sales, 
                    stock_value = @stock_value, 
                    status = @status,
                    branch_passcode = CASE WHEN @branch_passcode IS NULL THEN branch_passcode ELSE @branch_passcode END,
                    is_main = CASE WHEN @is_main IS NULL THEN is_main ELSE @is_main END
                WHERE id = @id
            `);
        res.json({ message: "Branch updated successfully" });
    } catch (err) {
        console.error("Error updating branch:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST /api/branches/verify-passcode
app.post('/api/branches/verify-passcode', async (req, res) => {
    const { branchId, passcode, shopownerId, userId } = req.body;

    if (!branchId || (!shopownerId && !userId)) {
        return res.status(400).json({ error: "Branch ID and owner identifier are required" });
    }
    if (!/^\d{6}$/.test(String(passcode || '').trim())) {
        return res.status(400).json({ error: "Passcode must be a 6-digit number" });
    }

    try {
        const pool = await sql.connect();
        let resolvedUserId = userId ? Number(userId) : null;
        let resolvedShopownerId = shopownerId ? String(shopownerId).trim() : null;

        if (!resolvedUserId && resolvedShopownerId) {
            const userRes = await pool.request()
                .input('sid', sql.NVarChar, resolvedShopownerId)
                .query("SELECT id FROM shopowners WHERE shopowner_id = @sid");
            resolvedUserId = userRes.recordset.length > 0 ? userRes.recordset[0].id : null;
        }

        if (!resolvedShopownerId && resolvedUserId) {
            const ownerRes = await pool.request()
                .input('uid', sql.Int, resolvedUserId)
                .query("SELECT shopowner_id FROM shopowners WHERE id = @uid");
            resolvedShopownerId = ownerRes.recordset.length > 0 ? ownerRes.recordset[0].shopowner_id : null;
        }

        const request = pool.request()
            .input('branchId', sql.Int, Number(branchId))
            .input('passcode', sql.NVarChar, String(passcode).trim());

        let query = `
            SELECT TOP 1 id
            FROM branches
            WHERE id = @branchId
              AND branch_passcode = @passcode
        `;

        if (resolvedShopownerId && resolvedUserId) {
            request.input('shopownerId', sql.NVarChar, resolvedShopownerId);
            request.input('userId', sql.Int, resolvedUserId);
            query += ' AND (shopowner_id = @shopownerId OR user_id = @userId)';
        } else if (resolvedShopownerId) {
            request.input('shopownerId', sql.NVarChar, resolvedShopownerId);
            query += ' AND shopowner_id = @shopownerId';
        } else if (resolvedUserId) {
            request.input('userId', sql.Int, resolvedUserId);
            query += ' AND user_id = @userId';
        }

        const result = await request.query(query);
        if (result.recordset.length === 0) {
            return res.status(401).json({ error: "Invalid passcode" });
        }

        res.json({ success: true });
    } catch (err) {
        console.error("Error verifying branch passcode:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// DELETE /api/branches/:id
app.delete('/api/branches/:id', async (req, res) => {
    const { id } = req.params;
    const { userId, shopownerId, activeBranch } = req.query;
    try {
        const pool = await sql.connect();
        const accessContext = await resolveBranchAccessContext(pool, { shopownerId, userId, activeBranch });
        if (accessContext.error) {
            return res.status(accessContext.status || 403).json({ error: accessContext.error });
        }
        if (!accessContext.isActorMain) {
            return res.status(403).json({ error: "Only main branch can delete branches." });
        }

        const branchReq = pool.request()
            .input('id', sql.Int, id);
        const branchOwnerClause = applyOwnerScopeClause(
            branchReq,
            { resolvedShopownerId: accessContext.resolvedShopownerId, resolvedUserId: accessContext.resolvedUserId },
            { shopownerParam: 'branchShopownerId', userParam: 'branchUserId' }
        );
        const branchRes = await branchReq
            .query(`
                SELECT TOP 1 id, name, is_main, shopowner_id, user_id
                FROM branches
                WHERE id = @id
                  AND ${branchOwnerClause}
            `);

        if (branchRes.recordset.length === 0) {
            return res.status(404).json({ error: "Branch not found" });
        }

        const branchRow = branchRes.recordset[0];
        const ownerWhere = branchRow.shopowner_id
            ? 'shopowner_id = @ownerShopownerId'
            : (branchRow.user_id ? 'user_id = @ownerUserId' : null);

        if (!ownerWhere) {
            return res.status(400).json({ error: "Invalid branch owner context." });
        }

        const nextBranchReq = pool.request()
            .input('id', sql.Int, id);
        if (branchRow.shopowner_id) {
            nextBranchReq.input('ownerShopownerId', sql.NVarChar, branchRow.shopowner_id);
        } else {
            nextBranchReq.input('ownerUserId', sql.Int, branchRow.user_id);
        }
        const nextBranchRes = await nextBranchReq.query(`
            SELECT TOP 1 id, name, ISNULL(is_main, 0) AS is_main
            FROM branches
            WHERE id <> @id
              AND ${ownerWhere}
            ORDER BY CASE WHEN ISNULL(is_main, 0) = 1 THEN 0 ELSE 1 END, created_at ASC, id ASC
        `);

        if (nextBranchRes.recordset.length === 0) {
            return res.status(400).json({ error: "Cannot delete the last branch." });
        }

        const nextBranch = nextBranchRes.recordset[0];

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const writeReq = new sql.Request(transaction)
                .input('branchId', sql.Int, id)
                .input('fromBranch', sql.NVarChar, String(branchRow.name || '').trim())
                .input('toBranch', sql.NVarChar, String(nextBranch.name || '').trim());

            if (branchRow.shopowner_id) {
                writeReq.input('ownerShopownerId', sql.NVarChar, branchRow.shopowner_id);
            } else {
                writeReq.input('ownerUserId', sql.Int, branchRow.user_id);
            }

            await writeReq.query(`
                UPDATE products
                SET branch = @toBranch
                WHERE branch = @fromBranch
                  AND ${ownerWhere};

                UPDATE customers
                SET branch = @toBranch
                WHERE branch = @fromBranch
                  AND ${ownerWhere};

                UPDATE sales
                SET branch = @toBranch
                WHERE branch = @fromBranch
                  AND ${ownerWhere};

                UPDATE installments
                SET branch = @toBranch
                WHERE branch = @fromBranch
                  AND ${ownerWhere};

                UPDATE repair_tickets
                SET branch = @toBranch
                WHERE branch = @fromBranch
                  AND ${ownerWhere};

                UPDATE manufacturing_orders
                SET branch = @toBranch
                WHERE branch = @fromBranch
                  AND ${ownerWhere};

                UPDATE staff
                SET branch = @toBranch
                WHERE branch = @fromBranch
                  AND ${ownerWhere};

                UPDATE stock_transfers
                SET from_branch = CASE WHEN from_branch = @fromBranch THEN @toBranch ELSE from_branch END,
                    to_branch = CASE WHEN to_branch = @fromBranch THEN @toBranch ELSE to_branch END
                WHERE (from_branch = @fromBranch OR to_branch = @fromBranch)
                  AND ${ownerWhere};

                DELETE FROM branches
                WHERE id = @branchId
                  AND ${ownerWhere};
            `);

            if (Number(branchRow.is_main) === 1) {
                await new sql.Request(transaction)
                    .input('nextMainId', sql.Int, nextBranch.id)
                    .query('UPDATE branches SET is_main = 1 WHERE id = @nextMainId');
            }

            await transaction.commit();
            res.json({ message: "Branch deleted successfully", reassigned_to: nextBranch.name });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (err) {
        console.error("Error deleting branch:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// GET /api/staff
app.get('/api/staff', async (req, res) => {
    const branch = req.query.branch || 'Main Branch';
    const { userId, shopownerId, activeBranch } = req.query;

    if (!shopownerId && !userId) {
        return res.status(400).json({ error: "Shop Owner ID is required" });
    }

    try {
        const pool = await sql.connect();
        const accessContext = await resolveBranchAccessContext(pool, { shopownerId, userId, activeBranch });
        if (accessContext.error) {
            return res.status(accessContext.status || 403).json({ error: accessContext.error });
        }

        if (!accessContext.isActorMain && !branchNamesMatch(branch, accessContext.actorBranch.name)) {
            return res.status(403).json({ error: "You can only control staff for your own branch." });
        }

        const request = pool.request()
            .input('branch', sql.NVarChar, branch);
        const ownerClause = applyOwnerScopeClause(
            request,
            { resolvedShopownerId: accessContext.resolvedShopownerId, resolvedUserId: accessContext.resolvedUserId }
        );

        let query = `SELECT * FROM staff WHERE branch = @branch AND ${ownerClause}`;
        query += ' ORDER BY created_at DESC';
        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching staff:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST /api/staff
app.post('/api/staff', async (req, res) => {
    const { full_name, phone, email, role, branch, status, shopownerId, userId, activeBranch } = req.body;

    if (!full_name) {
        return res.status(400).json({ error: "Staff name is required" });
    }
    if (!shopownerId && !userId) {
        return res.status(400).json({ error: "Shop Owner ID is required" });
    }

    try {
        const pool = await sql.connect();
        const accessContext = await resolveBranchAccessContext(pool, { shopownerId, userId, activeBranch });
        if (accessContext.error) {
            return res.status(accessContext.status || 403).json({ error: accessContext.error });
        }

        const targetBranch = normalizeBranchName(branch) || accessContext.actorBranch.name;
        if (!accessContext.isActorMain && !branchNamesMatch(targetBranch, accessContext.actorBranch.name)) {
            return res.status(403).json({ error: "You can only control staff for your own branch." });
        }

        const insertQuery = `
            INSERT INTO staff (full_name, phone, email, role, branch, status, shopowner_id, user_id)
            OUTPUT INSERTED.*
            VALUES (@full_name, @phone, @email, @role, @branch, @status, @shopowner_id, @user_id)
        `;

        const result = await pool.request()
            .input('full_name', sql.NVarChar, full_name)
            .input('phone', sql.NVarChar, phone || null)
            .input('email', sql.NVarChar, email || null)
            .input('role', sql.NVarChar, role || null)
            .input('branch', sql.NVarChar, targetBranch)
            .input('status', sql.NVarChar, status || 'Active')
            .input('shopowner_id', sql.NVarChar, accessContext.resolvedShopownerId || null)
            .input('user_id', sql.Int, accessContext.resolvedUserId || null)
            .query(insertQuery);

        res.status(201).json(result.recordset[0]);
    } catch (err) {
        console.error("Error creating staff:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// PUT /api/staff/:id
app.put('/api/staff/:id', async (req, res) => {
    const { id } = req.params;
    const { full_name, phone, email, role, status, shopownerId, userId, activeBranch } = req.body;

    if (!full_name) {
        return res.status(400).json({ error: "Staff name is required" });
    }
    if (!shopownerId && !userId) {
        return res.status(400).json({ error: "Shop Owner ID is required" });
    }

    try {
        const pool = await sql.connect();
        const accessContext = await resolveBranchAccessContext(pool, { shopownerId, userId, activeBranch });
        if (accessContext.error) {
            return res.status(accessContext.status || 403).json({ error: accessContext.error });
        }

        const staffScopeReq = pool.request().input('id', sql.Int, id);
        const staffOwnerClause = applyOwnerScopeClause(
            staffScopeReq,
            { resolvedShopownerId: accessContext.resolvedShopownerId, resolvedUserId: accessContext.resolvedUserId },
            { shopownerParam: 'staffShopownerId', userParam: 'staffUserId' }
        );
        const staffScopeRes = await staffScopeReq.query(`
            SELECT TOP 1 id, branch
            FROM staff
            WHERE id = @id
              AND ${staffOwnerClause}
        `);
        if (staffScopeRes.recordset.length === 0) {
            return res.status(404).json({ error: "Staff not found" });
        }
        const staffRow = staffScopeRes.recordset[0];
        if (!accessContext.isActorMain && !branchNamesMatch(staffRow.branch, accessContext.actorBranch.name)) {
            return res.status(403).json({ error: "You can only control staff for your own branch." });
        }

        let query = `
            UPDATE staff
            SET full_name = @full_name,
                phone = @phone,
                email = @email,
                role = @role,
                status = @status
            OUTPUT INSERTED.*
            WHERE id = @id
        `;

        const updateReq = pool.request()
            .input('id', sql.Int, id)
            .input('full_name', sql.NVarChar, full_name)
            .input('phone', sql.NVarChar, phone || null)
            .input('email', sql.NVarChar, email || null)
            .input('role', sql.NVarChar, role || null)
            .input('status', sql.NVarChar, status || 'Active');

        const updateOwnerClause = applyOwnerScopeClause(
            updateReq,
            { resolvedShopownerId: accessContext.resolvedShopownerId, resolvedUserId: accessContext.resolvedUserId },
            { shopownerParam: 'updateShopownerId', userParam: 'updateUserId' }
        );
        query += ` AND ${updateOwnerClause}`;

        const result = await updateReq.query(query);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: "Staff not found" });
        }

        res.json(result.recordset[0]);
    } catch (err) {
        console.error("Error updating staff:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// DELETE /api/staff/:id
app.delete('/api/staff/:id', async (req, res) => {
    const { id } = req.params;
    const { shopownerId, userId, activeBranch } = req.query;

    if (!shopownerId && !userId) {
        return res.status(400).json({ error: "Shop Owner ID is required" });
    }

    try {
        const pool = await sql.connect();
        const accessContext = await resolveBranchAccessContext(pool, { shopownerId, userId, activeBranch });
        if (accessContext.error) {
            return res.status(accessContext.status || 403).json({ error: accessContext.error });
        }

        const staffScopeReq = pool.request().input('id', sql.Int, id);
        const staffOwnerClause = applyOwnerScopeClause(
            staffScopeReq,
            { resolvedShopownerId: accessContext.resolvedShopownerId, resolvedUserId: accessContext.resolvedUserId },
            { shopownerParam: 'staffShopownerId', userParam: 'staffUserId' }
        );
        const staffScopeRes = await staffScopeReq.query(`
            SELECT TOP 1 id, branch
            FROM staff
            WHERE id = @id
              AND ${staffOwnerClause}
        `);
        if (staffScopeRes.recordset.length === 0) {
            return res.status(404).json({ error: "Staff not found" });
        }
        const staffRow = staffScopeRes.recordset[0];
        if (!accessContext.isActorMain && !branchNamesMatch(staffRow.branch, accessContext.actorBranch.name)) {
            return res.status(403).json({ error: "You can only control staff for your own branch." });
        }

        const deleteReq = pool.request().input('id', sql.Int, id);
        const deleteOwnerClause = applyOwnerScopeClause(
            deleteReq,
            { resolvedShopownerId: accessContext.resolvedShopownerId, resolvedUserId: accessContext.resolvedUserId },
            { shopownerParam: 'deleteShopownerId', userParam: 'deleteUserId' }
        );
        const result = await deleteReq.query(`DELETE FROM staff WHERE id = @id AND ${deleteOwnerClause}`);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: "Staff not found" });
        }

        res.json({ message: "Staff deleted successfully" });
    } catch (err) {
        console.error("Error deleting staff:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// GET /api/user-profile
app.get('/api/user-profile', async (req, res) => {
    const { userId, shopownerId, activeBranch } = req.query;
    if (!normalizeBranchName(activeBranch)) {
        return res.status(400).json({ error: "Active branch is required" });
    }
    try {
        const pool = await sql.connect();
        const accessContext = await resolveBranchAccessContext(pool, { shopownerId, userId, activeBranch });
        if (accessContext.error) {
            return res.status(accessContext.status || 403).json({ error: accessContext.error });
        }
        if (!accessContext.isActorMain) {
            return res.status(403).json({ error: "Profile is only available on the main branch." });
        }

        let query = `
            SELECT TOP 1
                s.*,
                (
                    SELECT COUNT(*)
                    FROM branches b
                    WHERE b.shopowner_id = s.shopowner_id
                       OR b.user_id = s.id
                ) AS total_branches
            FROM shopowners s
        `;

        if (accessContext.resolvedUserId) {
            query += ` WHERE s.id = @resolvedUserId`;
        } else if (accessContext.resolvedShopownerId) {
            query += ` WHERE s.shopowner_id = @resolvedShopownerId`;
        } else {
            return res.status(400).json({ error: "User ID or Shop Owner ID required" });
        }

        const request = pool.request();
        if (accessContext.resolvedShopownerId) request.input('resolvedShopownerId', sql.NVarChar, accessContext.resolvedShopownerId);
        if (accessContext.resolvedUserId) request.input('resolvedUserId', sql.Int, accessContext.resolvedUserId);

        const result = await request.query(query);

        if (result.recordset.length > 0) {
            res.json(result.recordset[0]);
        } else {
            res.status(404).json({ error: "User not found" });
        }
    } catch (err) {
        console.error("Error fetching user profile:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// PUT /api/user-profile
app.put('/api/user-profile', async (req, res) => {
    const { id, full_name, phone, identifier, shop_name, shop_logo_url, shopownerId, userId, activeBranch } = req.body;
    if (!normalizeBranchName(activeBranch)) {
        return res.status(400).json({ error: "Active branch is required" });
    }
    try {
        const pool = await sql.connect();
        const accessContext = await resolveBranchAccessContext(pool, { shopownerId, userId, activeBranch });
        if (accessContext.error) {
            return res.status(accessContext.status || 403).json({ error: accessContext.error });
        }
        if (!accessContext.isActorMain) {
            return res.status(403).json({ error: "Profile is only editable on the main branch." });
        }

        const targetId = Number(id || accessContext.resolvedUserId);
        if (!Number.isFinite(targetId)) {
            return res.status(400).json({ error: "Valid user id is required" });
        }

        const updateReq = pool.request()
            .input('id', sql.Int, targetId)
            .input('full_name', sql.NVarChar, full_name)
            .input('phone', sql.NVarChar, phone)
            .input('identifier', sql.NVarChar, identifier)
            .input('shop_name', sql.NVarChar, shop_name)
            .input('shop_logo_url', sql.NVarChar, shop_logo_url || null);

        const ownerClause = applyOwnerScopeClause(
            updateReq,
            { resolvedShopownerId: accessContext.resolvedShopownerId, resolvedUserId: accessContext.resolvedUserId },
            { shopownerField: 'shopowner_id', userField: 'id', shopownerParam: 'profileShopownerId', userParam: 'profileUserId' }
        );

        const result = await updateReq
            .query(`
                UPDATE shopowners 
                SET full_name = @full_name, phone = @phone, identifier = @identifier, shop_name = @shop_name, shop_logo_url = @shop_logo_url
                WHERE id = @id
                  AND ${ownerClause}
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        res.json({ message: "Profile updated successfully" });
    } catch (err) {
        console.error("Error updating user profile:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST /api/change-password
app.post('/api/change-password', async (req, res) => {
    const { userId, shopownerId, activeBranch, currentPassword, newPassword } = req.body;
    if (!normalizeBranchName(activeBranch)) {
        return res.status(400).json({ error: "Active branch is required" });
    }
    try {
        const pool = await sql.connect();
        const accessContext = await resolveBranchAccessContext(pool, { shopownerId, userId, activeBranch });
        if (accessContext.error) {
            return res.status(accessContext.status || 403).json({ error: accessContext.error });
        }
        if (!accessContext.isActorMain) {
            return res.status(403).json({ error: "Password change is only available on the main branch." });
        }

        const targetUserId = Number(userId || accessContext.resolvedUserId);
        if (!Number.isFinite(targetUserId)) {
            return res.status(400).json({ error: "Valid user id is required" });
        }

        // precise verification (replace with hash comparison in production)
        const userReq = pool.request()
            .input('id', sql.Int, targetUserId);
        const userOwnerClause = applyOwnerScopeClause(
            userReq,
            { resolvedShopownerId: accessContext.resolvedShopownerId, resolvedUserId: accessContext.resolvedUserId },
            { shopownerField: 'shopowner_id', userField: 'id', shopownerParam: 'pwdShopownerId', userParam: 'pwdUserId' }
        );
        const userResult = await userReq.query(`SELECT password FROM shopowners WHERE id = @id AND ${userOwnerClause}`);

        if (userResult.recordset.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        const user = userResult.recordset[0];
        if (user.password !== currentPassword) {
            return res.status(401).json({ error: "Incorrect current password" });
        }

        await pool.request()
            .input('id', sql.Int, targetUserId)
            .input('password', sql.NVarChar, newPassword)
            .query('UPDATE shopowners SET password = @password WHERE id = @id');

        res.json({ message: "Password updated successfully" });
    } catch (err) {
        console.error("Error changing password:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// GET /api/stock-transfers
app.get('/api/stock-transfers', async (req, res) => {
    const { userId, shopownerId, activeBranch } = req.query;
    try {
        const pool = await sql.connect();
        const accessContext = await resolveBranchAccessContext(pool, { shopownerId, userId, activeBranch });
        if (accessContext.error) {
            return res.status(accessContext.status || 403).json({ error: accessContext.error });
        }

        const request = pool.request();
        const ownerClause = applyOwnerScopeClause(
            request,
            { resolvedShopownerId: accessContext.resolvedShopownerId, resolvedUserId: accessContext.resolvedUserId }
        );

        let query = `SELECT * FROM stock_transfers WHERE ${ownerClause}`;
        if (!accessContext.isActorMain) {
            query += ' AND (from_branch = @actorBranchName OR to_branch = @actorBranchName)';
            request.input('actorBranchName', sql.NVarChar, accessContext.actorBranch.name);
        }
        query += ' ORDER BY transfer_date DESC';
        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching transfers:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST /api/stock-transfers
app.post('/api/stock-transfers', async (req, res) => {
    const { from_branch, to_branch, items, userId, shopownerId, activeBranch } = req.body;
    try {
        if (!from_branch || !to_branch || !String(items || '').trim()) {
            return res.status(400).json({ error: "From branch, to branch and items are required." });
        }

        const transfer_id = `TR-${Math.floor(1000 + Math.random() * 9000)}`;
        const pool = await sql.connect();
        const accessContext = await resolveBranchAccessContext(pool, { shopownerId, userId, activeBranch });
        if (accessContext.error) {
            return res.status(accessContext.status || 403).json({ error: accessContext.error });
        }
        const fromBranch = normalizeBranchName(from_branch);
        const toBranch = normalizeBranchName(to_branch);
        if (!accessContext.isActorMain) {
            const actorBranchName = accessContext.actorBranch.name;
            const involvesActor = branchNamesMatch(fromBranch, actorBranchName) || branchNamesMatch(toBranch, actorBranchName);
            if (!involvesActor) {
                return res.status(403).json({ error: "Non-main branch can only create transfers for its own branch." });
            }
        }

        await pool.request()
            .input('transfer_id', sql.NVarChar, transfer_id)
            .input('from_branch', sql.NVarChar, fromBranch)
            .input('to_branch', sql.NVarChar, toBranch)
            .input('items', sql.NVarChar, items)
            .input('shopowner_id', sql.NVarChar, accessContext.resolvedShopownerId || null)
            .input('user_id', sql.Int, accessContext.resolvedUserId || null)
            .query(`
                INSERT INTO stock_transfers (transfer_id, from_branch, to_branch, items, transfer_date, status, shopowner_id, user_id)
                VALUES (@transfer_id, @from_branch, @to_branch, @items, GETDATE(), 'Pending', @shopowner_id, @user_id)
            `);

        res.status(201).json({ message: "Transfer created successfully" });
    } catch (err) {
        console.error("Error creating transfer:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// PUT /api/stock-transfers/:id/status
app.put('/api/stock-transfers/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status, shopownerId, userId, activeBranch } = req.body;
    try {
        const pool = await sql.connect();
        const accessContext = await resolveBranchAccessContext(pool, { shopownerId, userId, activeBranch });
        if (accessContext.error) {
            return res.status(accessContext.status || 403).json({ error: accessContext.error });
        }

        const transferScopeReq = pool.request().input('id', sql.Int, id);
        const transferOwnerClause = applyOwnerScopeClause(
            transferScopeReq,
            { resolvedShopownerId: accessContext.resolvedShopownerId, resolvedUserId: accessContext.resolvedUserId },
            { shopownerParam: 'transferShopownerId', userParam: 'transferUserId' }
        );
        const transferScopeRes = await transferScopeReq.query(`
            SELECT TOP 1 id, from_branch, to_branch
            FROM stock_transfers
            WHERE id = @id
              AND ${transferOwnerClause}
        `);
        if (transferScopeRes.recordset.length === 0) {
            return res.status(404).json({ error: "Transfer not found" });
        }

        const transferRow = transferScopeRes.recordset[0];
        if (!accessContext.isActorMain) {
            const actorBranchName = accessContext.actorBranch.name;
            const involvesActor = branchNamesMatch(transferRow.from_branch, actorBranchName) || branchNamesMatch(transferRow.to_branch, actorBranchName);
            if (!involvesActor) {
                return res.status(403).json({ error: "You can only control transfers for your own branch." });
            }
        }

        await pool.request()
            .input('id', sql.Int, id)
            .input('status', sql.NVarChar, status)
            .query('UPDATE stock_transfers SET status = @status WHERE id = @id');

        res.json({ message: "Transfer status updated" });
    } catch (err) {
        console.error("Error updating transfer status:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});



// DELETE /api/manufacturing/:id
app.delete('/api/manufacturing/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await sql.connect();
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM manufacturing_orders WHERE id = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: "Order not found" });
        }

        res.json({ message: "Order deleted successfully" });
    } catch (err) {
        console.error("Error deleting manufacturing order:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
const handlePaymentFail = async (req, res) => {
    const tran_id = getTranId(req);
    if (!tran_id) {
        return res.redirect(buildRedirectUrl(req, '/shopowner/sales?status=error'));
    }

    try {
        const pool = await sql.connect();
        await pool.request()
            .input('transaction_id', sql.NVarChar, tran_id)
            .query("UPDATE sales SET status = 'Failed' WHERE transaction_id = @transaction_id");

        res.redirect(buildRedirectUrl(req, '/shopowner/sales?status=failed'));
    } catch (err) {
        console.error("Payment fail error:", err);
        res.redirect(buildRedirectUrl(req, '/shopowner/sales?status=error'));
    }
};

app.post('/api/payment/fail/:tran_id', handlePaymentFail);
app.get('/api/payment/fail/:tran_id', handlePaymentFail);
app.post('/api/payment/cancel/:tran_id', handlePaymentFail);
app.get('/api/payment/cancel/:tran_id', handlePaymentFail);

// GET /api/health
app.get('/api/health', async (req, res) => {
    try {
        const pool = await sql.connect();
        // Simple query to verify connection
        await pool.request().query('SELECT 1');
        res.json({ status: 'connected', message: 'Database connection is healthy' });
    } catch (err) {
        console.error("Health check failed:", err);
        res.status(500).json({ status: 'disconnected', message: 'Database connection failed' });
    }
});




// ==========================================
// Gold Lagbe API Routes
// ==========================================

// GET /api/gl/products/trending
app.get('/api/gl/products/trending', async (req, res) => {
    try {
        const pool = await sql.connect();
        // Return random 10 products as "trending" for now, or based on sales if available
        const result = await pool.request().query(`
            SELECT TOP 8 * FROM products 
            WHERE status = 'In Stock' 
            ORDER BY NEWID()
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching trending products:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// GET /api/gl/shop-visibility
app.get('/api/gl/shop-visibility', async (req, res) => {
    const { shopownerId, userId } = req.query;

    try {
        const pool = await sql.connect();
        const resolvedUserId = await resolveGlShopownerUserId(pool, { shopownerId, userId });

        if (!resolvedUserId) {
            return res.status(400).json({ error: "Shop Owner ID or User ID is required" });
        }

        const profile = await ensureGLShopProfile(pool, resolvedUserId);
        if (!profile) {
            return res.status(404).json({ error: "Shop profile not found" });
        }

        return res.json({
            shopowner_user_id: resolvedUserId,
            shop_slug: profile.shop_slug,
            is_live: Boolean(profile.is_marketplace_live)
        });
    } catch (err) {
        console.error("Error fetching GL shop visibility:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// PUT /api/gl/shop-visibility
app.put('/api/gl/shop-visibility', async (req, res) => {
    const { isLive, shopownerId, userId } = req.body || {};
    if (isLive === undefined || isLive === null) {
        return res.status(400).json({ error: "isLive is required" });
    }

    const parsedIsLive = String(isLive).toLowerCase() === 'true' || String(isLive) === '1';

    try {
        const pool = await sql.connect();
        const resolvedUserId = await resolveGlShopownerUserId(pool, { shopownerId, userId });

        if (!resolvedUserId) {
            return res.status(400).json({ error: "Shop Owner ID or User ID is required" });
        }

        const profile = await ensureGLShopProfile(pool, resolvedUserId);
        if (!profile) {
            return res.status(404).json({ error: "Shop profile not found" });
        }

        await pool.request()
            .input('shopowner_user_id', sql.Int, resolvedUserId)
            .input('is_live', sql.Bit, parsedIsLive ? 1 : 0)
            .query(`
                UPDATE ${GL_SHOP_PROFILES_TABLE}
                SET is_marketplace_live = @is_live
                WHERE shopowner_id = @shopowner_user_id
            `);

        return res.json({
            success: true,
            shopowner_user_id: resolvedUserId,
            shop_slug: profile.shop_slug,
            is_live: parsedIsLive
        });
    } catch (err) {
        console.error("Error updating GL shop visibility:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// GET /api/gl/shop-profile
app.get('/api/gl/shop-profile', async (req, res) => {
    const { shopownerId, userId } = req.query;

    try {
        const pool = await sql.connect();
        const resolvedUserId = await resolveGlShopownerUserId(pool, { shopownerId, userId });

        if (!resolvedUserId) {
            return res.status(400).json({ error: "Shop Owner ID or User ID is required" });
        }

        const profile = await ensureGLShopProfile(pool, resolvedUserId);
        if (!profile) {
            return res.status(404).json({ error: "Shop profile not found" });
        }

        return res.json({
            shopowner_user_id: resolvedUserId,
            shop_slug: profile.shop_slug,
            logo_url: profile.logo_url || '',
            banner_url: profile.banner_url || '',
            logo_position_x: clampMediaPercent(profile.logo_position_x, 50),
            logo_position_y: clampMediaPercent(profile.logo_position_y, 50),
            logo_zoom: clampMediaZoom(profile.logo_zoom, 100),
            banner_position_x: clampMediaPercent(profile.banner_position_x, 50),
            banner_position_y: clampMediaPercent(profile.banner_position_y, 50),
            banner_zoom: clampMediaZoom(profile.banner_zoom, 100),
            is_live: Boolean(profile.is_marketplace_live)
        });
    } catch (err) {
        console.error("Error fetching GL shop profile:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// PUT /api/gl/shop-profile
app.put('/api/gl/shop-profile', async (req, res) => {
    const {
        shopownerId,
        userId,
        logoUrl,
        bannerUrl,
        logoPositionX,
        logoPositionY,
        logoZoom,
        bannerPositionX,
        bannerPositionY,
        bannerZoom
    } = req.body || {};

    const hasAnyProfileField = [
        logoUrl,
        bannerUrl,
        logoPositionX,
        logoPositionY,
        logoZoom,
        bannerPositionX,
        bannerPositionY,
        bannerZoom
    ].some((value) => value !== undefined);

    if (!hasAnyProfileField) {
        return res.status(400).json({ error: "At least one profile media field is required" });
    }

    try {
        const pool = await sql.connect();
        const resolvedUserId = await resolveGlShopownerUserId(pool, { shopownerId, userId });

        if (!resolvedUserId) {
            return res.status(400).json({ error: "Shop Owner ID or User ID is required" });
        }

        const profile = await ensureGLShopProfile(pool, resolvedUserId);
        if (!profile) {
            return res.status(404).json({ error: "Shop profile not found" });
        }

        const nextLogoUrl = logoUrl === undefined
            ? (profile.logo_url || '')
            : String(logoUrl || '').trim();
        const nextBannerUrl = bannerUrl === undefined
            ? (profile.banner_url || '')
            : String(bannerUrl || '').trim();
        const nextLogoPositionX = logoPositionX === undefined
            ? clampMediaPercent(profile.logo_position_x, 50)
            : clampMediaPercent(logoPositionX, 50);
        const nextLogoPositionY = logoPositionY === undefined
            ? clampMediaPercent(profile.logo_position_y, 50)
            : clampMediaPercent(logoPositionY, 50);
        const nextLogoZoom = logoZoom === undefined
            ? clampMediaZoom(profile.logo_zoom, 100)
            : clampMediaZoom(logoZoom, 100);
        const nextBannerPositionX = bannerPositionX === undefined
            ? clampMediaPercent(profile.banner_position_x, 50)
            : clampMediaPercent(bannerPositionX, 50);
        const nextBannerPositionY = bannerPositionY === undefined
            ? clampMediaPercent(profile.banner_position_y, 50)
            : clampMediaPercent(bannerPositionY, 50);
        const nextBannerZoom = bannerZoom === undefined
            ? clampMediaZoom(profile.banner_zoom, 100)
            : clampMediaZoom(bannerZoom, 100);

        await pool.request()
            .input('shopowner_user_id', sql.Int, resolvedUserId)
            .input('logo_url', sql.NVarChar, nextLogoUrl || null)
            .input('banner_url', sql.NVarChar, nextBannerUrl || null)
            .input('logo_position_x', sql.Float, nextLogoPositionX)
            .input('logo_position_y', sql.Float, nextLogoPositionY)
            .input('logo_zoom', sql.Float, nextLogoZoom)
            .input('banner_position_x', sql.Float, nextBannerPositionX)
            .input('banner_position_y', sql.Float, nextBannerPositionY)
            .input('banner_zoom', sql.Float, nextBannerZoom)
            .query(`
                UPDATE ${GL_SHOP_PROFILES_TABLE}
                SET logo_url = @logo_url,
                    banner_url = @banner_url,
                    logo_position_x = @logo_position_x,
                    logo_position_y = @logo_position_y,
                    logo_zoom = @logo_zoom,
                    banner_position_x = @banner_position_x,
                    banner_position_y = @banner_position_y,
                    banner_zoom = @banner_zoom
                WHERE shopowner_id = @shopowner_user_id
            `);

        return res.json({
            success: true,
            shopowner_user_id: resolvedUserId,
            shop_slug: profile.shop_slug,
            logo_url: nextLogoUrl,
            banner_url: nextBannerUrl,
            logo_position_x: nextLogoPositionX,
            logo_position_y: nextLogoPositionY,
            logo_zoom: nextLogoZoom,
            banner_position_x: nextBannerPositionX,
            banner_position_y: nextBannerPositionY,
            banner_zoom: nextBannerZoom
        });
    } catch (err) {
        console.error("Error updating GL shop profile:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// GET /api/gl/overview-stats
app.get('/api/gl/overview-stats', async (req, res) => {
    const { shopownerId, userId } = req.query;

    try {
        const pool = await sql.connect();
        const resolvedUserId = await resolveGlShopownerUserId(pool, { shopownerId, userId });

        if (!resolvedUserId) {
            return res.status(400).json({ error: "Shop Owner ID or User ID is required" });
        }

        const ownerRes = await pool.request()
            .input('shopowner_user_id', sql.Int, resolvedUserId)
            .query(`
                SELECT TOP 1 shopowner_id
                FROM shopowners
                WHERE id = @shopowner_user_id
            `);
        const ownerCode = ownerRes.recordset?.[0]?.shopowner_id
            ? String(ownerRes.recordset[0].shopowner_id)
            : String(resolvedUserId);

        const cartStats = await pool.request()
            .input('shopowner_user_id', sql.Int, resolvedUserId)
            .query(`
                SELECT
                    COUNT(DISTINCT c.user_id) AS cart_customers,
                    ISNULL(SUM(c.quantity), 0) AS cart_items
                FROM ${GL_CART_TABLE} c
                INNER JOIN products p ON p.id = c.product_id
                WHERE p.user_id = @shopowner_user_id
                  AND c.user_id IN (
                      SELECT DISTINCT o.user_id
                      FROM ${GL_ORDERS_TABLE} o
                      WHERE o.shopowner_id = @shopowner_user_id
                        AND o.created_at >= DATEADD(DAY, -30, GETDATE())
                        AND UPPER(ISNULL(o.payment_status, '')) = 'PAID'
                        AND UPPER(ISNULL(o.order_status, '')) IN ('DELIVERED', 'COMPLETED')
                  )
            `);

        const visitorStats = await pool.request()
            .input('shopowner_code', sql.NVarChar, ownerCode)
            .input('shopowner_id_text', sql.NVarChar, String(resolvedUserId))
            .input('shopowner_user_id', sql.Int, resolvedUserId)
            .query(`
                SELECT COUNT(DISTINCT c.user_id) AS engaged_visitors
                FROM [gold_lagbe_main].[dbo].[GL_Conversations] c
                WHERE c.shopowner_id IN (@shopowner_code, @shopowner_id_text)
                  AND c.user_id IN (
                      SELECT DISTINCT o.user_id
                      FROM ${GL_ORDERS_TABLE} o
                      WHERE o.shopowner_id = @shopowner_user_id
                        AND o.created_at >= DATEADD(DAY, -30, GETDATE())
                        AND UPPER(ISNULL(o.payment_status, '')) = 'PAID'
                        AND UPPER(ISNULL(o.order_status, '')) IN ('DELIVERED', 'COMPLETED')
                  )
            `);

        const orderStats = await pool.request()
            .input('shopowner_user_id', sql.Int, resolvedUserId)
            .query(`
                SELECT COUNT(*) AS orders_30d
                FROM ${GL_ORDERS_TABLE}
                WHERE shopowner_id = @shopowner_user_id
                  AND created_at >= DATEADD(DAY, -30, GETDATE())
                  AND UPPER(ISNULL(payment_status, '')) = 'PAID'
                  AND UPPER(ISNULL(order_status, '')) IN ('DELIVERED', 'COMPLETED')
            `);

        return res.json({
            shopowner_user_id: resolvedUserId,
            cart_customers: Number(cartStats.recordset?.[0]?.cart_customers || 0),
            cart_items: Number(cartStats.recordset?.[0]?.cart_items || 0),
            engaged_visitors: Number(visitorStats.recordset?.[0]?.engaged_visitors || 0),
            orders_30d: Number(orderStats.recordset?.[0]?.orders_30d || 0)
        });
    } catch (err) {
        console.error("Error fetching GL overview stats:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// GET /api/gl/sales-history
app.get('/api/gl/sales-history', async (req, res) => {
    const { shopownerId, userId, limit } = req.query;

    const parsedLimit = Number(limit);
    const historyLimit = Number.isInteger(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, 500)
        : 100;

    try {
        const pool = await sql.connect();
        const resolvedUserId = await resolveGlShopownerUserId(pool, { shopownerId, userId });

        if (!resolvedUserId) {
            return res.status(400).json({ error: "Shop Owner ID or User ID is required" });
        }

        const historyRes = await pool.request()
            .input('history_limit', sql.Int, historyLimit)
            .input('shopowner_user_id', sql.Int, resolvedUserId)
            .query(`
                SELECT TOP (@history_limit)
                    o.id,
                    COALESCE(NULLIF(LTRIM(RTRIM(o.order_number)), ''), CONCAT('GL-ORD-', CAST(o.id AS NVARCHAR(20)))) AS transaction_id,
                    o.user_id AS customer_id,
                    CASE
                        WHEN NULLIF(LTRIM(RTRIM(ISNULL(u.full_name, ''))), '') IS NOT NULL
                            THEN LTRIM(RTRIM(u.full_name))
                        WHEN NULLIF(LTRIM(RTRIM(ISNULL(u.phone, ''))), '') IS NOT NULL
                            THEN LTRIM(RTRIM(u.phone))
                        WHEN o.user_id IS NOT NULL
                            THEN CONCAT('User #', CAST(o.user_id AS NVARCHAR(20)))
                        ELSE 'Marketplace User'
                    END AS customer_name,
                    ISNULL(o.total_amount, 0) AS total_amount,
                    CAST(0 AS DECIMAL(18, 2)) AS tax_amount,
                    CAST(0 AS DECIMAL(18, 2)) AS discount_amount,
                    ISNULL(o.total_amount, 0) AS final_amount,
                    UPPER(ISNULL(o.payment_status, '')) AS payment_method,
                    CASE
                        WHEN UPPER(ISNULL(o.payment_status, '')) = 'PAID' AND UPPER(ISNULL(o.order_status, '')) IN ('DELIVERED', 'COMPLETED')
                            THEN 'Completed'
                        WHEN UPPER(ISNULL(o.order_status, '')) IN ('CANCELLED', 'CANCELED', 'FAILED') OR UPPER(ISNULL(o.payment_status, '')) IN ('FAILED', 'CANCELLED', 'CANCELED')
                            THEN 'Failed'
                        WHEN UPPER(ISNULL(o.order_status, '')) IN ('PENDING', 'PROCESSING', 'CONFIRMED', 'SHIPPED') OR UPPER(ISNULL(o.payment_status, '')) IN ('UNPAID', 'PENDING')
                            THEN 'Pending'
                        ELSE ISNULL(o.order_status, 'Pending')
                    END AS status,
                    COALESCE(NULLIF(orderMeta.product_names, ''), 'Unknown Product') AS product_name,
                    COALESCE(NULLIF(orderMeta.branch_names, ''), ISNULL(NULLIF(LTRIM(RTRIM(so.shop_name)), ''), 'Main Branch')) AS branch,
                    o.created_at AS sale_date
                FROM ${GL_ORDERS_TABLE} o
                LEFT JOIN [gold_lagbe_main].[dbo].[GL_Users] u ON u.id = o.user_id
                LEFT JOIN shopowners so ON so.id = o.shopowner_id
                OUTER APPLY (
                    SELECT
                        STUFF((
                            SELECT DISTINCT
                                ', ' + COALESCE(NULLIF(LTRIM(RTRIM(p.name)), ''), CONCAT('Product #', CAST(oi.product_id AS NVARCHAR(20))))
                            FROM ${GL_ORDER_ITEMS_TABLE} oi
                            LEFT JOIN products p ON p.id = oi.product_id
                            WHERE oi.order_id = o.id
                            FOR XML PATH(''), TYPE
                        ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS product_names,
                        STUFF((
                            SELECT DISTINCT
                                ' || ' + COALESCE(NULLIF(LTRIM(RTRIM(p.branch)), ''), 'Main Branch')
                            FROM ${GL_ORDER_ITEMS_TABLE} oi
                            LEFT JOIN products p ON p.id = oi.product_id
                            WHERE oi.order_id = o.id
                            FOR XML PATH(''), TYPE
                        ).value('.', 'NVARCHAR(MAX)'), 1, 4, '') AS branch_names
                ) orderMeta
                WHERE o.shopowner_id = @shopowner_user_id
                ORDER BY o.created_at DESC, o.id DESC
            `);

        return res.json({
            shopowner_user_id: resolvedUserId,
            count: historyRes.recordset.length,
            sales: historyRes.recordset || []
        });
    } catch (err) {
        console.error("Error fetching GL sales history:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// PUT /api/gl/product-visibility
app.put('/api/gl/product-visibility', async (req, res) => {
    const { productId, isLive, shopownerId, userId } = req.body || {};
    const parsedProductId = Number(productId);

    if (!Number.isFinite(parsedProductId) || parsedProductId <= 0) {
        return res.status(400).json({ error: "Valid productId is required" });
    }
    if (isLive === undefined || isLive === null) {
        return res.status(400).json({ error: "isLive is required" });
    }

    const parsedIsLive = String(isLive).toLowerCase() === 'true' || String(isLive) === '1';

    try {
        const pool = await sql.connect();
        await ensureProductMarketplaceLiveSchema(pool);
        const resolvedUserId = await resolveGlShopownerUserId(pool, { shopownerId, userId });

        if (!resolvedUserId) {
            return res.status(400).json({ error: "Shop Owner ID or User ID is required" });
        }

        const ownerRes = await pool.request()
            .input('shopowner_user_id', sql.Int, resolvedUserId)
            .query(`SELECT TOP 1 shopowner_id FROM shopowners WHERE id = @shopowner_user_id`);
        const ownerCode = ownerRes.recordset?.[0]?.shopowner_id
            ? String(ownerRes.recordset[0].shopowner_id)
            : null;

        const request = pool.request()
            .input('product_id', sql.Int, parsedProductId)
            .input('is_live', sql.Bit, parsedIsLive ? 1 : 0)
            .input('user_id', sql.Int, resolvedUserId);

        let ownerFilter = ' AND user_id = @user_id';
        if (ownerCode) {
            request.input('shopowner_code', sql.NVarChar, ownerCode);
            ownerFilter = ' AND (user_id = @user_id OR shopowner_id = @shopowner_code)';
        }

        const updateResult = await request.query(`
            UPDATE products
            SET is_marketplace_live = @is_live
            OUTPUT INSERTED.id, INSERTED.name, INSERTED.stock_quantity, INSERTED.status, INSERTED.is_marketplace_live
            WHERE id = @product_id
            ${ownerFilter}
        `);

        if (updateResult.recordset.length === 0) {
            return res.status(404).json({ error: "Product not found for this shop owner" });
        }

        return res.json({
            success: true,
            product: updateResult.recordset[0]
        });
    } catch (err) {
        console.error("Error updating GL product visibility:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// GET /api/gl/coupons
app.get('/api/gl/coupons', async (req, res) => {
    const { shopownerId, userId } = req.query;

    try {
        const pool = await sql.connect();
        await ensureGLCouponsSchema(pool);
        await ensureGLCouponUsageSchema(pool);
        const resolvedUserId = await resolveGlShopownerUserId(pool, { shopownerId, userId });

        if (!resolvedUserId) {
            return res.status(400).json({ error: "Shop Owner ID or User ID is required" });
        }

        const ownerRes = await pool.request()
            .input('shopowner_user_id', sql.Int, resolvedUserId)
            .query('SELECT TOP 1 shopowner_id FROM shopowners WHERE id = @shopowner_user_id');
        const ownerCode = ownerRes.recordset?.[0]?.shopowner_id
            ? String(ownerRes.recordset[0].shopowner_id)
            : null;

        const couponsRes = await pool.request()
            .input('shopowner_user_id', sql.Int, resolvedUserId)
            .input('shopowner_code', sql.NVarChar, ownerCode)
            .query(`
                SELECT
                    c.*,
                    ISNULL(usageAgg.usage_count, 0) AS usage_count,
                    usageAgg.last_redeemed_at
                FROM ${GL_COUPONS_TABLE} c
                OUTER APPLY (
                    SELECT
                        COUNT(*) AS usage_count,
                        MAX(u.redeemed_at) AS last_redeemed_at
                    FROM ${GL_COUPON_USAGE_TABLE} u
                    WHERE u.coupon_id = c.id
                ) usageAgg
                WHERE c.shopowner_user_id = @shopowner_user_id
                   OR (@shopowner_code IS NOT NULL AND c.shopowner_id = @shopowner_code)
                ORDER BY c.created_at DESC, c.id DESC
            `);

        return res.json({
            shopowner_user_id: resolvedUserId,
            coupons: (couponsRes.recordset || []).map(mapGLCouponRecord)
        });
    } catch (err) {
        console.error("Error fetching GL coupons:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST /api/gl/coupons
app.post('/api/gl/coupons', async (req, res) => {
    const {
        shopownerId,
        userId,
        code,
        title,
        description,
        discountType,
        discountValue,
        minimumOrderAmount,
        maximumDiscountAmount,
        startsAt,
        expiresAt,
        usageLimit,
        isActive
    } = req.body || {};

    const normalizedCode = normalizeCouponCode(code);
    if (!normalizedCode || normalizedCode.length < 3 || normalizedCode.length > 64) {
        return res.status(400).json({ error: "Coupon code must be 3-64 characters (letters, numbers, - or _)" });
    }

    const normalizedDiscountType = normalizeCouponDiscountType(discountType);
    if (!normalizedDiscountType) {
        return res.status(400).json({ error: "discountType must be 'percentage' or 'fixed'" });
    }

    const parsedDiscountValue = Number(discountValue);
    if (!Number.isFinite(parsedDiscountValue) || parsedDiscountValue <= 0) {
        return res.status(400).json({ error: "discountValue must be a positive number" });
    }
    if (normalizedDiscountType === 'PERCENTAGE' && parsedDiscountValue > 100) {
        return res.status(400).json({ error: "Percentage discount cannot exceed 100" });
    }

    const hasMinimumOrderAmount = minimumOrderAmount !== undefined && minimumOrderAmount !== null && String(minimumOrderAmount).trim() !== '';
    const parsedMinimumOrderAmount = hasMinimumOrderAmount ? Number(minimumOrderAmount) : null;
    if (hasMinimumOrderAmount && (!Number.isFinite(parsedMinimumOrderAmount) || parsedMinimumOrderAmount < 0)) {
        return res.status(400).json({ error: "minimumOrderAmount must be a number >= 0" });
    }

    const hasMaximumDiscountAmount = maximumDiscountAmount !== undefined && maximumDiscountAmount !== null && String(maximumDiscountAmount).trim() !== '';
    const parsedMaximumDiscountAmount = hasMaximumDiscountAmount ? Number(maximumDiscountAmount) : null;
    if (hasMaximumDiscountAmount && (!Number.isFinite(parsedMaximumDiscountAmount) || parsedMaximumDiscountAmount <= 0)) {
        return res.status(400).json({ error: "maximumDiscountAmount must be a number > 0" });
    }

    const hasStartsAt = startsAt !== undefined && startsAt !== null && String(startsAt).trim() !== '';
    const hasExpiresAt = expiresAt !== undefined && expiresAt !== null && String(expiresAt).trim() !== '';
    if (!hasStartsAt || !hasExpiresAt) {
        return res.status(400).json({ error: "startsAt and expiresAt are required" });
    }
    const parsedStartsAt = hasStartsAt ? new Date(startsAt) : null;
    const parsedExpiresAt = hasExpiresAt ? new Date(expiresAt) : null;

    if (hasStartsAt && Number.isNaN(parsedStartsAt.getTime())) {
        return res.status(400).json({ error: "startsAt is invalid" });
    }
    if (hasExpiresAt && Number.isNaN(parsedExpiresAt.getTime())) {
        return res.status(400).json({ error: "expiresAt is invalid" });
    }
    if (parsedStartsAt && parsedExpiresAt && parsedExpiresAt.getTime() <= parsedStartsAt.getTime()) {
        return res.status(400).json({ error: "expiresAt must be later than startsAt" });
    }

    const hasUsageLimit = usageLimit !== undefined && usageLimit !== null && String(usageLimit).trim() !== '';
    const parsedUsageLimit = hasUsageLimit ? Number(usageLimit) : null;
    if (hasUsageLimit && (!Number.isInteger(parsedUsageLimit) || parsedUsageLimit <= 0)) {
        return res.status(400).json({ error: "usageLimit must be a positive integer" });
    }

    const parsedIsActive = isActive === undefined || isActive === null
        ? false
        : (String(isActive).toLowerCase() === 'true' || String(isActive) === '1');

    const normalizedTitle = title === undefined || title === null ? null : String(title).trim();
    const normalizedDescription = description === undefined || description === null ? null : String(description).trim();
    if (normalizedTitle && normalizedTitle.length > 120) {
        return res.status(400).json({ error: "title cannot exceed 120 characters" });
    }
    if (normalizedDescription && normalizedDescription.length > 500) {
        return res.status(400).json({ error: "description cannot exceed 500 characters" });
    }

    try {
        const pool = await sql.connect();
        await ensureGLCouponsSchema(pool);
        const resolvedUserId = await resolveGlShopownerUserId(pool, { shopownerId, userId });

        if (!resolvedUserId) {
            return res.status(400).json({ error: "Shop Owner ID or User ID is required" });
        }

        const ownerRes = await pool.request()
            .input('shopowner_user_id', sql.Int, resolvedUserId)
            .query('SELECT TOP 1 shopowner_id FROM shopowners WHERE id = @shopowner_user_id');
        const ownerCode = ownerRes.recordset?.[0]?.shopowner_id
            ? String(ownerRes.recordset[0].shopowner_id)
            : String(resolvedUserId);

        const insertResult = await pool.request()
            .input('shopowner_user_id', sql.Int, resolvedUserId)
            .input('shopowner_id', sql.NVarChar, ownerCode)
            .input('code', sql.NVarChar, normalizedCode)
            .input('title', sql.NVarChar, normalizedTitle || null)
            .input('description', sql.NVarChar, normalizedDescription || null)
            .input('discount_type', sql.NVarChar, normalizedDiscountType)
            .input('discount_value', sql.Decimal(18, 2), parsedDiscountValue)
            .input('minimum_order_amount', sql.Decimal(18, 2), parsedMinimumOrderAmount)
            .input('maximum_discount_amount', sql.Decimal(18, 2), parsedMaximumDiscountAmount)
            .input('starts_at', sql.DateTime2, parsedStartsAt)
            .input('expires_at', sql.DateTime2, parsedExpiresAt)
            .input('usage_limit', sql.Int, parsedUsageLimit)
            .input('is_active', sql.Bit, parsedIsActive ? 1 : 0)
            .query(`
                INSERT INTO ${GL_COUPONS_TABLE} (
                    shopowner_user_id,
                    shopowner_id,
                    code,
                    title,
                    description,
                    discount_type,
                    discount_value,
                    minimum_order_amount,
                    maximum_discount_amount,
                    starts_at,
                    expires_at,
                    usage_limit,
                    used_count,
                    is_active,
                    created_at,
                    updated_at
                )
                OUTPUT INSERTED.*
                VALUES (
                    @shopowner_user_id,
                    @shopowner_id,
                    @code,
                    @title,
                    @description,
                    @discount_type,
                    @discount_value,
                    @minimum_order_amount,
                    @maximum_discount_amount,
                    @starts_at,
                    @expires_at,
                    @usage_limit,
                    0,
                    @is_active,
                    GETDATE(),
                    GETDATE()
                )
            `);

        const createdCoupon = insertResult.recordset?.[0];
        return res.status(201).json({
            success: true,
            coupon: createdCoupon ? mapGLCouponRecord(createdCoupon) : null
        });
    } catch (err) {
        if (err?.number === 2601 || err?.number === 2627) {
            return res.status(409).json({ error: "Coupon code already exists for this shop" });
        }
        console.error("Error creating GL coupon:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// PATCH /api/gl/coupons/:couponId/status
app.patch('/api/gl/coupons/:couponId/status', async (req, res) => {
    const parsedCouponId = Number(req.params.couponId);
    const { shopownerId, userId, isActive } = req.body || {};

    if (!Number.isInteger(parsedCouponId) || parsedCouponId <= 0) {
        return res.status(400).json({ error: "Valid couponId is required" });
    }
    if (isActive === undefined || isActive === null) {
        return res.status(400).json({ error: "isActive is required" });
    }

    const parsedIsActive = String(isActive).toLowerCase() === 'true' || String(isActive) === '1';

    try {
        const pool = await sql.connect();
        await ensureGLCouponsSchema(pool);
        await ensureGLCouponUsageSchema(pool);

        const resolvedUserId = await resolveGlShopownerUserId(pool, { shopownerId, userId });
        if (!resolvedUserId) {
            return res.status(400).json({ error: "Shop Owner ID or User ID is required" });
        }

        const ownerRes = await pool.request()
            .input('shopowner_user_id', sql.Int, resolvedUserId)
            .query('SELECT TOP 1 shopowner_id FROM shopowners WHERE id = @shopowner_user_id');
        const ownerCode = ownerRes.recordset?.[0]?.shopowner_id
            ? String(ownerRes.recordset[0].shopowner_id)
            : null;

        const updateRes = await pool.request()
            .input('coupon_id', sql.Int, parsedCouponId)
            .input('shopowner_user_id', sql.Int, resolvedUserId)
            .input('shopowner_code', sql.NVarChar, ownerCode)
            .input('is_active', sql.Bit, parsedIsActive ? 1 : 0)
            .query(`
                UPDATE ${GL_COUPONS_TABLE}
                SET is_active = @is_active,
                    updated_at = GETDATE()
                OUTPUT INSERTED.id
                WHERE id = @coupon_id
                  AND (
                        shopowner_user_id = @shopowner_user_id
                        OR (@shopowner_code IS NOT NULL AND shopowner_id = @shopowner_code)
                  )
            `);

        if (updateRes.recordset.length === 0) {
            return res.status(404).json({ error: "Coupon not found for this owner" });
        }

        const couponRes = await pool.request()
            .input('coupon_id', sql.Int, parsedCouponId)
            .query(`
                SELECT TOP 1
                    c.*,
                    ISNULL(usageAgg.usage_count, 0) AS usage_count,
                    usageAgg.last_redeemed_at
                FROM ${GL_COUPONS_TABLE} c
                OUTER APPLY (
                    SELECT
                        COUNT(*) AS usage_count,
                        MAX(u.redeemed_at) AS last_redeemed_at
                    FROM ${GL_COUPON_USAGE_TABLE} u
                    WHERE u.coupon_id = c.id
                ) usageAgg
                WHERE c.id = @coupon_id
            `);

        return res.json({
            success: true,
            coupon: couponRes.recordset?.[0] ? mapGLCouponRecord(couponRes.recordset[0]) : null
        });
    } catch (err) {
        console.error("Error updating GL coupon status:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// DELETE /api/gl/coupons/:couponId
app.delete('/api/gl/coupons/:couponId', async (req, res) => {
    const parsedCouponId = Number(req.params.couponId);
    const { shopownerId, userId } = req.query;

    if (!Number.isInteger(parsedCouponId) || parsedCouponId <= 0) {
        return res.status(400).json({ error: "Valid couponId is required" });
    }

    try {
        const pool = await sql.connect();
        await ensureGLCouponsSchema(pool);
        await ensureGLCouponUsageSchema(pool);

        const resolvedUserId = await resolveGlShopownerUserId(pool, { shopownerId, userId });
        if (!resolvedUserId) {
            return res.status(400).json({ error: "Shop Owner ID or User ID is required" });
        }

        const ownerRes = await pool.request()
            .input('shopowner_user_id', sql.Int, resolvedUserId)
            .query('SELECT TOP 1 shopowner_id FROM shopowners WHERE id = @shopowner_user_id');
        const ownerCode = ownerRes.recordset?.[0]?.shopowner_id
            ? String(ownerRes.recordset[0].shopowner_id)
            : null;

        const ownedCouponRes = await pool.request()
            .input('coupon_id', sql.Int, parsedCouponId)
            .input('shopowner_user_id', sql.Int, resolvedUserId)
            .input('shopowner_code', sql.NVarChar, ownerCode)
            .query(`
                SELECT TOP 1 id
                FROM ${GL_COUPONS_TABLE}
                WHERE id = @coupon_id
                  AND (
                        shopowner_user_id = @shopowner_user_id
                        OR (@shopowner_code IS NOT NULL AND shopowner_id = @shopowner_code)
                  )
            `);

        if (ownedCouponRes.recordset.length === 0) {
            return res.status(404).json({ error: "Coupon not found for this owner" });
        }

        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            await new sql.Request(transaction)
                .input('coupon_id', sql.Int, parsedCouponId)
                .query(`
                    DELETE FROM ${GL_COUPON_USAGE_TABLE}
                    WHERE coupon_id = @coupon_id
                `);

            await new sql.Request(transaction)
                .input('coupon_id', sql.Int, parsedCouponId)
                .query(`
                    DELETE FROM ${GL_COUPONS_TABLE}
                    WHERE id = @coupon_id
                `);

            await transaction.commit();
        } catch (transactionErr) {
            try {
                await transaction.rollback();
            } catch (_) { }
            throw transactionErr;
        }

        return res.json({
            success: true,
            deleted_coupon_id: parsedCouponId
        });
    } catch (err) {
        console.error("Error deleting GL coupon:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST /api/gl/coupons/validate
app.post('/api/gl/coupons/validate', async (req, res) => {
    const { shopSlug, code, orderAmount } = req.body || {};

    const normalizedShopSlug = String(shopSlug || '').trim();
    if (!normalizedShopSlug) {
        return res.status(400).json({ error: "shopSlug is required" });
    }

    const normalizedCode = normalizeCouponCode(code);
    if (!normalizedCode) {
        return res.status(400).json({ error: "code is required" });
    }

    const hasOrderAmount = orderAmount !== undefined && orderAmount !== null && String(orderAmount).trim() !== '';
    const parsedOrderAmount = hasOrderAmount ? Number(orderAmount) : null;
    if (hasOrderAmount && (!Number.isFinite(parsedOrderAmount) || parsedOrderAmount < 0)) {
        return res.status(400).json({ error: "orderAmount must be a number >= 0" });
    }

    try {
        const pool = await sql.connect();
        await ensureGLShopProfileLiveSchema(pool);
        await ensureGLCouponsSchema(pool);
        await ensureGLCouponUsageSchema(pool);

        const shopRes = await pool.request()
            .input('shop_slug', sql.NVarChar, normalizedShopSlug)
            .query(`
                SELECT TOP 1 shopowner_id
                FROM ${GL_SHOP_PROFILES_TABLE}
                WHERE shop_slug = @shop_slug
                  AND is_marketplace_live = 1
            `);

        if (shopRes.recordset.length === 0) {
            return res.status(404).json({ error: "Shop not found" });
        }

        const shopownerUserId = Number(shopRes.recordset[0].shopowner_id);
        const couponRes = await pool.request()
            .input('shopowner_user_id', sql.Int, shopownerUserId)
            .input('code', sql.NVarChar, normalizedCode)
            .query(`
                SELECT TOP 1
                    c.*,
                    ISNULL(usageAgg.usage_count, 0) AS usage_count,
                    usageAgg.last_redeemed_at
                FROM ${GL_COUPONS_TABLE} c
                OUTER APPLY (
                    SELECT
                        COUNT(*) AS usage_count,
                        MAX(u.redeemed_at) AS last_redeemed_at
                    FROM ${GL_COUPON_USAGE_TABLE} u
                    WHERE u.coupon_id = c.id
                ) usageAgg
                WHERE c.shopowner_user_id = @shopowner_user_id
                  AND c.code = @code
                  AND ISNULL(c.is_active, 1) = 1
                  AND (c.starts_at IS NULL OR c.starts_at <= GETDATE())
                  AND (c.expires_at IS NULL OR c.expires_at >= GETDATE())
                  AND (c.usage_limit IS NULL OR ISNULL(usageAgg.usage_count, 0) < c.usage_limit)
                ORDER BY c.id DESC
            `);

        if (couponRes.recordset.length === 0) {
            return res.json({
                valid: false,
                reason: "Coupon is invalid, inactive, expired, or limit reached"
            });
        }

        const coupon = mapGLCouponRecord(couponRes.recordset[0]);
        const minOrderAmount = coupon.minimum_order_amount === null ? null : Number(coupon.minimum_order_amount);

        if (hasOrderAmount && minOrderAmount !== null && parsedOrderAmount < minOrderAmount) {
            return res.json({
                valid: false,
                reason: `Minimum order amount is ${minOrderAmount}`
            });
        }

        let discountAmount = null;
        let finalOrderAmount = null;

        if (hasOrderAmount) {
            const couponValue = Number(coupon.discount_value || 0);
            const rawDiscount = coupon.discount_type === 'PERCENTAGE'
                ? (parsedOrderAmount * couponValue) / 100
                : couponValue;

            let boundedDiscount = Math.max(0, rawDiscount);
            if (coupon.discount_type === 'PERCENTAGE' && coupon.maximum_discount_amount !== null) {
                boundedDiscount = Math.min(boundedDiscount, Number(coupon.maximum_discount_amount));
            }
            boundedDiscount = Math.min(boundedDiscount, parsedOrderAmount);

            discountAmount = Number(boundedDiscount.toFixed(2));
            finalOrderAmount = Number(Math.max(0, parsedOrderAmount - boundedDiscount).toFixed(2));
        }

        return res.json({
            valid: true,
            coupon,
            order_amount: hasOrderAmount ? parsedOrderAmount : null,
            discount_amount: discountAmount,
            final_order_amount: finalOrderAmount
        });
    } catch (err) {
        console.error("Error validating GL coupon:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST /api/gl/coupons/redeem
app.post('/api/gl/coupons/redeem', async (req, res) => {
    const {
        shopSlug,
        code,
        couponId,
        shopownerId,
        userId,
        customerUserId,
        customerName,
        customerContact,
        orderReference,
        orderAmount,
        discountAmount,
        finalAmount,
        currency,
        metadata
    } = req.body || {};

    const normalizedCode = normalizeCouponCode(code);
    const parsedCouponId = Number(couponId);
    if (!normalizedCode && (!Number.isInteger(parsedCouponId) || parsedCouponId <= 0)) {
        return res.status(400).json({ error: "code or valid couponId is required" });
    }

    const normalizedShopSlug = String(shopSlug || '').trim();
    const parsedOrderAmount = Number(orderAmount);
    if (!Number.isFinite(parsedOrderAmount) || parsedOrderAmount < 0) {
        return res.status(400).json({ error: "orderAmount must be a number >= 0" });
    }

    const hasDiscountAmount = discountAmount !== undefined && discountAmount !== null && String(discountAmount).trim() !== '';
    const parsedDiscountAmount = hasDiscountAmount ? Number(discountAmount) : null;
    if (hasDiscountAmount && (!Number.isFinite(parsedDiscountAmount) || parsedDiscountAmount < 0)) {
        return res.status(400).json({ error: "discountAmount must be a number >= 0" });
    }

    const hasFinalAmount = finalAmount !== undefined && finalAmount !== null && String(finalAmount).trim() !== '';
    const parsedFinalAmount = hasFinalAmount ? Number(finalAmount) : null;
    if (hasFinalAmount && (!Number.isFinite(parsedFinalAmount) || parsedFinalAmount < 0)) {
        return res.status(400).json({ error: "finalAmount must be a number >= 0" });
    }

    const normalizedOrderReferenceRaw = String(orderReference || '').trim();
    const normalizedOrderReference = normalizedOrderReferenceRaw ? normalizedOrderReferenceRaw.slice(0, 120) : null;
    const parsedCustomerUserId = Number(customerUserId);
    const normalizedCurrency = String(currency || 'BDT').trim().toUpperCase().slice(0, 16) || 'BDT';
    const normalizedCustomerName = String(customerName || '').trim().slice(0, 120) || null;
    const normalizedCustomerContact = String(customerContact || '').trim().slice(0, 255) || null;
    const normalizedMetadata = metadata === undefined || metadata === null
        ? null
        : (typeof metadata === 'string' ? metadata : JSON.stringify(metadata));

    try {
        const pool = await sql.connect();
        await ensureGLShopProfileLiveSchema(pool);
        await ensureGLCouponsSchema(pool);
        await ensureGLCouponUsageSchema(pool);

        let resolvedOwnerUserId = null;
        if (normalizedShopSlug) {
            const shopRes = await pool.request()
                .input('shop_slug', sql.NVarChar, normalizedShopSlug)
                .query(`
                    SELECT TOP 1 shopowner_id
                    FROM ${GL_SHOP_PROFILES_TABLE}
                    WHERE shop_slug = @shop_slug
                `);

            if (shopRes.recordset.length === 0) {
                return res.status(404).json({ error: "Shop not found" });
            }
            resolvedOwnerUserId = Number(shopRes.recordset[0].shopowner_id);
        } else {
            resolvedOwnerUserId = await resolveGlShopownerUserId(pool, { shopownerId, userId });
            if (!resolvedOwnerUserId) {
                return res.status(400).json({ error: "shopSlug or owner identifier is required" });
            }
        }

        const ownerCodeRes = await pool.request()
            .input('shopowner_user_id', sql.Int, resolvedOwnerUserId)
            .query('SELECT TOP 1 shopowner_id FROM shopowners WHERE id = @shopowner_user_id');
        const ownerCode = ownerCodeRes.recordset?.[0]?.shopowner_id
            ? String(ownerCodeRes.recordset[0].shopowner_id)
            : String(resolvedOwnerUserId);

        const transaction = new sql.Transaction(pool);
        await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

        try {
            const couponLookupReq = new sql.Request(transaction)
                .input('shopowner_user_id', sql.Int, resolvedOwnerUserId);
            let couponWhere = 'c.shopowner_user_id = @shopowner_user_id';

            if (Number.isInteger(parsedCouponId) && parsedCouponId > 0) {
                couponLookupReq.input('coupon_id', sql.Int, parsedCouponId);
                couponWhere += ' AND c.id = @coupon_id';
            } else {
                couponLookupReq.input('code', sql.NVarChar, normalizedCode);
                couponWhere += ' AND c.code = @code';
            }

            const couponRow = await couponLookupReq.query(`
                SELECT TOP 1
                    c.*,
                    ISNULL(usageAgg.usage_count, 0) AS usage_count,
                    usageAgg.last_redeemed_at
                FROM ${GL_COUPONS_TABLE} c WITH (UPDLOCK, HOLDLOCK)
                OUTER APPLY (
                    SELECT
                        COUNT(*) AS usage_count,
                        MAX(u.redeemed_at) AS last_redeemed_at
                    FROM ${GL_COUPON_USAGE_TABLE} u WITH (UPDLOCK, HOLDLOCK)
                    WHERE u.coupon_id = c.id
                ) usageAgg
                WHERE ${couponWhere}
                  AND ISNULL(c.is_active, 1) = 1
                  AND (c.starts_at IS NULL OR c.starts_at <= GETDATE())
                  AND (c.expires_at IS NULL OR c.expires_at >= GETDATE())
                  AND (c.usage_limit IS NULL OR ISNULL(usageAgg.usage_count, 0) < c.usage_limit)
                ORDER BY c.id DESC
            `);

            if (couponRow.recordset.length === 0) {
                await transaction.rollback();
                return res.status(400).json({ error: "Coupon is invalid, inactive, expired, or limit reached" });
            }

            const coupon = mapGLCouponRecord(couponRow.recordset[0]);
            if (coupon.minimum_order_amount !== null && parsedOrderAmount < Number(coupon.minimum_order_amount)) {
                await transaction.rollback();
                return res.status(400).json({
                    error: `Minimum order amount is ${coupon.minimum_order_amount}`
                });
            }

            if (normalizedOrderReference) {
                const duplicateRes = await new sql.Request(transaction)
                    .input('coupon_id', sql.Int, coupon.id)
                    .input('order_reference', sql.NVarChar, normalizedOrderReference)
                    .query(`
                        SELECT TOP 1 *
                        FROM ${GL_COUPON_USAGE_TABLE}
                        WHERE coupon_id = @coupon_id
                          AND order_reference = @order_reference
                        ORDER BY id DESC
                    `);

                if (duplicateRes.recordset.length > 0) {
                    const duplicateUsage = mapGLCouponUsageRecord(duplicateRes.recordset[0]);
                    await transaction.rollback();
                    return res.status(200).json({
                        success: true,
                        duplicate: true,
                        message: "Coupon usage already recorded for this order reference",
                        coupon,
                        usage_count: Number(coupon.usage_count || 0),
                        usage: duplicateUsage
                    });
                }
            }

            const couponDiscountValue = Number(coupon.discount_value || 0);
            let computedDiscountAmount = coupon.discount_type === 'PERCENTAGE'
                ? (parsedOrderAmount * couponDiscountValue) / 100
                : couponDiscountValue;

            computedDiscountAmount = Math.max(0, computedDiscountAmount);
            if (coupon.discount_type === 'PERCENTAGE' && coupon.maximum_discount_amount !== null) {
                computedDiscountAmount = Math.min(computedDiscountAmount, Number(coupon.maximum_discount_amount));
            }
            computedDiscountAmount = Math.min(computedDiscountAmount, parsedOrderAmount);

            const resolvedDiscountAmount = hasDiscountAmount
                ? Math.min(Math.max(0, parsedDiscountAmount), parsedOrderAmount)
                : computedDiscountAmount;
            const resolvedFinalAmount = hasFinalAmount
                ? Math.max(0, parsedFinalAmount)
                : Math.max(0, parsedOrderAmount - resolvedDiscountAmount);

            const usageInsertRes = await new sql.Request(transaction)
                .input('coupon_id', sql.Int, coupon.id)
                .input('shopowner_user_id', sql.Int, resolvedOwnerUserId)
                .input('shopowner_id', sql.NVarChar, ownerCode)
                .input('customer_user_id', sql.Int, Number.isInteger(parsedCustomerUserId) && parsedCustomerUserId > 0 ? parsedCustomerUserId : null)
                .input('customer_name', sql.NVarChar, normalizedCustomerName)
                .input('customer_contact', sql.NVarChar, normalizedCustomerContact)
                .input('order_reference', sql.NVarChar, normalizedOrderReference)
                .input('order_amount', sql.Decimal(18, 2), Number(parsedOrderAmount.toFixed(2)))
                .input('discount_amount', sql.Decimal(18, 2), Number(resolvedDiscountAmount.toFixed(2)))
                .input('final_amount', sql.Decimal(18, 2), Number(resolvedFinalAmount.toFixed(2)))
                .input('currency', sql.NVarChar, normalizedCurrency)
                .input('metadata', sql.NVarChar(sql.MAX), normalizedMetadata)
                .query(`
                    INSERT INTO ${GL_COUPON_USAGE_TABLE} (
                        coupon_id,
                        shopowner_user_id,
                        shopowner_id,
                        customer_user_id,
                        customer_name,
                        customer_contact,
                        order_reference,
                        order_amount,
                        discount_amount,
                        final_amount,
                        currency,
                        metadata,
                        redeemed_at,
                        created_at
                    )
                    OUTPUT INSERTED.*
                    VALUES (
                        @coupon_id,
                        @shopowner_user_id,
                        @shopowner_id,
                        @customer_user_id,
                        @customer_name,
                        @customer_contact,
                        @order_reference,
                        @order_amount,
                        @discount_amount,
                        @final_amount,
                        @currency,
                        @metadata,
                        GETDATE(),
                        GETDATE()
                    )
                `);

            const usageCountRes = await new sql.Request(transaction)
                .input('coupon_id', sql.Int, coupon.id)
                .query(`
                    SELECT COUNT(*) AS usage_count, MAX(redeemed_at) AS last_redeemed_at
                    FROM ${GL_COUPON_USAGE_TABLE}
                    WHERE coupon_id = @coupon_id
                `);
            const usageCount = Number(usageCountRes.recordset?.[0]?.usage_count || 0);
            const lastRedeemedAt = usageCountRes.recordset?.[0]?.last_redeemed_at || null;

            await new sql.Request(transaction)
                .input('coupon_id', sql.Int, coupon.id)
                .input('usage_count', sql.Int, usageCount)
                .query(`
                    UPDATE ${GL_COUPONS_TABLE}
                    SET used_count = @usage_count,
                        updated_at = GETDATE()
                    WHERE id = @coupon_id
                `);

            await transaction.commit();

            return res.status(201).json({
                success: true,
                coupon: {
                    ...coupon,
                    used_count: usageCount,
                    usage_count: usageCount,
                    last_redeemed_at: lastRedeemedAt
                },
                usage_count: usageCount,
                usage: mapGLCouponUsageRecord(usageInsertRes.recordset[0])
            });
        } catch (transactionError) {
            try {
                await transaction.rollback();
            } catch (_) { }

            if (transactionError?.number === 2601 || transactionError?.number === 2627) {
                return res.status(409).json({ error: "Coupon usage already recorded for this order reference" });
            }
            throw transactionError;
        }
    } catch (err) {
        console.error("Error redeeming GL coupon:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// GET /api/gl/coupons/:couponId/usage-history
app.get('/api/gl/coupons/:couponId/usage-history', async (req, res) => {
    const parsedCouponId = Number(req.params.couponId);
    const { shopownerId, userId, limit } = req.query;

    if (!Number.isInteger(parsedCouponId) || parsedCouponId <= 0) {
        return res.status(400).json({ error: "Valid couponId is required" });
    }

    const parsedLimit = Number(limit);
    const historyLimit = Number.isInteger(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, 200)
        : 50;

    try {
        const pool = await sql.connect();
        await ensureGLCouponsSchema(pool);
        await ensureGLCouponUsageSchema(pool);

        const resolvedUserId = await resolveGlShopownerUserId(pool, { shopownerId, userId });
        if (!resolvedUserId) {
            return res.status(400).json({ error: "Shop Owner ID or User ID is required" });
        }

        const ownerRes = await pool.request()
            .input('shopowner_user_id', sql.Int, resolvedUserId)
            .query('SELECT TOP 1 shopowner_id FROM shopowners WHERE id = @shopowner_user_id');
        const ownerCode = ownerRes.recordset?.[0]?.shopowner_id
            ? String(ownerRes.recordset[0].shopowner_id)
            : null;

        const couponRes = await pool.request()
            .input('coupon_id', sql.Int, parsedCouponId)
            .input('shopowner_user_id', sql.Int, resolvedUserId)
            .input('shopowner_code', sql.NVarChar, ownerCode)
            .query(`
                SELECT TOP 1
                    c.*,
                    ISNULL(usageAgg.usage_count, 0) AS usage_count,
                    usageAgg.last_redeemed_at
                FROM ${GL_COUPONS_TABLE} c
                OUTER APPLY (
                    SELECT
                        COUNT(*) AS usage_count,
                        MAX(u.redeemed_at) AS last_redeemed_at
                    FROM ${GL_COUPON_USAGE_TABLE} u
                    WHERE u.coupon_id = c.id
                ) usageAgg
                WHERE c.id = @coupon_id
                  AND (
                        c.shopowner_user_id = @shopowner_user_id
                        OR (@shopowner_code IS NOT NULL AND c.shopowner_id = @shopowner_code)
                  )
            `);

        if (couponRes.recordset.length === 0) {
            return res.status(404).json({ error: "Coupon not found for this owner" });
        }

        const historyRes = await pool.request()
            .input('coupon_id', sql.Int, parsedCouponId)
            .input('history_limit', sql.Int, historyLimit)
            .query(`
                SELECT TOP (@history_limit) *
                FROM ${GL_COUPON_USAGE_TABLE}
                WHERE coupon_id = @coupon_id
                ORDER BY redeemed_at DESC, id DESC
            `);

        return res.json({
            coupon: mapGLCouponRecord(couponRes.recordset[0]),
            usage_count: Number(couponRes.recordset[0].usage_count || 0),
            history: (historyRes.recordset || []).map(mapGLCouponUsageRecord)
        });
    } catch (err) {
        console.error("Error fetching GL coupon usage history:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// GET /api/gl/shops
app.get('/api/gl/shops', async (req, res) => {
    try {
        const pool = await sql.connect();
        await ensureGLShopProfileLiveSchema(pool);
        const result = await pool.request().query(`
            SELECT 
                sp.*, 
                s.shop_name, 
                s.full_name as owner_name, 
                s.latitude, 
                s.longitude,
                s.identifier as contact_info,
                s.phone,
                ISNULL(branchAgg.branch_count, 0) AS branch_count,
                mainBranch.id AS main_branch_id,
                mainBranch.name AS main_branch_name,
                mainBranch.location AS main_branch_location,
                COALESCE(mainBranch.name, 'Main Branch') AS branch_name,
                COALESCE(mainBranch.location, '') AS branch_location
            FROM ${GL_SHOP_PROFILES_TABLE} sp
            JOIN shopowners s ON sp.shopowner_id = s.id
            OUTER APPLY (
                SELECT COUNT(*) AS branch_count
                FROM branches b
                WHERE b.user_id = s.id
                   OR (s.shopowner_id IS NOT NULL AND b.shopowner_id = s.shopowner_id)
            ) branchAgg
            OUTER APPLY (
                SELECT TOP 1 b.id, b.name, b.location
                FROM branches b
                WHERE b.user_id = s.id
                   OR (s.shopowner_id IS NOT NULL AND b.shopowner_id = s.shopowner_id)
                ORDER BY CASE WHEN ISNULL(b.is_main, 0) = 1 THEN 0 ELSE 1 END, b.created_at ASC, b.id ASC
            ) mainBranch
            WHERE sp.is_marketplace_live = 1
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching shops:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// GET /api/gl/shops/:slug
app.get('/api/gl/shops/:slug', async (req, res) => {
    const { slug } = req.params;
    try {
        const pool = await sql.connect();
        await ensureGLShopProfileLiveSchema(pool);
        const result = await pool.request()
            .input('slug', sql.NVarChar, slug)
            .query(`
                SELECT 
                    sp.*, 
                    s.shop_name, 
                    s.full_name as owner_name, 
                    s.latitude, 
                    s.longitude,
                    s.identifier as contact_info,
                    s.phone,
                    s.id AS owner_user_id,
                    s.shopowner_id AS owner_shopowner_id,
                    ISNULL(branchAgg.branch_count, 0) AS branch_count,
                    mainBranch.id AS main_branch_id,
                    mainBranch.name AS main_branch_name,
                    mainBranch.location AS main_branch_location
                FROM ${GL_SHOP_PROFILES_TABLE} sp
                JOIN shopowners s ON sp.shopowner_id = s.id
                OUTER APPLY (
                    SELECT COUNT(*) AS branch_count
                    FROM branches b
                    WHERE b.user_id = s.id
                       OR (s.shopowner_id IS NOT NULL AND b.shopowner_id = s.shopowner_id)
                ) branchAgg
                OUTER APPLY (
                    SELECT TOP 1 b.id, b.name, b.location
                    FROM branches b
                    WHERE b.user_id = s.id
                       OR (s.shopowner_id IS NOT NULL AND b.shopowner_id = s.shopowner_id)
                    ORDER BY CASE WHEN ISNULL(b.is_main, 0) = 1 THEN 0 ELSE 1 END, b.created_at ASC, b.id ASC
                ) mainBranch
                WHERE sp.shop_slug = @slug
                  AND sp.is_marketplace_live = 1
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: "Shop not found" });
        }

        const shop = result.recordset[0];
        const branchesRes = await pool.request()
            .input('owner_user_id', sql.Int, shop.owner_user_id)
            .input('owner_shopowner_id', sql.NVarChar, shop.owner_shopowner_id || null)
            .query(`
                SELECT
                    b.id,
                    b.name,
                    b.location,
                    b.status,
                    ISNULL(b.is_main, 0) AS is_main,
                    b.created_at
                FROM branches b
                WHERE b.user_id = @owner_user_id
                   OR (@owner_shopowner_id IS NOT NULL AND b.shopowner_id = @owner_shopowner_id)
                ORDER BY CASE WHEN ISNULL(b.is_main, 0) = 1 THEN 0 ELSE 1 END, b.created_at ASC, b.id ASC
            `);

        const branches = branchesRes.recordset || [];
        const { owner_user_id, owner_shopowner_id, ...shopPayload } = shop;
        const mainBranch = branches.find((b) => Number(b.is_main || 0) === 1) || branches[0] || null;
        res.json({
            ...shopPayload,
            branch_count: branches.length || Number(shopPayload.branch_count || 0),
            branches,
            main_branch: mainBranch,
            branch_name: mainBranch?.name || shopPayload.main_branch_name || 'Main Branch',
            branch_location: mainBranch?.location || shopPayload.main_branch_location || ''
        });
    } catch (err) {
        console.error("Error fetching shop details:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// GET /api/gl/shops/:slug/branches
app.get('/api/gl/shops/:slug/branches', async (req, res) => {
    const { slug } = req.params;

    try {
        const pool = await sql.connect();
        await ensureGLShopProfileLiveSchema(pool);

        const shopRes = await pool.request()
            .input('slug', sql.NVarChar, slug)
            .query(`
                SELECT TOP 1 s.id AS owner_user_id, s.shopowner_id AS owner_shopowner_id
                FROM ${GL_SHOP_PROFILES_TABLE} sp
                JOIN shopowners s ON sp.shopowner_id = s.id
                WHERE sp.shop_slug = @slug
                  AND sp.is_marketplace_live = 1
            `);

        if (shopRes.recordset.length === 0) {
            return res.status(404).json({ error: "Shop not found" });
        }

        const owner = shopRes.recordset[0];
        const branchesRes = await pool.request()
            .input('owner_user_id', sql.Int, owner.owner_user_id)
            .input('owner_shopowner_id', sql.NVarChar, owner.owner_shopowner_id || null)
            .query(`
                SELECT
                    b.id,
                    b.name,
                    b.location,
                    b.status,
                    ISNULL(b.is_main, 0) AS is_main,
                    b.created_at
                FROM branches b
                WHERE b.user_id = @owner_user_id
                   OR (@owner_shopowner_id IS NOT NULL AND b.shopowner_id = @owner_shopowner_id)
                ORDER BY CASE WHEN ISNULL(b.is_main, 0) = 1 THEN 0 ELSE 1 END, b.created_at ASC, b.id ASC
            `);

        return res.json(branchesRes.recordset || []);
    } catch (err) {
        console.error("Error fetching shop branches:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// GET /api/gl/shops/:slug/products
app.get('/api/gl/shops/:slug/products', async (req, res) => {
    const { slug } = req.params;
    const { branchId, branch } = req.query;

    try {
        const pool = await sql.connect();
        await ensureGLShopProfileLiveSchema(pool);
        await ensureProductMarketplaceLiveSchema(pool);

        // 1. Resolve shop owner from slug
        const shopRes = await pool.request()
            .input('slug', sql.NVarChar, slug)
            .query(`
                SELECT TOP 1
                    sp.shopowner_id AS owner_user_id,
                    s.shopowner_id AS owner_shopowner_id
                FROM ${GL_SHOP_PROFILES_TABLE} sp
                JOIN shopowners s ON sp.shopowner_id = s.id
                WHERE sp.shop_slug = @slug
                  AND sp.is_marketplace_live = 1
            `);

        if (shopRes.recordset.length === 0) {
            return res.status(404).json({ error: "Shop not found" });
        }

        const ownerUserId = shopRes.recordset[0].owner_user_id;
        const ownerShopownerId = shopRes.recordset[0].owner_shopowner_id || null;

        let branchFilter = null;
        const parsedBranchId = Number(branchId);
        const branchName = String(branch || '').trim();

        if (Number.isFinite(parsedBranchId) && parsedBranchId > 0) {
            const branchRes = await pool.request()
                .input('branch_id', sql.Int, parsedBranchId)
                .input('owner_user_id', sql.Int, ownerUserId)
                .input('owner_shopowner_id', sql.NVarChar, ownerShopownerId)
                .query(`
                    SELECT TOP 1 name
                    FROM branches
                    WHERE id = @branch_id
                      AND (
                          user_id = @owner_user_id
                          OR (@owner_shopowner_id IS NOT NULL AND shopowner_id = @owner_shopowner_id)
                      )
                `);

            if (branchRes.recordset.length === 0) {
                return res.status(404).json({ error: "Branch not found for this shop" });
            }
            branchFilter = branchRes.recordset[0].name;
        } else if (branchName) {
            const branchRes = await pool.request()
                .input('branch_name', sql.NVarChar, branchName)
                .input('owner_user_id', sql.Int, ownerUserId)
                .input('owner_shopowner_id', sql.NVarChar, ownerShopownerId)
                .query(`
                    SELECT TOP 1 name
                    FROM branches
                    WHERE name = @branch_name
                      AND (
                          user_id = @owner_user_id
                          OR (@owner_shopowner_id IS NOT NULL AND shopowner_id = @owner_shopowner_id)
                      )
                `);

            if (branchRes.recordset.length === 0) {
                return res.status(404).json({ error: "Branch not found for this shop" });
            }
            branchFilter = branchRes.recordset[0].name;
        }

        // 2. Get products for this shop owner (optionally by selected branch)
        const productReq = pool.request()
            .input('userId', sql.Int, ownerUserId)
            .input('ownerShopownerId', sql.NVarChar, ownerShopownerId);
        let productQuery = `
                SELECT p.* FROM products p
                WHERE (
                        p.user_id = @userId
                        OR (@ownerShopownerId IS NOT NULL AND p.shopowner_id = @ownerShopownerId)
                )
                  AND ISNULL(p.stock_quantity, 0) > 0
                  AND UPPER(ISNULL(p.status, '')) <> 'OUT OF STOCK'
                  AND ISNULL(p.is_marketplace_live, 1) = 1
        `;

        if (branchFilter) {
            productReq.input('branch_name', sql.NVarChar, branchFilter);
            productQuery += ' AND p.branch = @branch_name';
        }

        productQuery += ' ORDER BY p.created_at DESC';
        const result = await productReq.query(productQuery);

        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching shop products:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ==========================================
// CHAT SYSTEM APIS
// ==========================================
const CHAT_TYPING_TTL_SECONDS = 6;
const CHAT_TYPING_WINDOW_MS = CHAT_TYPING_TTL_SECONDS * 1000;

// GET /api/chat/conversations
app.get('/api/chat/conversations', async (req, res) => {
    const { shopownerId, userId } = req.query;

    if (!shopownerId && !userId) {
        return res.status(400).json({ error: "Shop Owner ID or User ID is required" });
    }

    try {
        const pool = await sql.connect();

        let resolvedShopownerId = shopownerId;

        if (!resolvedShopownerId && userId) {
            const userRes = await pool.request()
                .input('uid', sql.Int, userId)
                .query("SELECT shopowner_id FROM shopowners WHERE id = @uid");
            if (userRes.recordset.length > 0) {
                resolvedShopownerId = userRes.recordset[0].shopowner_id;
            }
        }

        if (!resolvedShopownerId) {
            return res.status(400).json({ error: "Could not resolve Shop Owner ID" });
        }

        const query = `
            SELECT
                c.id,
                c.user_id,
                c.shopowner_id,
                c.last_message,
                COALESCE(c.last_message_at, c.created_at) as last_updated,
                'Active' as status,
                u.full_name as user_name,
                u.image_url as user_image,
                (
                    SELECT COUNT(*)
                    FROM [gold_lagbe_main].[dbo].[GL_Messages] m
                    WHERE m.conversation_id = c.id
                      AND m.is_read = 0
                      AND m.sender_type = 'user'
                ) as unread_count
            FROM [gold_lagbe_main].[dbo].[GL_Conversations] c
            LEFT JOIN [gold_lagbe_main].[dbo].[GL_Users] u ON c.user_id = u.id
            WHERE c.shopowner_id = @shopowner_id
            ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
        `;

        const result = await pool.request()
            .input('shopowner_id', sql.NVarChar, resolvedShopownerId)
            .query(query);

        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching conversations:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// GET /api/chat/messages/:conversationId
app.get('/api/chat/messages/:conversationId', async (req, res) => {
    const { conversationId } = req.params;

    try {
        const pool = await sql.connect();
        const result = await pool.request()
            .input('conversation_id', sql.Int, conversationId)
            .query(`
                SELECT
                    id,
                    conversation_id,
                    sender_type,
                    message,
                    created_at,
                    is_read
                FROM [gold_lagbe_main].[dbo].[GL_Messages]
                WHERE conversation_id = @conversation_id
                ORDER BY created_at ASC
            `);

        const messages = (result.recordset || []).map((msg) => ({
            ...msg,
            timestamp: msg.created_at
        }));

        res.json(messages);
    } catch (err) {
        console.error("Error fetching messages:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST /api/chat/messages
app.post('/api/chat/messages', async (req, res) => {
    const { conversationId, senderType, message, shopownerId, userId } = req.body;

    if (!senderType || !message || !shopownerId) {
        return res.status(400).json({ error: "Sender type, message and shopownerId are required" });
    }

    try {
        const pool = await sql.connect();
        let convId = conversationId;

        if (!convId && userId) {
            const existingConversation = await pool.request()
                .input('user_id', sql.Int, userId)
                .input('shopowner_id', sql.NVarChar, shopownerId)
                .query(`
                    SELECT TOP 1 id
                    FROM [gold_lagbe_main].[dbo].[GL_Conversations]
                    WHERE user_id = @user_id AND shopowner_id = @shopowner_id
                `);

            if (existingConversation.recordset.length > 0) {
                convId = existingConversation.recordset[0].id;
            } else {
                const createdConversation = await pool.request()
                    .input('user_id', sql.Int, userId)
                    .input('shopowner_id', sql.NVarChar, shopownerId)
                    .input('last_message', sql.NVarChar, message)
                    .query(`
                        INSERT INTO [gold_lagbe_main].[dbo].[GL_Conversations] (user_id, shopowner_id, last_message, last_message_at)
                        OUTPUT INSERTED.id
                        VALUES (@user_id, @shopowner_id, @last_message, GETDATE())
                    `);
                convId = createdConversation.recordset[0].id;
            }
        }

        if (!convId) {
            return res.status(400).json({ error: "Conversation ID or userId is required" });
        }

        const msgResult = await pool.request()
            .input('conversation_id', sql.Int, convId)
            .input('sender_type', sql.NVarChar, senderType)
            .input('message', sql.NVarChar, message)
            .query(`
                INSERT INTO [gold_lagbe_main].[dbo].[GL_Messages] (conversation_id, sender_type, message, is_read)
                OUTPUT INSERTED.*
                VALUES (@conversation_id, @sender_type, @message, 0)
            `);

        await pool.request()
            .input('conversation_id', sql.Int, convId)
            .input('last_message', sql.NVarChar, message)
            .query(`
                UPDATE [gold_lagbe_main].[dbo].[GL_Conversations]
                SET last_message = @last_message, last_message_at = GETDATE()
                WHERE id = @conversation_id
            `);

        if (senderType === 'shopowner' || senderType === 'user') {
            const senderTypingColumn = senderType === 'shopowner' ? 'shopowner_typing_at' : 'user_typing_at';
            await pool.request()
                .input('conversation_id', sql.Int, convId)
                .query(`
                    UPDATE [gold_lagbe_main].[dbo].[GL_Conversations]
                    SET ${senderTypingColumn} = NULL
                    WHERE id = @conversation_id
                `);
        }

        const savedMessage = msgResult.recordset[0];
        res.json({
            ...savedMessage,
            timestamp: savedMessage.created_at || null
        });
    } catch (err) {
        console.error("Error sending message:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// PUT /api/chat/typing
app.put('/api/chat/typing', async (req, res) => {
    const { conversationId, senderType, isTyping } = req.body || {};
    const normalizedSenderType = String(senderType || '').toLowerCase();
    const parsedConversationId = Number(conversationId);

    if (!Number.isInteger(parsedConversationId) || parsedConversationId <= 0) {
        return res.status(400).json({ error: "Valid conversationId is required" });
    }

    if (normalizedSenderType !== 'shopowner' && normalizedSenderType !== 'user') {
        return res.status(400).json({ error: "senderType must be 'shopowner' or 'user'" });
    }

    try {
        const pool = await sql.connect();
        const typingColumn = normalizedSenderType === 'shopowner' ? 'shopowner_typing_at' : 'user_typing_at';
        const shouldMarkTyping = Boolean(isTyping);
        const typingColumnExists = await pool.request().query(`
            SELECT TOP 1 1 AS ok
            FROM [gold_lagbe_main].INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = 'dbo'
              AND TABLE_NAME = 'GL_Conversations'
              AND COLUMN_NAME = '${typingColumn}'
        `);

        if (typingColumnExists.recordset.length === 0) {
            return res.json({
                success: true,
                conversation_id: parsedConversationId,
                sender_type: normalizedSenderType,
                is_typing: false,
                ttl_seconds: CHAT_TYPING_TTL_SECONDS,
                supported: false
            });
        }

        const result = await pool.request()
            .input('conversation_id', sql.Int, parsedConversationId)
            .input('is_typing', sql.Bit, shouldMarkTyping ? 1 : 0)
            .query(`
                UPDATE [gold_lagbe_main].[dbo].[GL_Conversations]
                SET ${typingColumn} = CASE WHEN @is_typing = 1 THEN GETDATE() ELSE NULL END
                WHERE id = @conversation_id
            `);

        if (!result.rowsAffected?.[0]) {
            return res.status(404).json({ error: "Conversation not found" });
        }

        return res.json({
            success: true,
            conversation_id: parsedConversationId,
            sender_type: normalizedSenderType,
            is_typing: shouldMarkTyping,
            ttl_seconds: CHAT_TYPING_TTL_SECONDS
        });
    } catch (err) {
        console.error("Error updating typing state:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// GET /api/chat/typing/:conversationId
app.get('/api/chat/typing/:conversationId', async (req, res) => {
    const parsedConversationId = Number(req.params.conversationId);
    const viewerType = String(req.query.viewerType || '').toLowerCase();

    if (!Number.isInteger(parsedConversationId) || parsedConversationId <= 0) {
        return res.status(400).json({ error: "Valid conversationId is required" });
    }

    if (viewerType !== 'shopowner' && viewerType !== 'user') {
        return res.status(400).json({ error: "viewerType must be 'shopowner' or 'user'" });
    }

    try {
        const pool = await sql.connect();
        const remoteSenderType = viewerType === 'shopowner' ? 'user' : 'shopowner';
        const remoteTypingColumn = remoteSenderType === 'shopowner' ? 'shopowner_typing_at' : 'user_typing_at';
        const typingColumnExists = await pool.request().query(`
            SELECT TOP 1 1 AS ok
            FROM [gold_lagbe_main].INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = 'dbo'
              AND TABLE_NAME = 'GL_Conversations'
              AND COLUMN_NAME = '${remoteTypingColumn}'
        `);

        if (typingColumnExists.recordset.length === 0) {
            return res.json({
                conversation_id: parsedConversationId,
                viewer_type: viewerType,
                remote_sender_type: remoteSenderType,
                is_typing: false,
                last_typed_at: null,
                ttl_seconds: CHAT_TYPING_TTL_SECONDS,
                supported: false
            });
        }

        const result = await pool.request()
            .input('conversation_id', sql.Int, parsedConversationId)
            .query(`
                SELECT ${remoteTypingColumn} AS remote_typing_at
                FROM [gold_lagbe_main].[dbo].[GL_Conversations]
                WHERE id = @conversation_id
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: "Conversation not found" });
        }

        const remoteTypingAt = result.recordset[0].remote_typing_at;
        const lastTypedMs = remoteTypingAt ? new Date(remoteTypingAt).getTime() : NaN;
        const isTypingNow = Number.isFinite(lastTypedMs) && (Date.now() - lastTypedMs) <= CHAT_TYPING_WINDOW_MS;

        return res.json({
            conversation_id: parsedConversationId,
            viewer_type: viewerType,
            remote_sender_type: remoteSenderType,
            is_typing: isTypingNow,
            last_typed_at: remoteTypingAt || null,
            ttl_seconds: CHAT_TYPING_TTL_SECONDS
        });
    } catch (err) {
        console.error("Error fetching typing state:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// PUT /api/chat/messages/read/:conversationId
app.put('/api/chat/messages/read/:conversationId', async (req, res) => {
    const { conversationId } = req.params;
    const { senderType } = req.body;

    try {
        const pool = await sql.connect();
        const targetSenderType = senderType === 'shopowner' ? 'user' : 'shopowner';

        await pool.request()
            .input('conversation_id', sql.Int, conversationId)
            .input('sender_type', sql.NVarChar, targetSenderType)
            .query(`
                UPDATE [gold_lagbe_main].[dbo].[GL_Messages]
                SET is_read = 1
                WHERE conversation_id = @conversation_id AND sender_type = @sender_type AND is_read = 0
            `);

        res.json({ success: true });
    } catch (err) {
        console.error("Error marking messages as read:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

module.exports = app;
