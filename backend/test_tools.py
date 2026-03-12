import asyncio
from src.core.database import get_session
from src.models.user import User
from src.modules.ai.tools import get_financial_tools
from sqlmodel import select

async def main():
    async for session in get_session():
        result = await session.exec(select(User))
        user = result.first()
        if not user:
            print("No user")
            return
        
        tools = get_financial_tools(session, user.org_id)
        print("Tools loaded:", [t.name for t in tools])
        break

if __name__ == "__main__":
    asyncio.run(main())
