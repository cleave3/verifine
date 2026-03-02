import uuid
from fastapi import APIRouter, Depends, Request
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.tenant import get_current_org

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
from src.core.security_roles import role_required, get_current_user
from src.models.user import User, UserRole

router = APIRouter(prefix="/ar", tags=["ar"])


# --- CUSTOMERS ---
@router.get("/customers")
async def list_customers(
    customer_service: CustomerService = Depends(get_customer_service),
    org_id: uuid.UUID = Depends(get_current_org),
):
    customers = await customer_service.get_customers(org_id)
    return response(
        200, "Customers retrieved successfully", [c.model_dump() for c in customers]
    )


@router.post("/customers")
async def create_customer(
    customer_in: CustomerCreate,
    customer_service: CustomerService = Depends(get_customer_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
):
    customer = await customer_service.create_customer(
        org_id, customer_in, current_user.id
    )
    return response(201, "Customer created successfully", customer.model_dump())


@router.patch("/customers/{id}")
async def update_customer(
    id: int,
    customer_in: CustomerUpdate,
    customer_service: CustomerService = Depends(get_customer_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
):
    updated = await customer_service.update_customer(
        org_id, id, customer_in, current_user.id
    )
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
    org_id: uuid.UUID = Depends(get_current_org),
):
    invoices = await invoice_service.get_invoices(
        org_id=org_id,
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
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
):
    invoice = await invoice_service.create_invoice(org_id, invoice_in, current_user.id)

    inv_dict = invoice.model_dump()
    inv_dict["lines"] = [line.model_dump() for line in invoice.lines]

    return response(201, "Invoice created successfully", inv_dict)


@router.patch("/invoices/{id}/sent")
async def mark_invoice_sent(
    id: int,
    invoice_service: InvoiceService = Depends(get_invoice_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
):
    invoice = await invoice_service.mark_sent(org_id, id, current_user.id)
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
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(
        role_required([UserRole.ADMIN, UserRole.CONTROLLER, UserRole.ACCOUNTANT])
    ),
):
    invoice = await invoice_service.post_invoice(org_id, id, current_user.id)
    if not invoice:
        raise BadRequest("Invoice not found")

    inv_dict = invoice.model_dump()
    inv_dict["lines"] = [line.model_dump() for line in invoice.lines]

    return response(
        200, "Invoice posted successfully and Journal Entry created", inv_dict
    )


@router.patch("/invoices/{id}/pay")
async def mark_invoice_paid(
    id: int,
    invoice_service: InvoiceService = Depends(get_invoice_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
):
    invoice = await invoice_service.mark_paid(org_id, id, current_user.id)
    if not invoice:
        raise BadRequest("Invoice not found")

    inv_dict = invoice.model_dump()
    inv_dict["lines"] = [line.model_dump() for line in invoice.lines]

    return response(200, "Invoice marked as paid successfully", inv_dict)


from fastapi import Response
from weasyprint import HTML
from jinja2 import Environment, FileSystemLoader

# Initialize Jinja2 environment for templates
env = Environment(loader=FileSystemLoader("templates"))


@router.get("/invoices/{id}/pdf")
async def download_invoice_pdf(
    id: int,
    invoice_service: InvoiceService = Depends(get_invoice_service),
    org_id: uuid.UUID = Depends(get_current_org),
    session: AsyncSession = Depends(get_session),
):
    # 1. Fetch full generic invoice graph (lines + relations)
    invoice = await invoice_service.get_invoice_by_id(org_id, id)
    if not invoice:
        raise BadRequest("Invoice not found")

    # 2. Extract Customer details
    from src.models.customer import Customer

    customer = await session.get(Customer, invoice.customer_id)

    # 3. Extract Organization / Branding Profile
    from src.models.organization import Organization

    organization = await session.get(Organization, org_id)

    # 4. Map Lines
    # Accounts are lazy-loaded, we need to explicitly load account names for the PDF rendering.
    from src.models.account import Account
    from sqlmodel import select
    from sqlalchemy.orm import selectinload

    detailed_lines = []
    for line in invoice.lines:
        acc = await session.get(Account, line.account_id)
        line_data = line.model_dump()
        line_data["account"] = acc.model_dump() if acc else {"name": "Unknown Account"}
        detailed_lines.append(line_data)

    # 5. Render HTML content via Jinja2
    template = env.get_template("invoice_template.html")
    html_content = template.render(
        invoice=invoice,
        items=detailed_lines,
        customer=customer,
        organization=organization,
        base_currency=organization.base_currency_code,
        branding={
            "logo_url": organization.logo_url,
            "primary_color": organization.primary_color,
            "address": organization.address,
            "tax_id": organization.tax_id,
        },
    )

    # 6. Generate PDF memory buffer using WeasyPrint
    pdf_buffer = HTML(string=html_content).write_pdf()

    return Response(
        content=pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=invoice_{invoice.invoice_number}.pdf"
        },
    )
