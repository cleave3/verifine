from fastapi import APIRouter, Depends
from src.utils.common import response
from src.modules.settings.settings_service import SettingsService, get_settings_service
from src.modules.settings.settings_schema import CompanySettingsUpdate, ExchangeRatesUpdate

router = APIRouter(prefix="/settings", tags=["settings"])

@router.get("/")
async def get_settings(service: SettingsService = Depends(get_settings_service)):
    settings = await service.get_settings()
    return response(200, "Settings fetched successfully", settings.model_dump())

@router.patch("/")
async def update_settings(
    settings_in: CompanySettingsUpdate, 
    service: SettingsService = Depends(get_settings_service)
):
    settings = await service.update_settings(settings_in)
    return response(200, "Settings updated successfully", settings.model_dump())

@router.post("/lock")
async def lock_currency(service: SettingsService = Depends(get_settings_service)):
    settings = await service.lock_base_currency()
    return response(200, "Base currency locked successfully", settings.model_dump())

@router.get("/exchange-rates/{base_currency}")
async def get_exchange_rates(
    base_currency: str,
    service: SettingsService = Depends(get_settings_service)
):
    base_currency = base_currency.upper()
    
    # In a production app you might still fetch dynamically if the DB is empty.
    # We will initialize with some standard defaults if nothing is in the DB.
    db_rates = await service.get_exchange_rates()
    
    print("db_rates ===> ", db_rates)
    
    active_rates = {}
    if not db_rates:
        # Provide defaults if not initialized to avoid empty UI
        if base_currency == "NGN":
            active_rates = {
                "USD": 1500.0,
                "EUR": 1650.0,
                "GBP": 1950.0,
                "NGN": 1.0
            }
        else:
            active_rates = {
                "USD": 1.0,
                "EUR": 0.92,
                "GBP": 0.79,
                "NGN": 1550.0
            }
    else:
        for r in db_rates:
            active_rates[r.currency_code] = r.rate
            
    # Include base_currency as 1.0 if not present
    if base_currency not in active_rates:
        active_rates[base_currency] = 1.0
        
    # Always enforce base currency to be 1.0
    active_rates[base_currency] = 1.0

    return response(200, "Exchange rates fetched successfully", {
        "base_currency": base_currency,
        "rates": active_rates
    })

@router.patch("/exchange-rates")
async def update_exchange_rates(
    rates_in: ExchangeRatesUpdate,
    service: SettingsService = Depends(get_settings_service)
):
    rates = await service.update_exchange_rates(rates_in)
    
    active_rates = {r.currency_code: r.rate for r in rates}
    
    return response(200, "Exchange rates updated successfully", {
        "rates": active_rates
    })
