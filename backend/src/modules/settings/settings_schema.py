from pydantic import BaseModel

class CompanySettingsRead(BaseModel):
    id: int
    base_currency_code: str
    is_base_currency_locked: bool

class CompanySettingsUpdate(BaseModel):
    base_currency_code: str

class ExchangeRateRead(BaseModel):
    currency_code: str
    rate: float

class ExchangeRatesUpdate(BaseModel):
    rates: dict[str, float]
