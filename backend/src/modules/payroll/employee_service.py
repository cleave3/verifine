from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from uuid import UUID
from datetime import date
from typing import List, Optional
from src.models.payroll import Employee
from fastapi import HTTPException
from src.modules.payroll.payroll_schema import EmployeeCreate, EmployeeUpdate


class EmployeeService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_employee(self, org_id: UUID, payload: EmployeeCreate) -> Employee:
        new_employee = Employee(
            organization_id=org_id,
            first_name=payload.first_name,
            last_name=payload.last_name,
            email=payload.email,
            department_option_id=payload.department_option_id,
            base_salary=payload.base_salary,
            hire_date=payload.hire_date,
        )
        self.session.add(new_employee)
        await self.session.commit()
        await self.session.refresh(new_employee)
        return new_employee

    async def get_employees(self, org_id: UUID) -> List[Employee]:
        result = await self.session.exec(
            select(Employee).where(Employee.organization_id == org_id)
        )
        return list(result.all())

    async def get_employee(self, org_id: UUID, employee_id: int) -> Employee:
        employee = await self.session.get(Employee, employee_id)
        if not employee or employee.organization_id != org_id:
            raise HTTPException(status_code=404, detail="Employee not found")
        return employee

    async def update_employee(
        self, org_id: UUID, employee_id: int, payload: EmployeeUpdate
    ) -> Employee:
        employee = await self.get_employee(org_id, employee_id)
        employee_data = payload.model_dump(exclude_unset=True)

        for key, value in employee_data.items():
            if hasattr(employee, key):
                setattr(employee, key, value)

        self.session.add(employee)
        await self.session.commit()
        await self.session.refresh(employee)
        return employee


from fastapi import Depends
from src.core.database import get_session


def get_employee_service(
    session: AsyncSession = Depends(get_session),
) -> EmployeeService:
    return EmployeeService(session)
