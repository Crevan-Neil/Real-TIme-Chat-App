import userModel from "../models/user.model"


export const findByIdUserService=async(userId: string)=>{
    return await userModel.findById(userId);
}

export const getUserService= async(userId:string)=>{
    const users= await userModel.find({
        _id: {$ne:userId}    
    }).select("-password")
    return users;
}