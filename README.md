🏆 Gold Rush — Gold Shop Management System

A complete **Gold Shop Management System** designed to digitalize and simplify the management of gold shops, including sales, purchases, inventory, customers, suppliers, payments, installments, branches, invoices, reports, and gold price prediction.

The system provides a centralized platform for managing day-to-day gold shop operations while maintaining accurate inventory, financial records, customer information, and branch-level activities.

---

📌 Project Overview

**Gold Rush** is a full-stack web-based Gold Shop Management System developed to replace manual and disconnected shop management processes with an integrated digital solution.

The system supports:

* Multi-branch management
* Customer management
* Employee management
* Gold product management
* Gold price management
* Inventory management
* Supplier and supply tracking
* Gold purchase management
* Gold sales management
* Return and exchange management
* Payment management
* Installment management
* Automatic invoice generation
* Notifications and alerts
* Business reports and analytics
* Gold price prediction using Machine Learning
* Role-based access control
* Audit logging

---

🎯 Objectives

The main objectives of Gold Rush are to:

* Digitize gold shop management activities.
* Maintain accurate gold inventory records.
* Track sales, purchases, returns, and exchanges.
* Manage customers and their transaction history.
* Manage suppliers and gold supplies.
* Track payments and installment plans.
* Generate professional invoices and receipts.
* Provide branch-wise business monitoring.
* Provide useful reports and analytics.
* Maintain secure role-based access.
* Provide historical and predicted gold price information.

---

✨ Key Features

🔐 Authentication & Authorization

* Secure login
* Password hashing
* JWT authentication
* Role-based access control
* Protected routes
* User session management

👥 Customer Management

* Add customers
* Update customer information
* Search customers
* Customer profiles
* Purchase history
* Payment history
* Installment history
* Return history
* Exchange history

 🏢 Branch Management

* Create branches
* Update branch information
* Activate/deactivate branches
* Assign branch managers
* Branch-specific sales
* Branch-specific inventory
* Branch performance monitoring

👨‍💼 Employee Management

* Add employees
* Update employees
* Assign roles
* Assign branches
* Activate/deactivate employees
* Employee information management

💍 Gold Product Management

Manage gold products with information such as:

* Product code
* Product name
* Category
* Karat
* Weight
* Making charge
* Purchase price
* Selling price
* Description
* Product status

 🪙 Gold Price Management

* Current gold price
* Karat-wise gold price
* Price history
* Price updates
* Effective date
* Historical price tracking

Supported karats may include:

* 24K
* 22K
* 21K
* 18K

📦 Inventory Management

Track gold inventory in real time.

Features include:

* Stock in
* Stock out
* Stock adjustment
* Quantity tracking
* Weight tracking
* Karat tracking
* Damaged products
* Returned products
* Low-stock alerts
* Inventory valuation
* Inventory transaction history

 🚚 Supplier & Supply Management

Manage suppliers and incoming gold supplies.

Track:

* Supplier information
* Shipment information
* Product
* Quantity
* Weight
* Karat
* Cost
* Shipment status
* Expected date
* Received date

🛒 Purchase Management

Manage gold purchases from suppliers.

Purchase information includes:

* Supplier
* Branch
* Products
* Quantity
* Weight
* Karat
* Purchase price
* Tax
* Discount
* Total amount
* Payment status

Completed purchases automatically update inventory.

💰 Sales Management

Manage complete gold sales transactions.

Sales include:

* Customer selection
* Product selection
* Quantity
* Weight
* Karat
* Gold rate
* Making charge
* Tax
* Discount
* Total amount
* Payment method
* Partial payment
* Installment option

💳 Payment Management

Supported payment methods:

* Cash
* Card
* Bank Transfer
* Mobile Banking

The system supports:

* Full payment
* Partial payment
* Multiple payments
* Payment history
* Payment receipts

 📅 Installment Management

Customers can purchase products using installment plans.

Track:

* Total amount
* Down payment
* Installment amount
* Number of installments
* Due dates
* Paid amount
* Remaining amount
* Payment history

Installment statuses:

* Pending
* Partial
* Paid
* Overdue

🧾 Invoice Management

Automatically generate invoices for:

* Sales
* Purchases
* Returns
* Exchanges

Invoices contain:

* Invoice number
* Branch
* Customer
* Products
* Quantity
* Weight
* Karat
* Gold rate
* Making charge
* Tax
* Discount
* Total
* Paid amount
* Due amount

PDF invoice generation and printing are supported.

🔄 Return Management

Manage product returns using the original invoice.

Features:

* Select original invoice
* Select returned product
* Return quantity
* Return reason
* Refund calculation
* Inventory update
* Invoice update
* Refund/payment record

🔁 Gold Exchange Management

Customers can exchange old gold products for new products.

The system calculates:

* Old product value
* New product value
* Gold rate
* Weight difference
* Making charge
* Tax
* Discount
* Additional payment
* Refund

Inventory is updated for both old and new products.

🔔 Notifications

Notifications are generated for:

* Low inventory
* Installment due
* Overdue installment
* Payment confirmation
* New sale
* New purchase
* Gold price updates
* Supply received

 📊 Reports & Analytics

Generate reports for:

* Daily sales
* Monthly sales
* Purchases
* Inventory
* Profit
* Payments
* Installments
* Branch performance
* Supplier purchases
* Product sales

Reports support filtering by date and branch.

🤖 Gold Price Prediction

The system includes a Machine Learning-based gold price prediction service.

The AI service:

* Uses historical gold price data
* Processes historical information
* Trains a regression model
* Predicts future gold prices
* Provides prediction data through FastAPI
* Displays prediction results through the React frontend

---

🛠️ Technology Stack

### Frontend

* React
* Vite
* React Router
* Axios
* HTML5
* CSS3
* JavaScript

### Backend

* Node.js
* Express.js
* REST API
* JWT
* bcrypt
* MySQL2

### Database

* MySQL
* XAMPP
* phpMyAdmin

### Machine Learning

* Python
* FastAPI
* Pandas
* NumPy
* Scikit-learn

### Development Tools

* Visual Studio Code
* Git
* GitHub
* Postman
* XAMPP

---

## 🏗️ System Architecture

```text
                    ┌─────────────────────┐
                    │      React UI       │
                    │      Frontend       │
                    └──────────┬──────────┘
                               │
                              HTTP
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Express.js API    │
                    │      Backend        │
                    └──────────┬──────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
                    ▼                     ▼
          ┌─────────────────┐   ┌─────────────────┐
          │      MySQL      │   │   FastAPI AI    │
          │     XAMPP       │   │     Service     │
          └─────────────────┘   └────────┬────────┘
                                         │
                                         ▼
                                ┌─────────────────┐
                                │ Machine Learning│
                                │ Gold Prediction │
                                └─────────────────┘
```

---

## 📁 Project Structure

```text
Gold-Rush/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── layouts/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── context/
│   │   └── utils/
│   ├── public/
│   └── package.json
│
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── middlewares/
│   ├── validators/
│   ├── utils/
│   ├── server.js
│   └── package.json
│
├── ai-service/
│   ├── app/
│   ├── models/
│   ├── services/
│   ├── routes/
│   ├── data/
│   └── requirements.txt
│
├── database/
│   ├── gold_rush_db.sql
│   └── seed.sql
│
├── docs/
│
├── .gitignore
└── README.md
```

---

# 🚀 Installation & Setup

## 1. Clone the Repository

```bash
git clone https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
cd Gold-Rush
```

---

## 2. Start XAMPP

Open XAMPP Control Panel and start:

```text
Apache
MySQL
```

Then open:

```text
phpMyAdmin
```

---

## 3. Create MySQL Database

Create a database named:

```text
gold_rush_db
```

Import:

```text
database/gold_rush_db.sql
```

After importing, run the seed file if available:

```text
database/seed.sql
```

---

# ⚙️ Backend Setup

Go to the backend folder:

```bash
cd backend
```

Install dependencies:

```bash
npm install
```

Create a `.env` file:

```env
PORT=5000

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=gold_rush_db
DB_PORT=3306

JWT_SECRET=your_secret_key
```

Start the backend:

```bash
npm run dev
```

Backend should run on:

```text
http://localhost:5000
```

---

# 💻 Frontend Setup

Open another terminal:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The frontend will normally run on:

```text
http://localhost:5173
```

---

# 🤖 AI Service Setup

Go to:

```bash
cd ai-service
```

Create a virtual environment:

```bash
python -m venv venv
```

Activate it on Windows:

```bash
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start FastAPI:

```bash
uvicorn app.main:app --reload --port 8000
```

AI service:

```text
http://localhost:8000
```

---

# 🔑 User Roles

The system supports role-based access control.

| Role           | Main Access                                  |
| -------------- | -------------------------------------------- |
| ADMIN          | Full system access                           |
| BRANCH_MANAGER | Branch-level management                      |
| SALES          | Sales and customer operations                |
| INVENTORY      | Inventory and product operations             |
| ACCOUNTANT     | Payments, installments and financial records |

---

# 🔄 Main Business Workflow

## Gold Purchase

```text
Supplier
   ↓
Purchase
   ↓
Purchase Items
   ↓
Inventory Update
   ↓
Payment
   ↓
Invoice
   ↓
Audit Log
```

## Gold Sale

```text
Customer
   ↓
Product Selection
   ↓
Gold Price
   ↓
Making Charge
   ↓
Tax & Discount
   ↓
Payment / Installment
   ↓
Inventory Update
   ↓
Invoice
   ↓
Customer History
```

## Gold Return

```text
Original Invoice
       ↓
Returned Product
       ↓
Refund Calculation
       ↓
Inventory Update
       ↓
Invoice Update
       ↓
Refund Record
```

## Gold Exchange

```text
Old Gold
   ↓
Old Gold Valuation
   ↓
New Gold Selection
   ↓
Price Difference
   ↓
Payment / Refund
   ↓
Inventory Update
   ↓
Exchange Invoice
```

---

# 🗄️ Main Database Tables

```text
users
roles
branches
employees
customers
suppliers
gold_categories
gold_products
gold_prices
inventory
inventory_transactions
purchases
purchase_items
sales
sale_items
returns
return_items
exchanges
exchange_items
invoices
payments
installment_plans
installment_payments
supplies
notifications
audit_logs
```

---

# 🔐 Security

Gold Rush implements several security practices:

* JWT authentication
* Password hashing using bcrypt
* Role-based authorization
* Protected API routes
* Input validation
* SQL injection protection
* CORS configuration
* Helmet security headers
* Rate limiting
* Environment variables
* Audit logging

Sensitive information such as passwords and database credentials must never be exposed to the frontend or committed to GitHub.

---

# 📊 Dashboard

The dashboard provides real-time business information such as:

* Today's sales
* Monthly revenue
* Total customers
* Total inventory
* Inventory value
* Low-stock products
* Pending installments
* Active branches
* Recent transactions
* Gold price trends
* Branch performance

---

# 🧪 Testing

The system should be tested for:

* Authentication
* Authorization
* Customer management
* Employee management
* Product management
* Inventory
* Gold price
* Supplier management
* Purchase
* Sales
* Payments
* Installments
* Returns
* Exchanges
* Invoice generation
* Reports
* Notifications
* Gold price prediction

Important transaction flows are tested to ensure database consistency.

---

# 📈 Future Improvements

Possible future enhancements include:

* Mobile application
* Advanced demand forecasting
* Real-time market gold price API
* SMS notifications
* Email notifications
* Online payment gateway integration
* Barcode/QR code support
* Advanced business intelligence
* Cloud deployment
* Automated database backup
* Advanced ML models for gold price forecasting

---

# 👨‍💻 Development Team

**Gold Rush — Gold Shop Management System**

Developed as an academic software engineering project.

### Team Members

* Sifat
* Jahid
* Anika

---

# 📜 License

This project is developed for academic and educational purposes.

All rights reserved by the project development team.

---

## ⭐ Gold Rush

**A complete digital management solution for modern gold shops.**

```text
Manage • Track • Analyze • Predict
```
