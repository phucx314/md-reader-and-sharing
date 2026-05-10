from typing import Optional
from sqlmodel import SQLModel, Field
from pydantic import EmailStr


class UserBase(SQLModel):
    username: str = Field(unique=True, index=True)
    email: EmailStr = Field(unique=True, index=True)


class UserCreate(UserBase):
    password: str = Field(min_length=6, max_length=72)


class User(UserBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    hashed_password: str


class UserRead(UserBase):
    id: int


class Token(SQLModel):
    access_token: str
    token_type: str


class TokenData(SQLModel):
    username: Optional[str] = None
