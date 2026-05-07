from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from uuid import UUID
from datetime import date, datetime
from typing import List, Optional
from fastapi import HTTPException

from src.models.journal_entry import JournalEntryStatus
from src.models.payroll import PayrollRun, PaySlip, Employee, RunStatus
from src.models.settings import PayrollSettings
from src.modules.payroll.payroll_schema import PayrollSettingsUpdate
from src.modules.journal_entry.journal_entry_service import JournalEntryService
from src.modules.journal_entry.journal_entry_schema import (
    JournalEntryCreate,
    LedgerLineCreate,
)
import jinja2
import weasyprint
import os
from src.models.organization import Organization
from src.models.tracking import TrackingOption


class PayrollService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def initiate_payroll_run(
        self, org_id: UUID, period_id: int, pay_date: date
    ) -> PayrollRun:
        # Get all active employees
        employees_result = await self.session.exec(
            select(Employee).where(
                Employee.organization_id == org_id, Employee.is_active == True
            )
        )
        employees = employees_result.all()

        if not employees:
            raise HTTPException(
                status_code=400, detail="No active employees to run payroll for."
            )

        # Check if a draft run exists
        existing_draft = await self.session.exec(
            select(PayrollRun).where(
                PayrollRun.organization_id == org_id,
                PayrollRun.period_id == period_id,
                PayrollRun.status == RunStatus.DRAFT,
            )
        )
        if existing_draft.first():
            raise HTTPException(
                status_code=400,
                detail="A draft payroll run already exists for this period.",
            )

        new_run = PayrollRun(
            organization_id=org_id,
            period_id=period_id,
            pay_date=pay_date,
            status=RunStatus.DRAFT,
        )
        self.session.add(new_run)
        await self.session.flush()

        total_gross = 0.0
        total_tax = 0.0
        total_benefits = 0.0
        total_net = 0.0

        # Fetch settings
        settings_result = await self.session.exec(
            select(PayrollSettings).where(PayrollSettings.org_id == org_id)
        )
        settings = settings_result.first()

        tax_rate = (settings.tax_percentage / 100.0) if settings else 0.15
        benefits_rate = (settings.benefits_percentage / 100.0) if settings else 0.05

        for emp in employees:
            # Simplistic calculation for now:
            # Base salary is assumed monthly here.
            gross = emp.base_salary
            tax_deduction = gross * tax_rate
            benefits = gross * benefits_rate
            net = gross - tax_deduction - benefits

            slip = PaySlip(
                organization_id=org_id,
                payroll_run_id=new_run.id,
                employee_id=emp.id,
                gross_pay=gross,
                tax_deduction=tax_deduction,
                benefits_deduction=benefits,
                net_pay=net,
            )
            self.session.add(slip)

            total_gross += gross
            total_tax += tax_deduction
            total_benefits += benefits
            total_net += net

        new_run.total_gross_pay = total_gross
        new_run.total_taxes = total_tax
        new_run.total_deductions = total_tax + total_benefits
        new_run.total_net_pay = total_net

        await self.session.commit()
        await self.session.refresh(new_run)

        return new_run

    async def get_payroll_runs(self, org_id: UUID) -> List[PayrollRun]:
        result = await self.session.exec(
            select(PayrollRun)
            .where(PayrollRun.organization_id == org_id)
            .order_by(PayrollRun.pay_date.desc())
        )
        return list(result.all())

    async def get_payroll_payslips(self, org_id: UUID, run_id: int) -> List[PaySlip]:
        result = await self.session.exec(
            select(PaySlip).where(
                PaySlip.organization_id == org_id, PaySlip.payroll_run_id == run_id
            )
        )
        return list(result.all())

    async def get_payroll_settings(self, org_id: UUID) -> PayrollSettings:
        result = await self.session.exec(
            select(PayrollSettings).where(PayrollSettings.org_id == org_id)
        )
        settings = result.first()
        if not settings:
            settings = PayrollSettings(org_id=org_id)
            self.session.add(settings)
            await self.session.commit()
            await self.session.refresh(settings)
        return settings

    async def update_payroll_settings(
        self, org_id: UUID, target: PayrollSettingsUpdate
    ) -> PayrollSettings:
        settings = await self.get_payroll_settings(org_id)
        update_data = target.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(settings, key, value)

        self.session.add(settings)
        await self.session.commit()
        await self.session.refresh(settings)
        return settings

    async def confirm_payroll_run(
        self,
        org_id: UUID,
        run_id: int,
        user_id: int,
        wages_expense_account_id: int,
        payroll_liabilities_account_id: int,
        cash_account_id: int,
    ) -> PayrollRun:
        """
        Confirms a draft payroll run and posts the corresponding journal entry.
        """
        run = await self.session.get(PayrollRun, run_id)
        if not run or run.organization_id != org_id:
            raise HTTPException(status_code=404, detail="Payroll run not found")

        if run.status != RunStatus.DRAFT:
            raise HTTPException(
                status_code=400, detail="Only DRAFT payroll runs can be confirmed."
            )

        # Get all slips to post dimensionally if needed (grouping by department)
        slips_res = await self.session.exec(
            select(PaySlip, Employee)
            .join(Employee)
            .where(PaySlip.payroll_run_id == run_id)
        )
        slips_and_emps = slips_res.all()

        lines = []

        # Debit Wages Expense (grouped by department option)
        dept_totals = {}
        for slip, emp in slips_and_emps:
            dept_id = emp.department_option_id
            if dept_id not in dept_totals:
                dept_totals[dept_id] = 0.0
            dept_totals[dept_id] += slip.gross_pay

        for dept_id, amount in dept_totals.items():
            if amount > 0:
                lines.append(
                    LedgerLineCreate(
                        account_id=wages_expense_account_id,
                        description="Payroll Gross Wages",
                        transaction_debit=amount,
                        transaction_credit=0.0,
                        tracking_option_id=dept_id,
                    )
                )

        # Credit Liabilities (Taxes + Benefits)
        if run.total_deductions > 0:
            lines.append(
                LedgerLineCreate(
                    account_id=payroll_liabilities_account_id,
                    description="Payroll Tax & Benefits Liabilities",
                    transaction_debit=0.0,
                    transaction_credit=run.total_deductions,
                    tracking_option_id=None,
                )
            )

        # Credit Cash (Net Pay)
        if run.total_net_pay > 0:
            lines.append(
                LedgerLineCreate(
                    account_id=cash_account_id,
                    description="Payroll Net Pay",
                    transaction_debit=0.0,
                    transaction_credit=run.total_net_pay,
                    tracking_option_id=None,
                )
            )

        # Post the journal
        je_create = JournalEntryCreate(
            description=f"Payroll Run - {run.pay_date.isoformat()}",
            entry_date=run.pay_date,
            period_id=run.period_id,
            lines=lines,
        )

        journal_service = JournalEntryService(self.session)
        journal_entry = await journal_service.create_journal_entry(
            org_id=org_id,
            je_in=je_create,
            user_id=user_id,
            status=JournalEntryStatus.POSTED,
        )

        run.journal_entry_id = journal_entry.id
        run.status = RunStatus.CONFIRMED

        await self.session.commit()
        await self.session.refresh(run)

        return run

    async def generate_payslip_pdf(self, org_id: UUID, payslip_id: int) -> bytes:
        """
        Generates a PDF for a specific payslip.
        """
        # Fetch payslip with related data
        stmt = (
            select(PaySlip, Employee, PayrollRun, Organization)
            .join(Employee, Employee.id == PaySlip.employee_id)
            .join(PayrollRun, PayrollRun.id == PaySlip.payroll_run_id)
            .join(Organization, Organization.id == PaySlip.organization_id)
            .where(PaySlip.id == payslip_id, PaySlip.organization_id == org_id)
        )
        result = await self.session.exec(stmt)
        data = result.first()

        if not data:
            raise HTTPException(status_code=404, detail="Payslip not found")

        payslip, employee, payroll_run, organization = data

        # Fetch department name if applicable
        department_name = None
        if employee.department_option_id:
            dept = await self.session.get(TrackingOption, employee.department_option_id)
            if dept:
                department_name = dept.name

        # Prepare template data
        context = {
            "organization": organization,
            "employee": employee,
            "payroll_run": payroll_run,
            "payslip": payslip,
            "department_name": department_name,
            "total_earnings": payslip.gross_pay,
            "total_deductions": payslip.tax_deduction + payslip.benefits_deduction,
            "current_year": datetime.now().year,
        }

        # Render template
        template_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "templates"
        )
        env = jinja2.Environment(loader=jinja2.FileSystemLoader(template_dir))
        template = env.get_template("payslip.html")
        html_content = template.render(context)

        # Generate PDF
        pdf_bytes = weasyprint.HTML(string=html_content).write_pdf()

        return pdf_bytes


from fastapi import Depends
from src.core.database import get_session


def get_payroll_service(session: AsyncSession = Depends(get_session)) -> PayrollService:
    return PayrollService(session)
