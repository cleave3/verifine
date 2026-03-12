import asyncio
from src.modules.ai.knowledge_base import get_system_knowledge_base

async def main():
    kb = get_system_knowledge_base()
    print(f"Loaded {len(kb)} characters from knowledge base.")
    if len(kb) > 100:
        print("Knowledge base integration is working.")
        print(f"Sample: {kb[:100]}...")

if __name__ == "__main__":
    asyncio.run(main())
