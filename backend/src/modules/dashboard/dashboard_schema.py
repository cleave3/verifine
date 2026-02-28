from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime


class ChartDataPoint(BaseModel):
    name: str  # e.g. "Mar 2026"
    revenue: float
    expenses: float
    net_income: float


class RecentTransaction(BaseModel):
    id: int
    date: datetime
    description: str
    amount: float
    type: str  # 'JE', 'INVOICE', 'BILL'


class DashboardStats(BaseModel):
    total_open_ar: float
    total_open_ap: float
    current_period_revenue: float
    current_period_expenses: float
    current_period_net_income: float


class DashboardResponse(BaseModel):
    stats: DashboardStats
    chart_data: List[ChartDataPoint]
    recent_transactions: List[RecentTransaction]
