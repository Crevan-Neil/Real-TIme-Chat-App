import { z } from "zod";

export const createChatSchema= z.object({
    participantId: z.string().trim().min(1).optional(),
    isGroup: z.boolean().optional(),
    participants: z.array(z.string().trim().min(1)).optional(),
    groupName: z.string().trim().min(1).optional(),
    groupname: z.string().trim().min(1).optional()
}).refine((data) => {
    if (data.isGroup) {
        return (!!data.groupName || !!data.groupname) && !!data.participants?.length;
    }
    return !!data.participantId;
}, {
    message: "Invalid chat creation parameters. Provide participantId for private chat, or groupName and participants for group chat.",
    path: ["isGroup"]
}).transform((data) => ({
    ...data,
    groupName: data.groupName || data.groupname
}))

export const chatIdSchema= z.object({
    id: z.string().trim().min(24).regex(/^[0-9a-fA-F]{24}$/, "Invalid Chat ID format")
})