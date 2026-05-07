# Verifine: Modern ERP & Financial Management System

Verifine is a robust, full-stack ERP (Enterprise Resource Planning) and accounting application designed to streamline financial operations for organizations of all sizes. It combines traditional accounting rigour with modern AI-driven insights to provide a comprehensive financial command center.

---

## 🚀 Quick Start (Technical Users)

### Prerequisites
- **Backend**: Python 3.12+ (managed via `uv`)
- **Frontend**: Node.js & Yarn
- **Database**: PostgreSQL (provided via Docker)

### Local Development Setup

1.  **Clone the Repository**
2.  **Launch Database**:
    ```bash
    docker-compose up -d db
    ```
3.  **Setup Backend**:
    ```bash
    cd backend
    uv sync
    # Create .env from .env.example and add your GEMINI_API_KEY
    uv run alembic upgrade head
    uv run python seed.py  # Populate initial data
    uv run main.py
    ```
4.  **Setup Frontend**:
    ```bash
    cd frontend
    yarn install
    yarn dev
    ```

---

## 🤖 AI Functionality: Meet VeriBot

One of Verifine's standout features is **VeriBot**, an intelligent financial assistant integrated directly into the platform.

### What is VeriBot?
VeriBot is an AI agent powered by **Google Gemini 2.5 Flash** and orchestrated using **LangGraph**. It doesn't just "chat"; it has secure, read-only access to your organization's financial data.

### How to Use VeriBot
You can ask VeriBot questions in plain English, such as:
- *"What is our current cash balance across all bank accounts?"*
- *"How much did we spend on office supplies last month?"*
- *"List the 5 most recent unpaid invoices."*
- *"Show me our top 5 vendors by volume."*
- *"Explain how I should record a new fixed asset."* (VeriBot will pull instructions from the internal knowledge base).

### Core AI Tools
VeriBot is equipped with specialized tools to fetch real-time data:
- **Financial Queries**: Revenue, expenses, accounts receivable (AR), and accounts payable (AP).
- **Audit Oversight**: Fetching recent audit log entries to track system changes.
- **Master Data**: Listing active employees, customers, and vendors.
- **Knowledge Retrieval**: Accessing the built-in user guide to answer "How-to" questions.

---

## 📂 Module-by-Module Walkthrough

Verifine is organized into logical phases to guide you from initial setup to daily operations and month-end reporting.

### Phase 1: Administration & Configuration
*   **Organization**: Define your company profile, base currency (USD, EUR, etc.), and timezone.
*   **Users & Security**: Manage team access with granular roles (Admin, Manager, Employee) and Two-Factor Authentication.
*   **Audit Logs**: A secure, immutable record of every action taken in the system for forensic accountability.

### Phase 2: Financial Foundations
*   **Chart of Accounts (COA)**: The backbone of your accounting. Create "buckets" (Accounts) for Assets, Liabilities, Revenue, and Expenses.
*   **Fiscal Periods**: Define your financial months. Verifine ensures data integrity by preventing entries into closed periods.
*   **Tax Management**: Configure automated tax rates that apply to invoices and bills.
*   **Tracking Categories**: Tag transactions by Department (e.g., Marketing, Sales) or Location (e.g., London, New York) for deeper analysis.

### Phase 3: Core Master Data
*   **Products & Services**: A catalog of everything you buy and sell, with automated mapping to the correct ledger accounts.
*   **Customers (AR) & Vendors (AP)**: Manage contact details, billing addresses, and default payment terms (e.g., Net 30).
*   **Employee Directory**: Maintain workforce records including salaries and tax identifiers for payroll processing.

### Phase 4: Daily Operations (Money Movement)
*   **Invoices (Accounts Receivable)**: Create professional invoices for customers. The system automatically tracks inventory and debt.
*   **Bills (Accounts Payable)**: Log incoming vendor invoices to manage your upcoming cash requirements.
*   **Expense Claims**: Allow employees to submit receipts for reimbursement, with a built-in approval workflow for managers.

### Phase 5: Period-End & Advanced Accounting
*   **Payroll Processing**: Calculate Gross/Net pay, generate payslips, and automatically post wage expenses to the ledger.
*   **Bank Reconciliation**: Upload bank statements to match real-world transactions with your software records, ensuring your balance is 100% accurate.
*   **Fixed Assets & Depreciation**: Register long-term assets (vehicles, equipment) and run monthly depreciation at the click of a button.
*   **Journal Entries**: Manual overrides for accountants to make specific adjustments to the ledger.

---

## 🛠 Technical Architecture

### Backend (Python/FastAPI)
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) for high-performance async API endpoints.
- **ORM/Models**: [SQLModel](https://sqlmodel.tiangolo.com/) (SQLAlchemy + Pydantic) for unified data modeling.
- **Migrations**: [Alembic](https://alembic.sqlalchemy.org/) for robust database schema versioning.
- **AI Stack**: [LangChain](https://www.langchain.com/) and [LangGraph](https://github.com/langchain-ai/langgraph) for agentic workflows.

### Frontend (React/TypeScript)
- **Framework**: React with TypeScript for a type-safe, component-based UI.
- **Build Tool**: [Vite](https://vitejs.dev/) for lightning-fast development and optimized production builds.
- **Styling**: Tailwind CSS for a modern, responsive design.

---

## 🔒 Security & Compliance
Verifine is built with security as a priority:
- **Row-Level Security (Conceptual)**: All AI and API queries are strictly scoped to the `org_id` of the logged-in user.
- **Audit Trails**: Every sensitive change is logged with "Who, What, When" metadata.
- **Financial Integrity**: Double-entry bookkeeping principles are enforced at the ledger level.