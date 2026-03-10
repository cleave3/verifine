from fastapi import APIRouter, Depends, Request, Response
from sqlmodel.ext.asyncio.session import AsyncSession
import uuid

from src.core.database import get_session
from src.core.security_roles import get_current_user, role_required
from src.core.tenant import get_current_org
from src.core.audit import log_audit_event
from src.utils.common import response
from src.models.user import User, UserRole
from src.models.payroll import Employee, PayrollRun, PaySlip
from src.modules.payroll.payroll_schema import (
    EmployeeCreate,
    EmployeeUpdate,
    PayrollRunCreate,
    PayrollRunConfirm,
    PayrollSettingsRead,
    PayrollSettingsUpdate,
)
from src.modules.payroll.employee_service import EmployeeService, get_employee_service
from src.modules.payroll.payroll_service import PayrollService, get_payroll_service

router = APIRouter(prefix="/payroll", tags=["Payroll"])

# --- Employees ---


@router.post("/employees")
async def create_employee(
    request: Request,
    payload: EmployeeCreate,
    employee_service: EmployeeService = Depends(get_employee_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(role_required([UserRole.ADMIN, UserRole.CONTROLLER])),
    session: AsyncSession = Depends(get_session),
):
    employee = await employee_service.create_employee(org_id, payload)

    client_ip = request.client.host if request.client else None
    await log_audit_event(
        session=session,
        org_id=org_id,
        user_id=current_user.id,
        action="CREATE_EMPLOYEE",
        entity_type="Employee",
        entity_id=str(employee.id),
        new_state=employee.model_dump(),
        ip_address=client_ip,
    )
    await session.commit()

    return response(201, "Employee created successfully", employee.model_dump())


@router.get("/employees")
async def get_employees(
    employee_service: EmployeeService = Depends(get_employee_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(
        role_required([UserRole.ADMIN, UserRole.CONTROLLER, UserRole.ACCOUNTANT])
    ),
):
    employees = await employee_service.get_employees(org_id)
    return response(
        200, "Employees retrieved successfully", [e.model_dump() for e in employees]
    )


@router.get("/employees/{employee_id}")
async def get_employee(
    employee_id: int,
    employee_service: EmployeeService = Depends(get_employee_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(
        role_required([UserRole.ADMIN, UserRole.CONTROLLER, UserRole.ACCOUNTANT])
    ),
):
    employee = await employee_service.get_employee(org_id, employee_id)
    return response(200, "Employee retrieved successfully", employee.model_dump())


@router.put("/employees/{employee_id}")
async def update_employee(
    request: Request,
    employee_id: int,
    payload: EmployeeUpdate,
    employee_service: EmployeeService = Depends(get_employee_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(role_required([UserRole.ADMIN, UserRole.CONTROLLER])),
    session: AsyncSession = Depends(get_session),
):
    old_employee = await employee_service.get_employee(org_id, employee_id)
    old_state = old_employee.model_dump()

    employee = await employee_service.update_employee(org_id, employee_id, payload)

    client_ip = request.client.host if request.client else None
    await log_audit_event(
        session=session,
        org_id=org_id,
        user_id=current_user.id,
        action="UPDATE_EMPLOYEE",
        entity_type="Employee",
        entity_id=str(employee.id),
        old_state=old_state,
        new_state=employee.model_dump(),
        ip_address=client_ip,
    )
    await session.commit()

    return response(200, "Employee updated successfully", employee.model_dump())


# --- Payroll Runs ---


@router.post("/runs")
async def initiate_payroll_run(
    request: Request,
    payload: PayrollRunCreate,
    payroll_service: PayrollService = Depends(get_payroll_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(role_required([UserRole.ADMIN, UserRole.CONTROLLER])),
    session: AsyncSession = Depends(get_session),
):
    run = await payroll_service.initiate_payroll_run(
        org_id, payload.period_id, payload.pay_date
    )

    client_ip = request.client.host if request.client else None
    await log_audit_event(
        session=session,
        org_id=org_id,
        user_id=current_user.id,
        action="INITIATE_PAYROLL_RUN",
        entity_type="PayrollRun",
        entity_id=str(run.id),
        new_state=run.model_dump(),
        ip_address=client_ip,
    )
    await session.commit()

    return response(201, "Payroll run initiated successfully", run.model_dump())


@router.get("/runs")
async def get_payroll_runs(
    payroll_service: PayrollService = Depends(get_payroll_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(
        role_required([UserRole.ADMIN, UserRole.CONTROLLER, UserRole.ACCOUNTANT])
    ),
):
    runs = await payroll_service.get_payroll_runs(org_id)
    return response(
        200, "Payroll runs retrieved successfully", [r.model_dump() for r in runs]
    )


@router.get("/runs/{run_id}/payslips")
async def get_payroll_payslips(
    run_id: int,
    payroll_service: PayrollService = Depends(get_payroll_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(
        role_required([UserRole.ADMIN, UserRole.CONTROLLER, UserRole.ACCOUNTANT])
    ),
):
    slips = await payroll_service.get_payroll_payslips(org_id, run_id)
    return response(
        200, "Payslips retrieved successfully", [s.model_dump() for s in slips]
    )


@router.get("/payslips/{payslip_id}/download")
async def download_payslip(
    payslip_id: int,
    payroll_service: PayrollService = Depends(get_payroll_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(
        role_required([UserRole.ADMIN, UserRole.CONTROLLER, UserRole.ACCOUNTANT])
    ),
):
    pdf_bytes = await payroll_service.generate_payslip_pdf(org_id, payslip_id)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="payslip_{payslip_id}.pdf"'
        },
    )


@router.post("/runs/{run_id}/confirm")
async def confirm_payroll_run(
    request: Request,
    run_id: int,
    payload: PayrollRunConfirm,
    payroll_service: PayrollService = Depends(get_payroll_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(role_required([UserRole.ADMIN, UserRole.CONTROLLER])),
    session: AsyncSession = Depends(get_session),
):
    old_run = (await payroll_service.session.get(PayrollRun, run_id)).model_dump()

    run = await payroll_service.confirm_payroll_run(
        org_id=org_id,
        run_id=run_id,
        user_id=current_user.id,
        wages_expense_account_id=payload.wages_expense_account_id,
        payroll_liabilities_account_id=payload.payroll_liabilities_account_id,
        cash_account_id=payload.cash_account_id,
    )

    client_ip = request.client.host if request.client else None
    await log_audit_event(
        session=session,
        org_id=org_id,
        user_id=current_user.id,
        action="CONFIRM_PAYROLL_RUN",
        entity_type="PayrollRun",
        entity_id=str(run.id),
        previous_state=old_run,
        new_state=run.model_dump(),
        ip_address=client_ip,
    )
    await session.commit()

    return response(200, "Payroll run confirmed successfully", run.model_dump())


# --- Payroll Settings ---


@router.get("/settings", response_model=dict)
async def get_payroll_settings(
    payroll_service: PayrollService = Depends(get_payroll_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(role_required([UserRole.ADMIN, UserRole.CONTROLLER])),
):
    settings = await payroll_service.get_payroll_settings(org_id)
    return response(
        200, "Payroll settings retrieved successfully", settings.model_dump()
    )


@router.put("/settings", response_model=dict)
async def update_payroll_settings(
    request: Request,
    payload: PayrollSettingsUpdate,
    payroll_service: PayrollService = Depends(get_payroll_service),
    org_id: uuid.UUID = Depends(get_current_org),
    current_user: User = Depends(role_required([UserRole.ADMIN, UserRole.CONTROLLER])),
    session: AsyncSession = Depends(get_session),
):
    old_settings = (await payroll_service.get_payroll_settings(org_id)).model_dump()
    settings = await payroll_service.update_payroll_settings(org_id, payload)

    client_ip = request.client.host if request.client else None
    await log_audit_event(
        session=session,
        org_id=org_id,
        user_id=current_user.id,
        action="UPDATE_PAYROLL_SETTINGS",
        entity_type="PayrollSettings",
        entity_id=str(settings.id),
        previous_state=old_settings,
        new_state=settings.model_dump(),
        ip_address=client_ip,
    )
    await session.commit()

    return response(200, "Payroll settings updated successfully", settings.model_dump())
