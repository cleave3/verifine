from fastapi import APIRouter, Depends, Request
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.database import get_session
from src.core.errors import BadRequest
from src.utils.common import response
from src.modules.ar.ar_schema import CustomerCreate, CustomerUpdate, InvoiceCreate
from src.modules.ar.ar_service import (
    CustomerService,
    InvoiceService,
    get_customer_service,
    get_invoice_service,
)

router = APIRouter(prefix="/ar", tags=["ar"])


# --- CUSTOMERS ---
@router.get("/customers")
async def list_customers(
    customer_service: CustomerService = Depends(get_customer_service),
):
    customers = await customer_service.get_customers()
    return response(
        200, "Customers retrieved successfully", [c.model_dump() for c in customers]
    )


@router.post("/customers")
async def create_customer(
    customer_in: CustomerCreate,
    customer_service: CustomerService = Depends(get_customer_service),
):
    customer = await customer_service.create_customer(customer_in)
    return response(201, "Customer created successfully", customer.model_dump())


@router.patch("/customers/{id}")
async def update_customer(
    id: int,
    customer_in: CustomerUpdate,
    customer_service: CustomerService = Depends(get_customer_service),
):
    updated = await customer_service.update_customer(id, customer_in)
    if not updated:
        raise BadRequest("Customer not found")
    return response(200, "Customer updated successfully", updated.model_dump())


# --- INVOICES ---
from datetime import date
from typing import Optional
from src.models.invoice import InvoiceStatus


@router.get("/invoices")
async def list_invoices(
    page: int = 1,
    page_size: int = 10,
    status: Optional[InvoiceStatus] = None,
    customer_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    invoice_service: InvoiceService = Depends(get_invoice_service),
):
    invoices = await invoice_service.get_invoices(
        page=page,
        page_size=page_size,
        status=status,
        customer_id=customer_id,
        start_date=start_date,
        end_date=end_date,
    )

    data = []
    for invoice in invoices["results"]:
        inv_dict = invoice.model_dump()
        inv_dict["lines"] = [line.model_dump() for line in invoice.lines]
        data.append(inv_dict)

    return response(
        200,
        "Invoices retrieved successfully",
        {"results": data, "page_info": invoices["meta"]},
    )


@router.post("/invoices")
async def create_invoice(
    invoice_in: InvoiceCreate,
    invoice_service: InvoiceService = Depends(get_invoice_service),
):
    invoice = await invoice_service.create_invoice(invoice_in)

    inv_dict = invoice.model_dump()
    inv_dict["lines"] = [line.model_dump() for line in invoice.lines]

    return response(201, "Invoice created successfully", inv_dict)


@router.patch("/invoices/{id}/sent")
async def mark_invoice_sent(
    id: int, invoice_service: InvoiceService = Depends(get_invoice_service)
):
    invoice = await invoice_service.mark_sent(id)
    if not invoice:
        raise BadRequest("Invoice not found")

    inv_dict = invoice.model_dump()
    inv_dict["lines"] = [line.model_dump() for line in invoice.lines]

    return response(200, "Invoice marked as sent successfully", inv_dict)


@router.patch("/invoices/{id}/post")
async def post_invoice(
    id: int,
    request: Request,
    invoice_service: InvoiceService = Depends(get_invoice_service),
):
    from src.modules.journal_entry.journal_entry_routes import get_current_user_id

    user_id = await get_current_user_id(request)

    invoice = await invoice_service.post_invoice(id, user_id)
    if not invoice:
        raise BadRequest("Invoice not found")

    inv_dict = invoice.model_dump()
    inv_dict["lines"] = [line.model_dump() for line in invoice.lines]

    return response(
        200, "Invoice posted successfully and Journal Entry created", inv_dict
    )


@router.patch("/invoices/{id}/pay")
async def mark_invoice_paid(
    id: int, invoice_service: InvoiceService = Depends(get_invoice_service)
):
    invoice = await invoice_service.mark_paid(id)
    if not invoice:
        raise BadRequest("Invoice not found")

    inv_dict = invoice.model_dump()
    inv_dict["lines"] = [line.model_dump() for line in invoice.lines]

    return response(200, "Invoice marked as paid successfully", inv_dict)
