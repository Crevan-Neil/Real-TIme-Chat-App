import mongoose, { Schema, Document } from "mongoose";

export interface ChatDocument extends Document {
    participants: (mongoose.Types.ObjectId | string)[];
    lastMessage: mongoose.Types.ObjectId | string;
    isGroup: boolean;
    groupName: string;
    createdBy: mongoose.Types.ObjectId | string;
    createdAt: Date;
    updatedAt: Date;
}

const chatSchema = new Schema<ChatDocument>({
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    }],
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "message",
        default: null
    },
    isGroup: {
        type: Boolean,
        default: false
    },
    groupName: {
        type: String,
        default: ""
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    }
}, {
    timestamps: true
})

const chatModel = mongoose.model("chat", chatSchema);
export default chatModel;
