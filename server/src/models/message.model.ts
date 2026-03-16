import mongoose, {Schema, Document} from "mongoose";

export interface MessageDocument extends Document{
    chatId: mongoose.Schema.Types.ObjectId | string;
    sender: mongoose.Schema.Types.ObjectId | string;
    content?: string;
    image?: string;
    replyTo?: mongoose.Schema.Types.ObjectId | string;
    createdAt: Date;
    updatedAt: Date
}

const messageSchema=new Schema<MessageDocument>({
    chatId:{
        type: Schema.Types.ObjectId,
        required: true,
        ref: "chat"
    },
    content:{
        type: String
    },
    image:{
        type: String
    },
    sender:{
        type: Schema.Types.ObjectId,
        required: true,
        ref: "user"
    },
    replyTo:{
        type: Schema.Types.ObjectId,
        ref: "message",
        default: null
    }

},{ 
    timestamps: true
})

const messageModel= mongoose.model<MessageDocument>("message", messageSchema);
export default messageModel;