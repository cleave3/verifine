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

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(account_router)
api_router.include_router(fiscal_period_router)
api_router.include_router(journal_entry_router)
api_router.include_router(ap_router)
api_router.include_router(ar_router)
api_router.include_router(reporting_router)
api_router.include_router(dashboard_router)
