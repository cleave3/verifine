import uuid
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from langchain_core.tools import tool
from typing import Annotated

# We will export a generic way to run SQL but strictly restricted by org_id.
# To do this safely and simply for an MVP, we can expose tools that run
# predefined or specific schema-aware queries, or create a constrained engine.


def get_financial_tools(db: AsyncSession, org_id: uuid.UUID):

    from datetime import datetime

    def parse_date(date_str: str):
        if not date_str:
            return None
        try:
            return datetime.strptime(date_str, "%Y-%m-%d").date()
        except:
            return None

    @tool
    async def query_total_expenses(
        start_date: Annotated[str, "Start date in YYYY-MM-DD format, or None"],
        end_date: Annotated[str, "End date in YYYY-MM-DD format, or None"],
    ) -> str:
        """Query total expenses (bills) for the organization within an optional date range."""
        query = f"SELECT SUM(total_amount) FROM bill WHERE org_id = '{org_id}'"
        params = {}

        parsed_start = parse_date(start_date)
        parsed_end = parse_date(end_date)

        if parsed_start and parsed_end:
            query += " AND bill_date >= :start_date AND bill_date <= :end_date"
            params = {"start_date": parsed_start, "end_date": parsed_end}

        result = await db.execute(text(query), params)
        total = result.scalar()
        return f"Total expenses: {total or 0.0}"

    @tool
    async def query_total_revenue(
        start_date: Annotated[str, "Start date in YYYY-MM-DD format, or None"],
        end_date: Annotated[str, "End date in YYYY-MM-DD format, or None"],
    ) -> str:
        """Query total revenue (invoices) for the organization within an optional date range."""
        query = f"SELECT SUM(total_amount) FROM invoice WHERE org_id = '{org_id}'"
        params = {}

        parsed_start = parse_date(start_date)
        parsed_end = parse_date(end_date)

        if parsed_start and parsed_end:
            query += " AND invoice_date >= :start_date AND invoice_date <= :end_date"
            params = {"start_date": parsed_start, "end_date": parsed_end}

        result = await db.execute(text(query), params)
        total = result.scalar()
        return f"Total revenue: {total or 0.0}"

    @tool
    async def query_cash_balance() -> str:
        """Query the current available cash and bank balance."""
        query = f"""
            SELECT COALESCE(SUM(l.base_debit - l.base_credit), 0)
            FROM ledgerline l
            JOIN account a ON l.account_id = a.id
            WHERE a.org_id = '{org_id}'
              AND a.type = 'ASSET'
              AND (a.name ILIKE '%cash%' OR a.name ILIKE '%bank%')
        """
        result = await db.execute(text(query))
        total = result.scalar()
        return f"Current cash balance: {total or 0.0}"

    @tool
    async def query_vendors() -> str:
        """List the top 5 vendors the organization works with."""
        query = f"SELECT name FROM vendor WHERE org_id = '{org_id}' AND is_active = true LIMIT 5"
        result = await db.execute(text(query))
        names = [row[0] for row in result.fetchall()]
        return f"Top vendors: {', '.join(names)}" if names else "No vendors found."

    @tool
    async def query_customers() -> str:
        """List the 10 most recent active customers."""
        query = f"SELECT name, email FROM customer WHERE org_id = '{org_id}' AND status = 'ACTIVE' LIMIT 10"
        result = await db.execute(text(query))
        names = [f"{row[0]} ({row[1] or 'No email'})" for row in result.fetchall()]
        return (
            f"Top active customers: {', '.join(names)}"
            if names
            else "No active customers found."
        )

    @tool
    async def query_accounts() -> str:
        """List up to 20 active accounts in the chart of accounts."""
        query = f"SELECT code, name, type FROM account WHERE org_id = '{org_id}' AND is_active = true LIMIT 20"
        result = await db.execute(text(query))
        rows = [f"[{row[0]}] {row[1]} ({row[2]})" for row in result.fetchall()]
        return (
            f"Active accounts: {', '.join(rows)}"
            if rows
            else "No active accounts found."
        )

    @tool
    async def query_accounts_receivable() -> str:
        """Query the total accounts receivable (unpaid sent/posted invoices)."""
        query = f"SELECT SUM(total_amount) FROM invoice WHERE org_id = '{org_id}' AND status IN ('SENT', 'POSTED')"
        result = await db.execute(text(query))
        total = result.scalar()
        return f"Total Accounts Receivable: {total or 0.0}"

    @tool
    async def query_accounts_payable() -> str:
        """Query the total accounts payable (unpaid approved/posted bills)."""
        query = f"SELECT SUM(total_amount) FROM bill WHERE org_id = '{org_id}' AND status IN ('APPROVED', 'POSTED')"
        result = await db.execute(text(query))
        total = result.scalar()
        return f"Total Accounts Payable: {total or 0.0}"

    @tool
    async def query_invoices() -> str:
        """List the 5 most recent invoices."""
        query = f"SELECT invoice_number, total_amount, status, due_date FROM invoice WHERE org_id = '{org_id}' ORDER BY invoice_date DESC LIMIT 5"
        result = await db.execute(text(query))
        rows = [
            f"{row[0]}: {row[1]} (Status: {row[2]}, Due: {row[3]})"
            for row in result.fetchall()
        ]
        return (
            "Recent invoices:\n- " + "\n- ".join(rows)
            if rows
            else "No recent invoices found."
        )

    @tool
    async def query_bills() -> str:
        """List the 5 most recent bills."""
        query = f"SELECT bill_number, total_amount, status, due_date FROM bill WHERE org_id = '{org_id}' ORDER BY bill_date DESC LIMIT 5"
        result = await db.execute(text(query))
        rows = [
            f"{row[0]}: {row[1]} (Status: {row[2]}, Due: {row[3]})"
            for row in result.fetchall()
        ]
        return (
            "Recent bills:\n- " + "\n- ".join(rows)
            if rows
            else "No recent bills found."
        )

    @tool
    async def query_audit_log() -> str:
        """Show the 5 most recent audit log activity entries."""
        query = f"SELECT action, entity_type, timestamp FROM auditlog WHERE org_id = '{org_id}' ORDER BY timestamp DESC LIMIT 5"
        result = await db.execute(text(query))
        rows = [f"{row[2]} - {row[0]} on {row[1]}" for row in result.fetchall()]
        return (
            "Recent audit log activity:\n- " + "\n- ".join(rows)
            if rows
            else "No recent audit logs found."
        )

    @tool
    async def query_journal_entry() -> str:
        """Show the 5 most recent journal entries."""
        query = f"SELECT transaction_id, description, entry_date, status FROM journalentry WHERE org_id = '{org_id}' ORDER BY entry_date DESC LIMIT 5"
        result = await db.execute(text(query))
        rows = [
            f"{row[0]} ({row[2]}): {row[1]} - Status: {row[3]}"
            for row in result.fetchall()
        ]
        return (
            "Recent journal entries:\n- " + "\n- ".join(rows)
            if rows
            else "No recent journal entries found."
        )

    @tool
    async def query_employees() -> str:
        """Show up to 10 active employees."""
        query = f"SELECT first_name, last_name, email FROM employee WHERE organization_id = '{org_id}' AND is_active = true LIMIT 10"
        result = await db.execute(text(query))
        rows = [f"{row[0]} {row[1]} ({row[2]})" for row in result.fetchall()]
        return (
            f"Active employees: {', '.join(rows)}"
            if rows
            else "No active employees found."
        )

    @tool
    async def query_payroll() -> str:
        """Show the recent 5 payroll runs."""
        query = f"SELECT pay_date, status, total_gross_pay, total_net_pay FROM payrollrun WHERE organization_id = '{org_id}' ORDER BY pay_date DESC LIMIT 5"
        result = await db.execute(text(query))
        rows = [
            f"Date: {row[0]}, Status: {row[1]}, Gross: {row[2]}, Net: {row[3]}"
            for row in result.fetchall()
        ]
        return (
            "Recent payroll runs:\n- " + "\n- ".join(rows)
            if rows
            else "No recent payroll runs found."
        )

    @tool
    async def query_organisation() -> str:
        """Fetch current organization details."""
        query = (
            f"SELECT name, base_currency_code FROM organization WHERE id = '{org_id}'"
        )
        result = await db.execute(text(query))
        row = result.fetchone()
        return (
            f"Organization Name: {row[0]}, Base Currency: {row[1]}"
            if row
            else "Organization not found."
        )

    @tool
    def get_system_knowledge_base() -> str:
        """
        Use this tool to answer questions relating to app usage, how-to inquiries, or everyday activities.
        Examples:
        - "How can I use the app effectively for my everyday job as an accountant?"
        - "How do I make a journal entry?"
        - "What is the process for paying employees?"
        It retrieves the plain-English instructions and knowledge base for using the Verifine application.
        """
        knowledge_base_path = Path(__file__).parent / "verifine.md"

        try:
            if knowledge_base_path.exists():
                with open(knowledge_base_path, "r", encoding="utf-8") as f:
                    return "".join([line for line in f.readlines()])
        except Exception as e:
            print(f"Error loading knowledge base: {e}")

        return ""

    return [
        query_total_expenses,
        query_total_revenue,
        query_cash_balance,
        query_vendors,
        query_customers,
        query_accounts,
        query_accounts_receivable,
        query_accounts_payable,
        query_invoices,
        query_bills,
        query_audit_log,
        query_journal_entry,
        query_employees,
        query_payroll,
        query_organisation,
        get_system_knowledge_base,
    ]
