import api from "../../lib/axios";

export interface MessageRequest {
  thread_id: string | null;
  message: string;
}

export interface MessageResponse {
  thread_id: string;
  message: string;
  role: "user" | "assistant";
  created_at: string;
}

export interface ThreadResponse {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ThreadDetailResponse extends ThreadResponse {
  messages: MessageResponse[];
}

export const aiApi = {
  chat: async (data: MessageRequest): Promise<MessageResponse> => {
    const response = await api.post("/ai/chat", data);
    return response.data;
  },

  getThreads: async (): Promise<ThreadResponse[]> => {
    const response = await api.get("/ai/threads");
    return response.data;
  },

  getThreadDetails: async (threadId: string): Promise<ThreadDetailResponse> => {
    const response = await api.get(`/ai/threads/${threadId}`);
    return response.data;
  },

  deleteThread: async (threadId: string): Promise<void> => {
    await api.delete(`/ai/threads/${threadId}`);
  },
};
