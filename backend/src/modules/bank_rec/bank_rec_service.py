from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from fastapi import HTTPException
from src.models import BankStatement, BankStatementLine
from src.models.journal_entry import LedgerLine
from src.modules.bank_rec.bank_rec_schema import (
    BankStatementCreate,
    MatchLineRequest,
    MatchSuggestion,
)
from datetime import date


class BankRecService:
    def __init__(self, session: AsyncSession, current_user):
        self.session = session
        self.current_user = current_user

    async def get_statements(self, skip: int = 0, limit: int = 100):
        query = (
            select(BankStatement)
            .where(BankStatement.org_id == self.current_user.org_id)
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.exec(query)

        return result.all()

    async def get_statement(self, statement_id: int):
        st = await self.session.get(BankStatement, statement_id)
        if not st or st.org_id != self.current_user.org_id:
            raise HTTPException(status_code=404, detail="Statement not found")
        return st

    async def upload_statement(self, data: BankStatementCreate):
        statement = BankStatement(
            org_id=self.current_user.org_id,
            account_id=data.account_id,
            statement_date=data.statement_date,
            start_balance=data.start_balance,
            end_balance=data.end_balance,
        )
        self.session.add(statement)
        await self.session.flush()

        for line in data.lines:
            b_line = BankStatementLine(
                statement_id=statement.id,
                date=line.date,
                description=line.description,
                amount=line.amount,
                reference=line.reference,
            )
            self.session.add(b_line)
        await self.session.commit()
        await self.session.refresh(statement)
        return statement

    async def suggest_matches(self, statement_id: int):
        st = await self.get_statement(statement_id)
        # from sqlalchemy.orm import selectinload

        acc_query = (
            select(LedgerLine)
            # .options(selectinload(LedgerLine.journal_entry))
            .where(
                LedgerLine.org_id == self.current_user.org_id,
                LedgerLine.account_id == st.account_id,
                LedgerLine.is_reconciled == False,
            )
        )
        ledger_lines = (await self.session.exec(acc_query)).all()

        suggestions = []
        # get all lines for the bank statement
        st_lines_query = select(BankStatementLine).where(
            BankStatementLine.statement_id == statement_id
        )
        st_lines = (await self.session.exec(st_lines_query)).all()

        for bl in st_lines:
            if bl.is_reconciled:
                continue

            for ll in ledger_lines:
                ledger_amount = float(ll.base_debit) - float(ll.base_credit)

                if abs(float(bl.amount) - ledger_amount) < 0.01:
                    delta = abs((bl.date - ll.journal_entry.entry_date).days)
                    confidence = "LOW"
                    if delta == 0:
                        confidence = "HIGH"
                    elif delta <= 3:
                        confidence = "MEDIUM"

                    suggestions.append(
                        MatchSuggestion(
                            bank_line_id=bl.id,
                            ledger_line_id=ll.id,
                            confidence=confidence,
                        )
                    )
        return suggestions

    async def match_lines(self, statement_id: int, request: MatchLineRequest):
        st = await self.get_statement(statement_id)
        bl = await self.session.get(BankStatementLine, request.bank_line_id)
        if not bl or bl.statement_id != statement_id:
            raise HTTPException(status_code=404, detail="Bank line not found")

        ll = await self.session.get(LedgerLine, request.ledger_line_id)
        if not ll or ll.account_id != st.account_id:
            raise HTTPException(
                status_code=404, detail="Ledger line not found or invalid matching"
            )

        if bl.is_reconciled or ll.is_reconciled:
            raise HTTPException(status_code=400, detail="Lines are already reconciled")

        bl.is_reconciled = True
        bl.matched_journal_line_id = ll.id
        ll.is_reconciled = True
        ll.reconciled_at = date.today()

        self.session.add(bl)
        self.session.add(ll)
        await self.session.flush()

        all_lines_query = select(BankStatementLine).where(
            BankStatementLine.statement_id == statement_id
        )
        all_lines = (await self.session.exec(all_lines_query)).all()

        if all(line.is_reconciled for line in all_lines):
            st.status = "RECONCILED"
            self.session.add(st)

        await self.session.commit()
        return {"status": "success"}
