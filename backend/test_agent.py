import asyncio
from src.core.database import get_session
from src.models.user import User
from src.modules.ai.service import AiService

async def main():
    async for session in get_session():
        result = await session.exec(select(User))
        user = result.first()
        if not user:
            print("No user found")
            return
            
        print(f"Testing LangGraph Agent with user: {user.email}")
        
        ai_service = AiService(session)
        try:
            # Clean start: new thread
            response = await ai_service.chat(user.org_id, user.id, "What are my total expenses?")
            print(f"Assistant: {response.message}")
            
        except Exception as e:
            print(f"Error during AI test: {e}")
        break

if __name__ == "__main__":
    from sqlmodel import select
    asyncio.run(main())
