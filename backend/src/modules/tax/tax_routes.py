from typing import List
from fastapi import APIRouter, Depends, HTTPException
from src.core.security_roles import get_current_user, role_required
from src.modules.tax.tax_schema import TaxRateCreate, TaxRateRead, TaxRateUpdate
from src.modules.tax.tax_service import TaxService, get_tax_service
from src.models.user import User, UserRole

from src.utils.common import response

router = APIRouter(prefix="/taxes", tags=["Taxes"])


@router.get("")
async def get_tax_rates(
    current_user: User = Depends(get_current_user),
    service: TaxService = Depends(get_tax_service),
):
    data = await service.get_tax_rates(current_user.org_id)
    return response(200, "Tax rates retrieved successfully", data)


@router.post("")
async def create_tax_rate(
    tax_in: TaxRateCreate,
    current_user: User = Depends(role_required([UserRole.ADMIN, UserRole.CONTROLLER])),
    service: TaxService = Depends(get_tax_service),
):
    result = await service.create_tax_rate(current_user.org_id, tax_in, current_user.id)
    return response(201, "Tax rate created successfully", result)


@router.put("/{tax_id}")
async def update_tax_rate(
    tax_id: int,
    tax_in: TaxRateUpdate,
    current_user: User = Depends(role_required([UserRole.ADMIN, UserRole.CONTROLLER])),
    service: TaxService = Depends(get_tax_service),
):
    tax = await service.update_tax_rate(
        current_user.org_id, tax_id, tax_in, current_user.id
    )
    if not tax:
        raise HTTPException(status_code=404, detail="Tax rate not found")
    return response(200, "Tax rate updated successfully", tax)
