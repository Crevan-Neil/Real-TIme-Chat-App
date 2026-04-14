import Redis from "ioredis";
import { Env } from "../config/env.config";

export const redis = new Redis(Env.REDIS_URL, {
    maxRetriesPerRequest: null,
});

redis.on("connect", () => {
    console.log("Redis connected successfully");
});

redis.on("error", (error) => {
    console.error("Redis connection error:", error);
});
