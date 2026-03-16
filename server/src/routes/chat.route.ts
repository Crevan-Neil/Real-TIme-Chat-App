import { Router } from "express";
import { passportAuthenticateJwt } from "../config/passport.config";
import { createChatController, getSingleChatController, getUserChatController } from "../controllers/chat.controller";
import { sendMessageController } from "../controllers/message.controller";

const chatRoutes= Router();

chatRoutes.post("/create", passportAuthenticateJwt, createChatController);
chatRoutes.post("/message/send", passportAuthenticateJwt, sendMessageController);
chatRoutes.get("/all", passportAuthenticateJwt, getUserChatController);
chatRoutes.get("/:id", passportAuthenticateJwt, getSingleChatController);



export default chatRoutes;