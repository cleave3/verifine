from pydantic import BaseModel
from typing import Optional


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    base_currency_code: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None
    tax_regime: Optional[str] = None
    annual_turnover: Optional[float] = None
    fixed_asset_value: Optional[float] = None
    cac_registration_number: Optional[str] = None
    is_vat_registered: Optional[bool] = None
