import asyncio
from sqlmodel import select
from src.core.database import get_session
from src.models.user import User
from src.modules.ai.service import AiService

async def main():
    async for session in get_session():
        # Get first user
        result = await session.exec(select(User))
        user = result.first()
        if not user:
            print("No user found in DB, skipping AI test.")
            return
            
        print(f"Testing AI with user: {user.email}")
        
        ai_service = AiService(session)
        try:
            # We are passing a test message to ensure the LLM chain and DB persistence work.
            response = await ai_service.chat(user.org_id, user.id, "Hello, can you help me with Verifine?")
            print(f"Assistant: {response.message}")
            
            threads = await ai_service.get_threads(user.org_id, user.id)
            print(f"Found {len(threads)} threads for this user.")
        except Exception as e:
            print(f"Error during AI test: {e}")
        break

if __name__ == "__main__":
    asyncio.run(main())
