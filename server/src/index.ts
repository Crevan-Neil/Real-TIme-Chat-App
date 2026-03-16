import "dotenv/config";
import express, { urlencoded, Request, Response } from "express";
import cookie from "cookie-parser";
import cors from "cors";
import passport from "passport";
import { Env } from "./config/env.config";
import { asyncHandler } from "./middlewares/asyncHandler.middleware";
import { HTTPSTATUS } from "./config/http.config";
import { errorHandler } from "./middlewares/errorHandler.middleware";
import connectDatabase from "./config/database.config";
import "./config/passport.config";
import router from "./routes";

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(urlencoded({ extended: true }));
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

app.listen(Env.PORT, async() => {
    await connectDatabase();
    console.log(`Server is running on port ${Env.PORT} in ${Env.NODE_ENV} mode`);
})