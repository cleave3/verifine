from pydantic import BaseModel
from typing import List, Optional


class TrackingOptionBase(BaseModel):
    name: str
    is_active: bool = True


class TrackingOptionCreate(TrackingOptionBase):
    pass


class TrackingOptionUpdate(BaseModel):
    id: Optional[int] = None
    name: str
    is_active: bool = True


class TrackingOptionResponse(TrackingOptionBase):
    id: int
    category_id: int

    class Config:
        from_attributes = True


class TrackingCategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: bool = True


class TrackingCategoryCreate(TrackingCategoryBase):
    options: List[TrackingOptionCreate] = []


class TrackingCategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    options: Optional[List[TrackingOptionUpdate]] = None


class TrackingCategoryResponse(TrackingCategoryBase):
    id: int
    options: List[TrackingOptionResponse] = []

    class Config:
        from_attributes = True
