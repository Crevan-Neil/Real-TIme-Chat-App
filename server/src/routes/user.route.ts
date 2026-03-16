import { Router } from "express";
import { passportAuthenticateJwt } from "../config/passport.config";
import { createChatController, getSingleChatController, getUserChatController } from "../controllers/chat.controller";
import { getUserController } from "../controllers/user.controller";

const userRoutes= Router();

userRoutes.get("/all", passportAuthenticateJwt, getUserController);




export default userRoutes;