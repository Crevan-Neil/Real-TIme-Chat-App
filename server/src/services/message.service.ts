import { createGoogleGenerativeAI } from "@ai-sdk/google";
import mongoose from "mongoose";
import cloudinary from "../config/cloudinary.config";
import chatModel from "../models/chat.model";
import messageModel from "../models/message.model";
import { BadRequestException, NotFoundException } from "../utils/app-error";
import { emitChatAI, emitLastMessageToParticipants, emitNewMessageToChatRoom } from "../lib/socket";
import { Env } from "../config/env.config";
import userModel from "../models/user.model";
import { ModelMessage, streamText } from "ai";

const google= createGoogleGenerativeAI({
    apiKey: Env.GOOGLE_GENERATIVE_AI_API_KEY
})

export const sendMessageService = async (userId: string, body: {
    chatId: string;
    content?: string;
    image?: string;
    replyToId?: string;

}) => {
    const { chatId, content, image, replyToId } = body;
    let chat = await chatModel.findOne({
        _id: chatId,
        participants: {
            $in: [userId]
        }
    })
    if (!chat) throw new BadRequestException("Chat not found or unauthorized");
    if (replyToId) {
        let replyMessage = await messageModel.findOne({
            _id: replyToId,
            chatId
        })
        if (!replyMessage) throw new NotFoundException("Reply message not found");
    }
    let imageUrl;
    if (image) {
        const uploadRes= await cloudinary.uploader.upload(image);
        imageUrl= uploadRes.secure_url;
    }
    const newMessage = await messageModel.create({
        chatId,
        sender: userId,
        content,
        image: imageUrl,
        ...(replyToId && { replyTo: replyToId })
    })
    await newMessage.populate([
        { path: "sender", select: "name avatar" },
        {
            path: "replyTo", select: "content image sender", populate: {
                path: "sender",
                select: "name avatar"
            }
        }
    ])


    chat.lastMessage= newMessage._id as mongoose.Types.ObjectId;
    await chat.save();

    // websocket emit the last messsage to the chat room
    emitNewMessageToChatRoom(userId,chatId, newMessage);
    //websocket emit the last message to members (personal room user)
    const allParticipantIds = chat.participants.map((id)=>id.toString());
    emitLastMessageToParticipants(allParticipantIds, chatId, newMessage);

    let aiResponse: any=null;
    if(chat.isAiChat){
        aiResponse= await getAIResponse(chatId, userId);
        if(aiResponse){
            chat.lastMessage= aiResponse._id as mongoose.Types.ObjectId;
            await chat.save();
        }
    }



    return {
        message: newMessage,
        aiResponse,
        chat,
    };

}

async function getAIResponse(chatId: string, userId: string){
    const whopAI= await userModel.findOne({
        isAI:true
    })
    if(!whopAI)throw new NotFoundException("AI user not found");
    const chatHistory= await getChatHistory(chatId);
    const formattedMessages: ModelMessage[]= chatHistory.map((msg:any)=>{
        const role= msg.sender.isAI ? "assistant" : "user";
        const parts: any[]=[];
        if(msg.image){
            parts.push({
                type: "file",
                data: msg.image,
                mediaType: "image/png",
                filename: "image.png"
            })
            if(!msg.content){
                parts.push({
                    type: "text",
                    text: "Describe what you see in the image"
                })
            }
        }
        if(msg.content){
            parts.push({
                type: "text",
                text: msg.replyTo ? `[Replying to: "${msg.replyTo.content}]\n${msg.content}` : msg.content
            })
        }
        return { role, content: parts } as any;
    })
    const result = await streamText({
        model: google("gemini-2.5-flash"),
        messages: formattedMessages,
        system: "You are whop AI, a helpful and friendly assistant. Respond only with text and attend to the last user message only."
    })
    let fullResponse="";
    for await (const chunk of result.textStream){
        emitChatAI({chatId, chunk, sender:whopAI, done: false, message: null})
        fullResponse+=chunk;
    }
    if(!fullResponse.trim())return "";
    const aiMessage= await messageModel.create({
        chatId,
        sender: whopAI.id,
        content: fullResponse
    })
    await aiMessage.populate("sender", "name avatar isAI");
    //emit ai full response message
    emitChatAI({
        chatId,
        chunk: null,
        sender: whopAI,
        done: true,
        message: aiMessage
    })
    
    // Notify all participants about the new last message
    const chat = await chatModel.findById(chatId);
    if(chat){
        const allParticipantIds = chat.participants.map(id => id.toString());
        emitLastMessageToParticipants(allParticipantIds, chatId, aiMessage);
    }
    
    return aiMessage;
}

async function getChatHistory(chatId:string){
    const messages= await messageModel.find({chatId})
    .populate("sender", "isAI")
    .populate("replyTo", "content")
    .sort({createdAt:-1})
    .limit(5)
    .lean();
    return messages.reverse();
}