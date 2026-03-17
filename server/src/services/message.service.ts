
import mongoose from "mongoose";
import cloudinary from "../config/cloudinary.config";
import chatModel from "../models/chat.model";
import messageModel from "../models/message.model";
import { BadRequestException, NotFoundException } from "../utils/app-error";
import { emitLastMessageToParticipants, emitNewMessageToChatRoom } from "../lib/socket";


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



    return { message: newMessage, chat }

}