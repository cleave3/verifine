from typing import AsyncGenerator
from sqlmodel import create_engine, SQLModel
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import sessionmaker
from src.core.config import Config

engine = AsyncEngine(
    create_engine(
        url=Config.DATABASE_URL,
        echo=False,
        pool_size=10,  # Set the pool size
        max_overflow=20,  # Allow extra connections above pool_size
        pool_timeout=30,  # Timeout for getting a connection from the pool
        pool_recycle=3600,
        echo_pool=False,
    )
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    Session = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as session:
        yield session


async def connect_to_db():
    try:
        async with engine.begin() as conn:
            # await conn.run_sync(SQLModel.metadata.create_all)
            print("Successfully connected to the database.")
    except Exception as e:
        print(f"Error connecting to the database: {e}")
        raise


async def disconnect_from_db():
    await engine.dispose()
    print("Successfully disconnected to the database.")
