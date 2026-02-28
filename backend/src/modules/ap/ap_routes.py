from fastapi import APIRouter, Depends, Request
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.database import get_session
from src.core.errors import BadRequest
from src.utils.common import response
from src.modules.ap.ap_schema import VendorCreate, VendorUpdate, BillCreate, BillUpdate
from src.modules.ap.ap_service import (
    VendorService,
    BillService,
    get_vendor_service,
    get_bill_service,
)

router = APIRouter(prefix="/ap", tags=["ap"])


# --- VENDORS ---
@router.get("/vendors")
async def list_vendors(vendor_service: VendorService = Depends(get_vendor_service)):
    vendors = await vendor_service.get_vendors()
    return response(
        200, "Vendors retrieved successfully", [v.model_dump() for v in vendors]
    )


@router.post("/vendors")
async def create_vendor(
    vendor_in: VendorCreate, vendor_service: VendorService = Depends(get_vendor_service)
):
    vendor = await vendor_service.create_vendor(vendor_in)
    return response(201, "Vendor created successfully", vendor.model_dump())


@router.patch("/vendors/{id}")
async def update_vendor(
    id: int,
    vendor_in: VendorUpdate,
    vendor_service: VendorService = Depends(get_vendor_service),
):
    updated = await vendor_service.update_vendor(id, vendor_in)
    if not updated:
        raise BadRequest("Vendor not found")
    return response(200, "Vendor updated successfully", updated.model_dump())


# --- BILLS ---
from datetime import date
from typing import Optional
from src.models.bill import BillStatus


@router.get("/bills")
async def list_bills(
    page: int = 1,
    page_size: int = 10,
    status: Optional[BillStatus] = None,
    vendor_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    bill_service: BillService = Depends(get_bill_service),
):
    bills = await bill_service.get_bills(
        page=page,
        page_size=page_size,
        status=status,
        vendor_id=vendor_id,
        start_date=start_date,
        end_date=end_date,
    )

    data = []
    for bill in bills["results"]:
        bill_dict = bill.model_dump()
        bill_dict["lines"] = [line.model_dump() for line in bill.lines]
        data.append(bill_dict)

    return response(
        200,
        "Bills retrieved successfully",
        {"results": data, "page_info": bills["meta"]},
    )


@router.post("/bills")
async def create_bill(
    bill_in: BillCreate, bill_service: BillService = Depends(get_bill_service)
):
    bill = await bill_service.create_bill(bill_in)

    bill_dict = bill.model_dump()
    bill_dict["lines"] = [line.model_dump() for line in bill.lines]

    return response(201, "Bill created successfully", bill_dict)


@router.patch("/bills/{id}/approve")
async def approve_bill(id: int, bill_service: BillService = Depends(get_bill_service)):
    bill = await bill_service.approve_bill(id)
    if not bill:
        raise BadRequest("Bill not found")

    bill_dict = bill.model_dump()
    bill_dict["lines"] = [line.model_dump() for line in bill.lines]

    return response(200, "Bill approved successfully", bill_dict)


@router.patch("/bills/{id}/post")
async def post_bill(
    id: int, request: Request, bill_service: BillService = Depends(get_bill_service)
):
    from src.modules.journal_entry.journal_entry_routes import get_current_user_id

    user_id = await get_current_user_id(request)

    bill = await bill_service.post_bill(id, user_id)
    if not bill:
        raise BadRequest("Bill not found")

    bill_dict = bill.model_dump()
    bill_dict["lines"] = [line.model_dump() for line in bill.lines]

    return response(
        200, "Bill posted successfully and Journal Entry created", bill_dict
    )


@router.patch("/bills/{id}/pay")
async def mark_bill_paid(
    id: int, bill_service: BillService = Depends(get_bill_service)
):
    bill = await bill_service.mark_paid(id)
    if not bill:
        raise BadRequest("Bill not found")

    bill_dict = bill.model_dump()
    bill_dict["lines"] = [line.model_dump() for line in bill.lines]

    return response(200, "Bill marked as paid successfully", bill_dict)
