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

if(Env.NODE_ENV === "production"){
    const clientPath= path.resolve(__dirname, "../../client/dist");
    app.use(express.static(clientPath));
    app.get(/^(?!\/api).*/, (req:Request, res:Response)=>{
        res.sendFile(path.join(clientPath, "index.html"));
    })
}

server.listen(Env.PORT, async() => {
    await connectDatabase();
    await CreateWhoopAI();
    console.log(`Server is running on port ${Env.PORT} in ${Env.NODE_ENV} mode`);
})