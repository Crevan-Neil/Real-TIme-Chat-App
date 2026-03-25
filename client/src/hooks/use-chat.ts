/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import type { UserType } from "@/types/auth.type";
import type {
  ChatType,
  CreateChatType,
  CreateMessageType,
  MessageType,
} from "@/types/chat.type";
import { API } from "@/lib/axios-client";
import { toast } from "sonner";
import { useAuth } from "./use-auth";
import { generateUUID } from "@/lib/helper";

const AI_STREAM_ID = "__ai_streaming__";

interface AIStreamPayload {
  chatId: string;
  chunk: string | null;
  sender: any;
  done: boolean;
  message: MessageType | null;
}

interface ChatState {
  chats: ChatType[];
  users: UserType[];
  singleChat: {
    chat: ChatType;
    messages: MessageType[];
  } | null;

  currentAIStreamId: string | null;

  isChatsLoading: boolean;
  isUsersLoading: boolean;
  isCreatingChat: boolean;
  isSingleChatLoading: boolean;
  isSendingMsg: boolean;

  fetchAllUsers: () => void;
  fetchChats: () => void;
  createChat: (payload: CreateChatType) => Promise<ChatType | null>;
  fetchSingleChat: (chatId: string) => void;
  sendMessage: (payload: CreateMessageType) => void;
  handleChatAI: (payload: AIStreamPayload) => void;

  addNewChat: (newChat: ChatType) => void;
  updateChatLastMessage: (chatId: string, lastMessage: MessageType) => void;
  addNewMessage: (chatId: string, message: MessageType) => void;
}

export const useChat = create<ChatState>()((set, get) => ({
  chats: [],
  users: [],
  singleChat: null,

  isChatsLoading: false,
  isUsersLoading: false,
  isCreatingChat: false,
  isSingleChatLoading: false,
  isSendingMsg: false,

  currentAIStreamId: null,

  fetchAllUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const { data } = await API.get("/user/all");
      set({ users: data.users });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to fetch users");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  fetchChats: async () => {
    set({ isChatsLoading: true });
    try {
      const { data } = await API.get("/chat/all");
      set({ chats: data.chats });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to fetch chats");
    } finally {
      set({ isChatsLoading: false });
    }
  },

  createChat: async (payload: CreateChatType) => {
    set({ isCreatingChat: true });
    try {
      const response = await API.post("/chat/create", {
        ...payload,
      });
      get().addNewChat(response.data.chat);
      toast.success("Chat created successfully");
      return response.data.chat;
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to fetch chats");
      return null;
    } finally {
      set({ isCreatingChat: false });
    }
  },

  fetchSingleChat: async (chatId: string) => {
    set({ isSingleChatLoading: true });
    try {
      const { data } = await API.get(`/chat/${chatId}`);
      set({ singleChat: data });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to fetch chats");
    } finally {
      set({ isSingleChatLoading: false });
    }
  },

  sendMessage: async (payload: CreateMessageType) => {
    set({ isSendingMsg: true });
    const { chatId, replyTo, content, image } = payload;
    const { user } = useAuth.getState();

    if (!chatId || !user?._id) return;

    const tempUserId = generateUUID();

    const tempMessage = {
      _id: tempUserId,
      chatId,
      content: content || "",
      image: image || null,
      sender: user,
      replyTo: replyTo || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "sending...",
    };



    set((state) => {
      if (state.singleChat?.chat?._id !== chatId) return state;
      return {
        singleChat: {
          ...state.singleChat,
          messages: [...state.singleChat.messages, tempMessage],
        },
      };
    });

    try {
      const { data } = await API.post("/chat/message/send", {
        chatId,
        content,
        image,
        replyToId: replyTo?._id,
      });
      const { newMessage: userMessage } = data;
      //replace the temp user message or remove it if already added by socket
      set((state) => {
        if (!state.singleChat) return state;
        const messages = state.singleChat.messages;
        const exists = messages.some((m) => m._id === userMessage._id);

        if (exists) {
          // If the message already exists (added via socket), just remove the temp one
          return {
            singleChat: {
              ...state.singleChat,
              messages: messages.filter((msg) => msg._id !== tempUserId),
            },
          };
        }

        // Otherwise, replace the temp message
        return {
          singleChat: {
            ...state.singleChat,
            messages: messages.map((msg) =>
              msg._id === tempUserId ? userMessage : msg
            ),
          },
        };
      });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to send message");
    } finally {
      set({ isSendingMsg: false });
    }
  },

  handleChatAI: (payload: AIStreamPayload) => {
    const { chatId, chunk, sender, done, message } = payload;
    const state = get();
    if (state.singleChat?.chat?._id !== chatId) return;

    if (!done && chunk) {
      // Streaming chunk: upsert the placeholder streaming message
      set((s) => {
        if (!s.singleChat) return s;
        const messages = s.singleChat.messages;
        const existingIdx = messages.findIndex((m) => m._id === AI_STREAM_ID);
        if (existingIdx !== -1) {
          // Append chunk to existing streaming message
          const updated = messages.map((m) =>
            m._id === AI_STREAM_ID
              ? { ...m, content: (m.content || "") + chunk }
              : m
          );
          return { singleChat: { ...s.singleChat, messages: updated } };
        } else {
          // Create placeholder streaming message
          const streamingMsg: MessageType = {
            _id: AI_STREAM_ID,
            chatId,
            content: chunk,
            image: null,
            sender,
            replyTo: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            streaming: true,
          };
          return {
            singleChat: {
              ...s.singleChat,
              messages: [...messages, streamingMsg],
            },
          };
        }
      });
    } else if (done && message) {
      // Final message: replace streaming placeholder with committed message
      set((s) => {
        if (!s.singleChat) return s;
        const messages = s.singleChat.messages;
        const hasPlaceholder = messages.some((m) => m._id === AI_STREAM_ID);
        const updated = hasPlaceholder
          ? messages.map((m) => (m._id === AI_STREAM_ID ? message : m))
          : [...messages, message];
        return { singleChat: { ...s.singleChat, messages: updated } };
      });
    }
  },

  addNewChat: (newChat: ChatType) => {
    set((state) => {
      const existingChatIndex = state.chats.findIndex(
        (c) => c._id === newChat._id
      );
      if (existingChatIndex !== -1) {
        //move the chat to the top
        return {
          chats: [newChat, ...state.chats.filter((c) => c._id !== newChat._id)],
        };
      } else {
        return {
          chats: [newChat, ...state.chats],
        };
      }
    });
  },

  updateChatLastMessage: (chatId, lastMessage) => {
    set((state) => {
      const chat = state.chats.find((c) => c._id === chatId);
      if (!chat) return state;
      return {
        chats: [
          { ...chat, lastMessage },
          ...state.chats.filter((c) => c._id !== chatId),
        ],
      };
    });
  },

  addNewMessage: (chatId, message) => {
    set((state) => {
      const chat = state.singleChat;
      if (!chat || chat.chat._id !== chatId) return state;

      const isDuplicate = chat.messages.some((m) => m._id === message._id);
      if (isDuplicate) return state;

      return {
        singleChat: {
          chat: chat.chat,
          messages: [...chat.messages, message],
        },
      };
    });
  },
}));
