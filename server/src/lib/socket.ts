import { Server as HTTPServer } from "http";
import { Server, type Socket } from "socket.io";
import { Env } from "../config/env.config";
import jwt from "jsonwebtoken";
import { boolean, string } from "zod";
import { validateChatParticipant } from "../services/chat.service";

interface AuthenticatedSocket extends Socket{
    userId?:string
}

let io:Server|null =null;

const onlineUsers=new Map<string,Set<string>>();

export const initializeSocket= (httpServer:HTTPServer)=>{
    io=new Server(httpServer,{
        maxHttpBufferSize: 1e8,
        cors:{
            origin: Env.FRONTEND_ORIGIN,
            methods: ["GET", "POST"],
            credentials: true
        }
    })
    io.use(async(socket:AuthenticatedSocket,next)=>{
        try{
            const rawCookie= socket.handshake.headers.cookie;
            if(!rawCookie) return next(new Error("Unauthorized"));
            const cookies = rawCookie.split(';').reduce((acc, current) => {
                const [key, ...values] = current.trim().split('=');
                if (key) acc[key] = values.join('=');
                return acc;
            }, {} as Record<string, string>);
            const token= cookies["accessToken"];
            if(!token)return next(new Error("Unauthorized"));
            const decodedToken= jwt.verify(token,Env.JWT_SECRET)as {userId:string;}
            if(!decodedToken)return next(new Error("Unauthorized"));
            socket.userId=decodedToken.userId;
            next();
        } catch(error){
            next( new Error("Internal Server Error"));
        }
    })
    io.on("connection",(socket:AuthenticatedSocket)=>{
        if(!socket.userId){
            socket.disconnect(true);
            return;
        }
        const userId=socket.userId;
        const newSocketId= socket.id;
        console.log("socket connected", {userId, newSocketId});
        //register socket for the user
        if(!onlineUsers.has(userId)){
            onlineUsers.set(userId, new Set());
        }
        onlineUsers.get(userId)?.add(newSocketId);
        //broadcast online users to all sockets
        io?.emit("online:users", Array.from(onlineUsers.keys()));
        //create personal room for user
        socket.join(`user:${userId}`);

        socket.on("chat:join", async(chatId:string, callback?:(err?: string)=>void)=>{
            try{
                await validateChatParticipant(chatId, userId);
                socket.join(`chat:${chatId}`);
                callback?.();
            }catch(error){
                callback?.("Error joining chat");
            }
        })

        socket.on("chat:leave", (chatId: string)=>{
            if(chatId){
                socket.leave(`chat:${chatId}`);
                console.log(`User ${userId} left room chat: ${chatId}`);
            }
        })

        socket.on("disconnect", ()=>{
            if(userId && onlineUsers.has(userId)){
                const userSockets = onlineUsers.get(userId);
                userSockets?.delete(newSocketId);
                if(userSockets?.size === 0){
                    onlineUsers.delete(userId);
                }
                io?.emit("online:users", Array.from(onlineUsers.keys()));
                console.log("Socket is disconnected",{
                    userId, newSocketId
                })
            }
        })
    })   
}

function getIO(){
    if(!io)throw new Error("Socket.IO not initialized");
    return io;
}


export const emitNewChatToParticipants= (participantIds: string[]=[], chat: any)=>{
    const io= getIO();
    for(const participantId of participantIds){
        io.to(`user:${participantId}`).emit("chat:new", chat);
    }
}

export const emitLastMessageToParticipants=(participantIds:string[], chatId:string, lastMessage:any)=>{
    const io=getIO();
    const payload= { chatId, lastMessage };
    for (const participantId of participantIds){
        io.to(`user:${participantId}`).emit("chat:update", payload );
    }
}

export const emitNewMessageToChatRoom=(senderId:string, chatId: string, message: any)=>{
    const io=getIO();
    const senderSocketIds= onlineUsers.get(senderId);
    if(senderSocketIds && senderSocketIds.size > 0){
        io.to(`chat:${chatId}`).except(Array.from(senderSocketIds)).emit("message:new", message);
    } else{
        io.to(`chat:${chatId}`).emit("message:new", message);
    }
}

export const emitChatAI=({
    chatId,
    chunk=null,
    sender,
    done=false,
    message=null
}: {
    chatId:string;
    chunk?:string|null;
    sender?: any;
    done?: boolean;
    message?: any;
})=>{
    const io=getIO();
    if(chunk?.trim() && !done){
        io.to(`chat:${chatId}`).emit("chat:ai",{
            chatId,
            chunk,
            done:false,
            message:null,
            sender
        })
        return;
    }
    if(done){
        io.to(`chat:${chatId}`).emit("chat:ai",{
            chatId,
            chunk:null,
            done:true,
            message,
            sender
        })
        return;
    }
}
