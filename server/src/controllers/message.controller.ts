import { Request, Response } from "express";
import { HTTPSTATUS } from "../config/http.config";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { sendMessageService } from "../services/message.service";
import { sendMessageSchema } from "../validators/message.validator";


export const sendMessageController = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?._id?.toString() as unknown as string;
    const body = sendMessageSchema.parse(req.body);
    const result = await sendMessageService(userId, body);
    return res.status(HTTPSTATUS.OK).json({
        message: "Message sent successfully",
        newMessage: result.message,
        chat: result.chat
    })
})