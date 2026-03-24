import mongoose, { Schema, Document } from "mongoose";

export interface ChatDocument extends Document {
    participants: (mongoose.Types.ObjectId | string)[];
    lastMessage: mongoose.Types.ObjectId | string;
    isGroup: boolean;
    groupName: string;
    createdBy: mongoose.Types.ObjectId | string;
    createdAt: Date;
    updatedAt: Date;
    isAiChat?: boolean;
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
    },
    isAiChat:{
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
})

chatSchema.pre("save", async function(this: ChatDocument){
    if(this.isNew){
        const user= mongoose.model("user");
        const participants=await user.find({
            _id: {$in: this.participants},
            isAI: true
        })
        if(participants.length>0){
            this.isAiChat=true;
        }
    }
})

const chatModel = mongoose.model<ChatDocument>("chat", chatSchema);
export default chatModel;
