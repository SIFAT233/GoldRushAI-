-- Database Schema (Aligned with setup_db.js + finish_gl_migration.js)

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
CREATE TABLE users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    full_name NVARCHAR(255) NOT NULL,
    phone NVARCHAR(50),
    identifier NVARCHAR(255) UNIQUE NOT NULL,
    password NVARCHAR(255) NOT NULL,
    latitude FLOAT,
    longitude FLOAT,
    created_at DATETIME DEFAULT getdate()
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='suppliers' AND xtype='U')
CREATE TABLE suppliers (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(255) NOT NULL,
    phone NVARCHAR(50),
    contact_person NVARCHAR(255),
    address NVARCHAR(MAX),
    created_at DATETIME DEFAULT getdate()
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='products' AND xtype='U')
CREATE TABLE products (
    id INT IDENTITY(1,1) PRIMARY KEY,
    product_code NVARCHAR(50) UNIQUE,
    name NVARCHAR(255) NOT NULL,
    category NVARCHAR(100),
    karat NVARCHAR(50),
    weight DECIMAL(10, 2),
    price DECIMAL(18, 2),
    stock_quantity INT DEFAULT 0,
    supplier_id INT FOREIGN KEY REFERENCES suppliers(id),
    image_url NVARCHAR(MAX),
    status NVARCHAR(50) DEFAULT 'In Stock',
    created_at DATETIME DEFAULT getdate(),
    branch NVARCHAR(255) DEFAULT 'Main Branch',
    user_id INT,
    shopowner_id NVARCHAR(50)
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='customers' AND xtype='U')
CREATE TABLE customers (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(255) NOT NULL,
    phone NVARCHAR(20) UNIQUE,
    email NVARCHAR(255),
    address NVARCHAR(MAX),
    type NVARCHAR(50) DEFAULT 'New',
    total_spent DECIMAL(18, 2) DEFAULT 0,
    visits_count INT DEFAULT 0,
    last_visit DATETIME,
    created_at DATETIME DEFAULT getdate(),
    branch NVARCHAR(255) DEFAULT 'Main Branch',
    user_id INT,
    shopowner_id NVARCHAR(50)
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='shopowners' AND xtype='U')
CREATE TABLE shopowners (
    id INT IDENTITY(1,1) PRIMARY KEY,
    full_name NVARCHAR(255) NOT NULL,
    phone NVARCHAR(50),
    identifier NVARCHAR(255) UNIQUE NOT NULL,
    password NVARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT getdate(),
    latitude FLOAT,
    longitude FLOAT,
    branch NVARCHAR(255) DEFAULT 'Main Branch',
    shop_name NVARCHAR(255),
    branch_count INT DEFAULT 1,
    tax_id NVARCHAR(100),
    subscription_plan NVARCHAR(50) DEFAULT 'free',
    subscription_status NVARCHAR(50) DEFAULT 'active',
    subscription_end_date DATETIME,
    shopowner_id NVARCHAR(50),
    account_approval_status NVARCHAR(50) DEFAULT 'approved',
    approval_requested_at DATETIME,
    approval_reviewed_at DATETIME,
    approval_note NVARCHAR(500)
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='shopowner_documents' AND xtype='U')
CREATE TABLE shopowner_documents (
    id INT IDENTITY(1,1) PRIMARY KEY,
    shopowner_user_id INT NOT NULL,
    shopowner_id NVARCHAR(50),
    document_type NVARCHAR(100) NOT NULL,
    document_label NVARCHAR(255),
    file_name NVARCHAR(255) NOT NULL,
    mime_type NVARCHAR(120),
    file_size_bytes BIGINT,
    file_data NVARCHAR(MAX) NOT NULL,
    uploaded_at DATETIME DEFAULT getdate()
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='branches' AND xtype='U')
CREATE TABLE branches (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(255) NOT NULL,
    location NVARCHAR(255) NOT NULL,
    status NVARCHAR(50) DEFAULT 'Active',
    daily_sales DECIMAL(18, 2) DEFAULT 0,
    stock_value NVARCHAR(50) DEFAULT '0',
    branch_passcode NVARCHAR(6) DEFAULT '123456',
    is_main BIT DEFAULT 0,
    created_at DATETIME DEFAULT getdate(),
    branch NVARCHAR(255) DEFAULT 'Main Branch',
    user_id INT,
    shopowner_id NVARCHAR(50)
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='sales' AND xtype='U')
CREATE TABLE sales (
    id INT IDENTITY(1,1) PRIMARY KEY,
    customer_id INT FOREIGN KEY REFERENCES customers(id),
    total_amount DECIMAL(18, 2) NOT NULL,
    tax_amount DECIMAL(18, 2) DEFAULT 0,
    discount_amount DECIMAL(18, 2) DEFAULT 0,
    final_amount DECIMAL(18, 2) NOT NULL,
    payment_method NVARCHAR(50),
    sale_date DATETIME DEFAULT getdate(),
    created_by INT FOREIGN KEY REFERENCES users(id),
    transaction_id NVARCHAR(100) UNIQUE,
    status NVARCHAR(50) DEFAULT 'Completed',
    branch NVARCHAR(255) DEFAULT 'Main Branch',
    user_id INT,
    shopowner_id NVARCHAR(50)
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='sale_items' AND xtype='U')
CREATE TABLE sale_items (
    id INT IDENTITY(1,1) PRIMARY KEY,
    sale_id INT FOREIGN KEY REFERENCES sales(id),
    product_id INT FOREIGN KEY REFERENCES products(id),
    quantity INT NOT NULL,
    price_at_sale DECIMAL(18, 2) NOT NULL,
    weight_at_sale DECIMAL(10, 2),
    total_price DECIMAL(18, 2) NOT NULL
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='installments' AND xtype='U')
CREATE TABLE installments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    customer_id INT FOREIGN KEY REFERENCES customers(id),
    sale_id INT FOREIGN KEY REFERENCES sales(id),
    item_description NVARCHAR(255),
    total_amount DECIMAL(18, 2) NOT NULL,
    paid_amount DECIMAL(18, 2) DEFAULT 0,
    due_amount AS (total_amount - paid_amount),
    due_date DATE,
    status NVARCHAR(50) DEFAULT 'Active',
    created_at DATETIME DEFAULT getdate(),
    branch NVARCHAR(255) DEFAULT 'Main Branch',
    user_id INT,
    shopowner_id NVARCHAR(50)
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='installment_payments' AND xtype='U')
CREATE TABLE installment_payments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    installment_id INT FOREIGN KEY REFERENCES installments(id),
    amount DECIMAL(18, 2) NOT NULL,
    payment_date DATETIME DEFAULT getdate(),
    payment_method NVARCHAR(50),
    notes NVARCHAR(MAX)
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='repair_orders' AND xtype='U')
CREATE TABLE repair_orders (
    id INT IDENTITY(1,1) PRIMARY KEY,
    customer_id INT FOREIGN KEY REFERENCES customers(id),
    item_description NVARCHAR(MAX),
    issue_description NVARCHAR(MAX),
    estimated_cost DECIMAL(18, 2),
    advance_payment DECIMAL(18, 2) DEFAULT 0,
    status NVARCHAR(50) DEFAULT 'Received',
    received_date DATETIME DEFAULT getdate(),
    delivery_date DATETIME
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='repair_tickets' AND xtype='U')
CREATE TABLE repair_tickets (
    id INT IDENTITY(1,1) PRIMARY KEY,
    ticket_id NVARCHAR(50) NOT NULL,
    customer_name NVARCHAR(255) NOT NULL,
    customer_phone NVARCHAR(50),
    item_name NVARCHAR(255) NOT NULL,
    issue_description NVARCHAR(MAX) NOT NULL,
    received_date DATETIME DEFAULT getdate(),
    delivery_date DATETIME,
    status NVARCHAR(50) DEFAULT 'Active',
    estimated_cost DECIMAL(18, 2) DEFAULT 0,
    created_at DATETIME DEFAULT getdate(),
    branch NVARCHAR(255) DEFAULT 'Main Branch',
    user_id INT,
    shopowner_id NVARCHAR(50)
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='manufacturing_orders' AND xtype='U')
CREATE TABLE manufacturing_orders (
    id INT IDENTITY(1,1) PRIMARY KEY,
    order_id NVARCHAR(50) NOT NULL,
    customer_name NVARCHAR(255) NOT NULL,
    product_name NVARCHAR(255) NOT NULL,
    karigar_name NVARCHAR(255),
    status NVARCHAR(50) NOT NULL,
    gold_weight FLOAT,
    due_date DATETIME,
    created_at DATETIME DEFAULT getdate(),
    branch NVARCHAR(255) DEFAULT 'Main Branch',
    user_id INT,
    shopowner_id NVARCHAR(50)
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='stock_transfers' AND xtype='U')
CREATE TABLE stock_transfers (
    id INT IDENTITY(1,1) PRIMARY KEY,
    transfer_id NVARCHAR(50) NOT NULL,
    from_branch NVARCHAR(255) NOT NULL,
    to_branch NVARCHAR(255) NOT NULL,
    items NVARCHAR(MAX) NOT NULL,
    transfer_date DATETIME DEFAULT getdate(),
    status NVARCHAR(50) DEFAULT 'Pending',
    created_at DATETIME DEFAULT getdate(),
    shopowner_id NVARCHAR(50),
    user_id INT
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='GL_Users' AND xtype='U')
CREATE TABLE GL_Users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    full_name NVARCHAR(255),
    phone NVARCHAR(50) UNIQUE NOT NULL,
    password_hash NVARCHAR(255),
    address NVARCHAR(MAX),
    created_at DATETIME DEFAULT getdate()
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='GL_ShopProfiles' AND xtype='U')
CREATE TABLE GL_ShopProfiles (
    id INT IDENTITY(1,1) PRIMARY KEY,
    shopowner_id INT,
    shop_slug NVARCHAR(255) UNIQUE,
    logo_url NVARCHAR(MAX),
    banner_url NVARCHAR(MAX),
    rating DECIMAL(3, 2),
    is_verified BIT DEFAULT 0,
    is_marketplace_live BIT DEFAULT 1
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='GL_Orders' AND xtype='U')
CREATE TABLE GL_Orders (
    id INT IDENTITY(1,1) PRIMARY KEY,
    order_number NVARCHAR(50) UNIQUE,
    user_id INT FOREIGN KEY REFERENCES GL_Users(id),
    shopowner_id INT,
    total_amount DECIMAL(18, 2),
    payment_status NVARCHAR(50),
    order_status NVARCHAR(50),
    delivery_address NVARCHAR(MAX),
    created_at DATETIME DEFAULT getdate()
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='GL_OrderItems' AND xtype='U')
CREATE TABLE GL_OrderItems (
    id INT IDENTITY(1,1) PRIMARY KEY,
    order_id INT FOREIGN KEY REFERENCES GL_Orders(id),
    product_id INT,
    quantity INT,
    price_at_purchase DECIMAL(18, 2),
    making_charge DECIMAL(18, 2)
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='GL_Cart' AND xtype='U')
CREATE TABLE GL_Cart (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT FOREIGN KEY REFERENCES GL_Users(id),
    product_id INT,
    quantity INT
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='GL_Reviews' AND xtype='U')
CREATE TABLE GL_Reviews (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT FOREIGN KEY REFERENCES GL_Users(id),
    product_id INT,
    rating INT,
    comment NVARCHAR(MAX),
    image_url NVARCHAR(MAX)
);
