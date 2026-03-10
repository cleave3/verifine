from fastapi import APIRouter
from src.modules.auth.auth_routes import router as auth_router
from src.modules.account.account_routes import router as account_router
from src.modules.fiscal_period.fiscal_period_routes import (
    router as fiscal_period_router,
)
from src.modules.journal_entry.journal_entry_routes import (
    router as journal_entry_router,
)
from src.modules.ap.ap_routes import router as ap_router
from src.modules.ar.ar_routes import router as ar_router
from src.modules.reporting.reporting_routes import router as reporting_router
from src.modules.dashboard.dashboard_routes import router as dashboard_router
from src.modules.settings.settings_routes import router as settings_router
from src.modules.organization.organization_routes import router as organization_router
from src.modules.users.users_routes import router as users_router
from src.modules.audit.audit_routes import router as audit_router
from src.modules.tax.tax_routes import router as tax_router
from src.modules.bank_rec.bank_rec_routes import router as bank_rec_router
from src.modules.tracking.tracking_routes import router as tracking_router
from src.modules.payroll.payroll_routes import router as payroll_router
from src.modules.expense.expense_routes import router as expense_router
from src.modules.fixed_asset.fixed_asset_routes import router as fixed_asset_router
from src.modules.item.item_routes import router as item_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(account_router)
api_router.include_router(fiscal_period_router)
api_router.include_router(journal_entry_router)
api_router.include_router(ap_router)
api_router.include_router(ar_router)
api_router.include_router(reporting_router)
api_router.include_router(dashboard_router)
api_router.include_router(settings_router)
api_router.include_router(organization_router)
api_router.include_router(users_router)
api_router.include_router(audit_router)
api_router.include_router(tax_router)
api_router.include_router(bank_rec_router)
api_router.include_router(tracking_router)
api_router.include_router(payroll_router)
api_router.include_router(expense_router)
api_router.include_router(fixed_asset_router)
api_router.include_router(item_router)
