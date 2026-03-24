import { emitNewChatToParticipants } from "../lib/socket";
import chatModel from "../models/chat.model";
import messageModel from "../models/message.model";
import userModel from "../models/user.model";
import { BadRequestException, ForbiddenException, NotFoundException } from "../utils/app-error";



export const createChatService = async (
    userId: string,
    body: {
        participantId?: string;
        isGroup?: boolean;
        participants?: string[];
        groupName?: string;
    }
) => {
    const { participantId, isGroup, participants, groupName } = body;
    let allParticipantIds: string[] = [];

    if (isGroup && participants?.length && groupName) {
        allParticipantIds = [userId, ...participants];
        const chat = await chatModel.create({
            participants: allParticipantIds,
            isGroup: true,
            groupName,
            createdBy: userId
        });
        
        const populatedChat = await chat.populate("participants", "name avatar");
        const participantIdStrings = populatedChat?.participants?.map((p: any) => p._id?.toString());
        
        emitNewChatToParticipants(participantIdStrings, populatedChat);
        return populatedChat;
    } else if (participantId) {
        const otherUser = await userModel.findById(participantId);
        if (!otherUser) throw new NotFoundException("User not found");

        allParticipantIds = [userId, participantId];
        const existingChat = await chatModel.findOne({
            isGroup: false,
            participants: {
                $all: allParticipantIds,
                $size: 2
            }
        }).populate("participants", "name avatar isAI")

        if (existingChat) return existingChat;

        const chat = await chatModel.create({
            participants: allParticipantIds,
            isGroup: false,
            createdBy: userId
        });



        const populatedChat= await chat.populate("participants", "name avatar isAI");
        const participantIdStrings= populatedChat?.participants?.map((p: any)=>{
            return p._id?.toString();
        });

        emitNewChatToParticipants(participantIdStrings, populatedChat);
        return populatedChat;
    }

    throw new BadRequestException("Invalid chat creation parameters. Provide participantId for private chat or groupName and participants for group chat.");
}


export const getUserChatsService= async(userId: string)=>{
    const chats= await chatModel.find({
        participants:{
            $in: [userId]
        },
    }).populate("participants", "name avatar isAI")
    .populate({
        path: "lastMessage",
        populate:{
            path: "sender",
            select: "name avatar"
        }
    })
    .sort({updatedAt: -1})
    return chats;
}


export const getSingleChatService=async(chatId:string, userId:string)=>{
    const chat= await chatModel.findOne({
        _id: chatId,
        participants:{$in: [userId]}
    }).populate("participants", "name avatar isAI");
    if(!chat) throw new NotFoundException("Chat not found");

    const messages= await messageModel.find({chatId}).populate("sender", "name avatar isAI")
    .populate({
        path: "replyTo",
        select: "content image sender",
        populate:({
            path: "sender",
            select: "name avatar isAI"
        })
    })
    .sort({createdAt:1});

    return{
        chat,
        messages
    }
}

export const validateChatParticipant= async(chatId:string, userId:string)=>{
    const chat= await chatModel.findOne({
        _id:chatId,
        participants:{
            $in:[userId]
        }
    })
    if(!chat)throw new BadRequestException("User not a participant in chat");
    return chat;
}