# Verifine: Complete Plain-English Walkthrough & How-To Guide

Here is a plain-English, module-by-module walkthrough of exactly how the Verifine application works, how to set things up, and how you would use it on a daily basis. You can use these instructions to answer questions about how to use the app effectively.

While this is written without needing a technical background, we use the correct financial terminology (the "key technical terms") so you understand *why* the system asks for certain things.

---

## Phase 1: Administration & Configuration (The Initial Setup)
Before you can record a single sale or pay an employee, you have to build the foundation. Think of this as setting up the filing cabinets before paperwork starts flying around.

**1. Organization (`organization`)**
* **What it is:** Your core company profile.
* **How-To:** Navigate to the Organization settings to define your company name, contact information, base currency (e.g., USD, EUR), and timezone.

**2. Authentication & Users (`auth` & `users`)**
* **What it is:** Controlling who has access to your financial data. 
* **How-To:** Admins can invite new team members via the Users module, assign them specific roles (like "Admin", "Manager", or "Employee"), and manage passwords or two-factor authentication for security.

**3. Settings (`settings`)**
* **What it is:** Global preferences for how the app behaves.
* **How-To:** Access the Settings area to configure app-wide defaults, notifications, and integration preferences.

**4. Audit Log (`audit`)**
* **What it is:** A secure, uneditable history of every action taken in the system.
* **How-To:** Go to the Audit Log to review exactly "who did what and when." This is crucial for fixing mistakes and tracking down unauthorized changes.

---

## Phase 2: Financial Foundations
Setting up the accounting rules.

**5. Chart of Accounts (`account`)**
* **What it is:** The backbone of the entire system. An "Account" isn't a bank account; it's a tracking bucket. You create buckets for things you own (Assets), things you owe (Liabilities), money coming in (Revenue/Income), and money going out (Expenses). 
* **How-To:** Go to Chart of Accounts. Add an account, give it a unique code, a name (e.g., "Sales Revenue", "Office Supplies"), and select the correct account type.

**6. Fiscal Periods (`fiscal_period`)**
* **What it is:** The financial "timeframes" your business operates in (usually months, like "January 2026"). You can't record a transaction unless an "Open" fiscal period exists for that date.
* **How-To:** Go to Fiscal Periods and generate them for the year. At the end of every month, an accountant will "Close" the period so past numbers can't be accidentally changed.

**7. Taxes (`tax`)**
* **What it is:** Taxes are percentages automatically added to bills/invoices. 
* **How-To:** In the Tax module, create tax rates (e.g., "State Sales Tax 7%") that you can apply to line items when billing customers or paying vendors.

**8. Tracking Categories (`tracking`)**
* **What it is:** Custom tags used to see exactly *where* money is being spent.
* **How-To:** Create Tracking Categories like "Departments" with options like "Marketing" or "Sales", or "Offices" with options like "New York" vs "London". Assign these tags to expenses or payroll.

---

## Phase 3: Core Masters (Building Your Roster)
Populating the system with the people and things you interact with.

**9. Products and Services (`item`)**
* **What it is:** The catalog of what you buy and sell.
* **How-To:** Go to Items. For **Inventory Items** (physical goods), the system tracks quantity on hand. For **Services**, it doesn't track quantity. Map each item to the correct Chart of Account (e.g., selling "Consulting" maps to the "Service Revenue" bucket). When staff make a sale, they just pick the item name.

**10. Customers (`ar`) & Vendors (`ap`)**
* **What it is:** Your rolodex. **Customers** give you money; **Vendors** (suppliers) take your money.
* **How-To:** Add their profiles with contact details, billing addresses, and standard payment terms (e.g., "Net 30", meaning they have 30 days to pay).

**11. Employees (`payroll`)**
* **What it is:** Your workforce.
* **How-To:** Navigate to Employees. Add their details, base salary, tax file numbers, and optionally assign them to a Tracking Category (like "Engineering").

---

## Phase 4: Daily Operations (Money Moving)
How to use the modules in day-to-day business.

**12. Invoices / Accounts Receivable (`ar`)**
* **What it is:** Billing your customers. Money owed to you is called *Accounts Receivable* (AR).
* **How do I make an invoice?** Go to Invoices. Click "New Invoice", select a Customer from the dropdown, and add the "Items" they are buying. 
* **The Behind-the-Scenes:** The system reduces inventory (if physical) and tells the ledger you are owed money. When the customer actually pays, record a "Payment" against the invoice to move the money into your Bank Account bucket.

**13. Bills / Accounts Payable (`ap`)**
* **What it is:** Paying your suppliers. Money you owe to others is called *Accounts Payable* (AP).
* **How do I log a bill?** You receive an invoice from a vendor (e.g., electric company). Go to Bills, enter the vendor, date, and amounts. 
* **The Behind-the-Scenes:** When you pay the bill later, record the payment. The system deducts the money from your Bank Account bucket and wipes the debt from Accounts Payable.

**14. Expense Claims (`expense`)**
* **What it is:** When an employee buys something with their own money on behalf of the company and needs reimbursement.
* **How-To:** An employee logs in and submits an Expense Claim detailing the date, amount, and receipt. A manager reviews and clicks "Approve." Once the employee is handed the cash, the claim is marked as "Paid".

---

## Phase 5: Period-End Operations (Fact-Checking & Complex Accounting)
Tools used periodically (usually end of the month) to ensure everything is perfect.

**15. Payroll Runs (`payroll`)**
* **What it is:** The process of officially calculating and recording employee compensation.
* **How do I pay employees?** At the end of a pay period, initiate a "Payroll Run". The system calculates Gross Pay, subtracts taxes, and determines Net Pay. Click "Confirm" to generate Payslips and automatically post the massive accounting entry for wage expenses.

**16. Fixed Assets (`fixed_asset`)**
* **What it is:** Expensive things that last a long time (vehicles, servers). You spread their cost out over their "Useful Life" (Depreciation).
* **How-To:** Register a new Fixed Asset with its purchase price and lifespan. Every month, click **"Run Depreciation"**. The system automatically deducts value from the asset and records a Depreciation Expense.

**17. Bank Reconciliation (`bank_rec`)**
* **What it is:** Making sure your software matches real life.
* **How do I reconcile?** Upload a digital statement from your real-life bank. The system lines up real bank transactions on the left and software transactions (Invoices paid, Payroll) on the right. Click "Reconcile" on matching pairs so your software's bank balance equals your real bank balance.

**18. Journal Entries (`journal_entry`)**
* **What it is:** The manual override. Most transactions create automated entries.
* **How do I make a journal entry?** An accountant goes to Journal Entries to create a manual adjustment. You must select the accounts, enter the Debit and Credit amounts (which must exactly equal each other), and save the entry to manually move money between Chart of Account buckets.

---

## Phase 6: Analytics & Oversight (The Output)
The ultimate reason you do all of this work.

**19. Dashboard (`dashboard`)**
* **What it is:** The command center for your day.
* **How-To:** Log in to instantly see high-level metrics: who owes you money (unpaid invoices), who you need to pay (unpaid bills), and your current cash balance.

**20. Reporting (`reporting`)**
* **What it is:** Exporting your financial health.
* **How-To:** Go to Reports to generate the **Profit & Loss (Income Statement)** (how much money you made vs. spent), the **Balance Sheet** (a snapshot of company health: Assets - Liabilities = Equity), or the **Trial Balance** (a raw list of all account balances).
