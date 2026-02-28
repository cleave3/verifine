from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from fastapi import Depends
from src.core.database import get_session
from src.models.settings import CompanySettings, ExchangeRate
from src.modules.settings.settings_schema import CompanySettingsUpdate, ExchangeRatesUpdate
from src.core.errors import BadRequest

class SettingsService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_settings(self) -> CompanySettings:
        stmt = select(CompanySettings).limit(1)
        settings = (await self.session.exec(stmt)).first()
        if not settings:
            settings = CompanySettings(base_currency_code="NGN", is_base_currency_locked=False)
            self.session.add(settings)
            await self.session.commit()
            await self.session.refresh(settings)
        return settings

    async def update_settings(self, settings_in: CompanySettingsUpdate) -> CompanySettings:
        settings = await self.get_settings()
        if settings.is_base_currency_locked:
            raise BadRequest("Base currency is locked and cannot be changed.")
        
        settings.base_currency_code = settings_in.base_currency_code
        self.session.add(settings)
        await self.session.commit()
        await self.session.refresh(settings)
        return settings

    async def lock_base_currency(self) -> CompanySettings:
        settings = await self.get_settings()
        settings.is_base_currency_locked = True
        self.session.add(settings)
        await self.session.commit()
        await self.session.refresh(settings)
        return settings
        
    async def get_exchange_rates(self) -> list[ExchangeRate]:
        stmt = select(ExchangeRate).order_by(ExchangeRate.currency_code)
        rates = (await self.session.exec(stmt)).all()
        return rates
        
    async def update_exchange_rates(self, rates_in: ExchangeRatesUpdate) -> list[ExchangeRate]:
        stmt = select(ExchangeRate)
        existing_rates = (await self.session.exec(stmt)).all()
        existing_dict = {r.currency_code: r for r in existing_rates}
        
        for code, rate_val in rates_in.rates.items():
            if code in existing_dict:
                existing_dict[code].rate = rate_val
                self.session.add(existing_dict[code])
            else:
                new_rate = ExchangeRate(currency_code=code, rate=rate_val)
                self.session.add(new_rate)
                
        await self.session.commit()
        
        stmt = select(ExchangeRate)
        return (await self.session.exec(stmt)).all()

def get_settings_service(session: AsyncSession = Depends(get_session)) -> SettingsService:
    return SettingsService(session)
