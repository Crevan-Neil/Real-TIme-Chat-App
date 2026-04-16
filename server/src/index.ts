import "dotenv/config";
import express, { urlencoded, Request, Response } from "express";
import cookie from "cookie-parser";
import cors from "cors";
import passport from "passport";
import http from "http";
import path from "path";
import { Env } from "./config/env.config";
import { asyncHandler } from "./middlewares/asyncHandler.middleware";
import { HTTPSTATUS } from "./config/http.config";
import { errorHandler } from "./middlewares/errorHandler.middleware";
import connectDatabase from "./config/database.config";
import "./config/passport.config";
import router from "./routes";
import { initializeSocket } from "./lib/socket";
import { CreateWhoopAI } from "./scripts/seedWhopAI";

const app = express();
const server= http.createServer(app);

initializeSocket(server);

app.use(express.json({ limit: "50mb" }));
app.use(urlencoded({ extended: true, limit: "50mb" }));
app.use(cookie());
app.use(
    cors({
        origin: Env.FRONTEND_ORIGIN,
        credentials: true
    })
)
app.use(passport.initialize());
app.use("/api", router);

app.use(errorHandler);

app.get("/health", asyncHandler(async (req: Request, res: Response) => {
    res.status(HTTPSTATUS.OK).json({
        message: "Server is healthy",
        status: "OK"
    })
}))

// No longer serving static files from Express (Nginx handles this)

server.listen(Env.PORT, async() => {
    await connectDatabase();
    await CreateWhoopAI();
    console.log(`Server is running on port ${Env.PORT} in ${Env.NODE_ENV} mode`);
})