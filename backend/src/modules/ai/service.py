import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from ...models.ai import AiThread, AiMessage
from .schemas import MessageResponse, ThreadResponse, ThreadDetailResponse
from ...core.config import Config
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage


class AiService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash", google_api_key=Config.GEMINI_API_KEY
        )

    async def get_or_create_thread(
        self,
        org_id: uuid.UUID,
        user_id: int,
        thread_id: uuid.UUID | None = None,
        title: str | None = None,
    ) -> AiThread:
        if thread_id:
            statement = select(AiThread).where(
                AiThread.id == thread_id,
                AiThread.org_id == org_id,
                AiThread.user_id == user_id,
            )
            result = await self.db.exec(statement)
            thread = result.first()
            if thread:
                return thread

        new_thread = AiThread(org_id=org_id, user_id=user_id, title=title)
        self.db.add(new_thread)
        await self.db.commit()
        await self.db.refresh(new_thread)
        return new_thread

    async def get_thread_history(self, thread_id: uuid.UUID) -> list:
        statement = (
            select(AiMessage)
            .where(AiMessage.thread_id == thread_id)
            .order_by(AiMessage.created_at)
        )
        result = await self.db.exec(statement)
        messages = result.all()

        history = []
        for msg in messages:
            if msg.role == "user":
                history.append(HumanMessage(content=msg.content))
            elif msg.role == "assistant":
                history.append(AIMessage(content=msg.content))
        return history

    async def chat(
        self,
        org_id: uuid.UUID,
        user_id: int,
        message: str,
        thread_id: uuid.UUID | None = None,
    ) -> MessageResponse:
        thread = await self.get_or_create_thread(
            org_id, user_id, thread_id, title=message[:20]
        )

        # Save user message
        user_msg = AiMessage(thread_id=thread.id, role="user", content=message)
        self.db.add(user_msg)
        await self.db.commit()

        # Get history
        history = await self.get_thread_history(thread.id)

        # Basic context for now - will be expanded to full SQL agent
        system_content = f"You are VeriBot, a helpful financial assistant. You must ONLY answer questions based on the user's financial data. When providing numbers, format them nicely. Be concise and professional.\n\n"

        from langgraph.prebuilt import create_react_agent
        from .tools import get_financial_tools

        tools = get_financial_tools(self.db, org_id)
        agent_executor = create_react_agent(self.llm, tools)

        system_msg = SystemMessage(content=system_content)
        messages = [system_msg] + history + [HumanMessage(content=message)]
        result = await agent_executor.ainvoke({"messages": messages})

        # The agent's final response might be a string or a list of blocks
        final_message_content = result["messages"][-1].content
        if isinstance(final_message_content, list):
            # Extract text from the list of blocks
            extracted_text = " ".join(
                [
                    block.get("text", "")
                    for block in final_message_content
                    if isinstance(block, dict) and "text" in block
                ]
            )
            if not extracted_text:
                extracted_text = str(final_message_content)
            final_message_content = extracted_text

        # Save assistant message
        ai_msg = AiMessage(
            thread_id=thread.id, role="assistant", content=final_message_content
        )
        self.db.add(ai_msg)
        await self.db.commit()
        await self.db.refresh(ai_msg)

        return MessageResponse(
            thread_id=thread.id,
            message=ai_msg.content,
            role=ai_msg.role,
            created_at=ai_msg.created_at,
        )

    async def get_threads(
        self, org_id: uuid.UUID, user_id: int
    ) -> list[ThreadResponse]:
        statement = (
            select(AiThread)
            .where(AiThread.org_id == org_id, AiThread.user_id == user_id)
            .order_by(AiThread.updated_at.desc())
        )

        result = await self.db.exec(statement)
        threads = result.all()

        return [
            ThreadResponse(
                id=t.id, title=t.title, created_at=t.created_at, updated_at=t.updated_at
            )
            for t in threads
        ]

    async def get_thread_details(
        self, org_id: uuid.UUID, user_id: int, thread_id: uuid.UUID
    ) -> ThreadDetailResponse | None:
        statement = select(AiThread).where(
            AiThread.id == thread_id,
            AiThread.org_id == org_id,
            AiThread.user_id == user_id,
        )
        result = await self.db.exec(statement)
        thread = result.first()

        if not thread:
            return None

        msg_statement = (
            select(AiMessage)
            .where(AiMessage.thread_id == thread_id)
            .order_by(AiMessage.created_at)
        )
        msg_result = await self.db.exec(msg_statement)
        messages = msg_result.all()

        formatted_messages = [
            MessageResponse(
                thread_id=m.thread_id,
                message=m.content,
                role=m.role,
                created_at=m.created_at,
            )
            for m in messages
        ]

        return ThreadDetailResponse(
            id=thread.id,
            title=thread.title,
            created_at=thread.created_at,
            updated_at=thread.updated_at,
            messages=formatted_messages,
        )

    async def delete_thread(
        self, org_id: uuid.UUID, user_id: int, thread_id: uuid.UUID
    ) -> bool:
        statement = select(AiThread).where(
            AiThread.id == thread_id,
            AiThread.org_id == org_id,
            AiThread.user_id == user_id,
        )
        result = await self.db.exec(statement)
        thread = result.first()

        if not thread:
            return False

        # Cascade delete is usually handled by DB relationships,
        # but to be safe we can delete messages first if no cascade is set up,
        # or just delete the thread. Assuming AI messages have a cascade or we delete manually.
        msg_statement = select(AiMessage).where(AiMessage.thread_id == thread_id)
        msg_result = await self.db.exec(msg_statement)
        messages = msg_result.all()
        for msg in messages:
            await self.db.delete(msg)

        await self.db.delete(thread)
        await self.db.commit()
        return True
