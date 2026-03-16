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
    let chat;
    let allParticipantIds: string[] = [];

    if (isGroup && participants?.length && groupName) {
        allParticipantIds = [userId, ...participants];
        chat = await chatModel.create({
            participants: allParticipantIds,
            isGroup: true,
            groupName,
            createdBy: userId
        });
        
        return await chat.populate("participants", "name avatar");
    } else if (participantId) {
        const otherUser = await userModel.findById(participantId);
        if (!otherUser) throw new NotFoundException("User not found");

        allParticipantIds = [userId, participantId];
        const existingChat = await chatModel.findOne({
            participants: {
                $all: allParticipantIds,
                $size: 2
            }
        }).populate("participants", "name avatar")

        if (existingChat) return existingChat;

        chat = await chatModel.create({
            participants: allParticipantIds,
            isGroup: false,
            createdBy: userId
        });

        return await chat.populate("participants", "name avatar");
    }

    throw new BadRequestException("Invalid chat creation parameters. Provide participantId for private chat or groupName and participants for group chat.");
}


export const getUserChatsService= async(userId: string)=>{
    const chats= await chatModel.find({
        participants:{
            $in: [userId]
        },
    }).populate("participants", "name avatar")
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
    const chat= await chatModel.findById(chatId);
    if(!chat) throw new NotFoundException("Chat not found");

    if (!chat.participants.includes(userId as any)) {
        throw new ForbiddenException("You are not a participant in this chat");
    }

    const messages= await messageModel.find({chatId}).populate("sender", "name avatar")
    .populate({
        path: "replyTo",
        select: "content image sender",
        populate:({
            path: "sender",
            select: "name avatar"
        })
    })
    .sort({createdAt:1});

    return{
        chat,
        messages
    }
}