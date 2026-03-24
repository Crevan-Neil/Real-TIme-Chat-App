import "dotenv/config";
import userModel from "../models/user.model";
import connectDatabase from "../config/database.config";


export const CreateWhoopAI= async()=>{
    let whopAI= await userModel.findOne({
        isAI:true
    })
    if(whopAI){
        console.log("Whoop AI already exists");
        return whopAI;
    }
    whopAI= await userModel.create({
        name: "Whop AI",
        isAI: true,
        avatar: "https://res.cloudinary.com/de2hfvgyt/image/upload/v1774262105/whop-ai-logo_dpmzbl.png"
    })
    console.log("Whoop AI created:", whopAI._id);
    return whopAI;
}

const seedWhopAI= async()=>{
    try{
        await connectDatabase();
        await CreateWhoopAI();
        console.log("Seeding complete");
        process.exit(0);
    } catch(error){
        console.error("Seeding failed:", error);
        process.exit(1);
    }
}

if (require.main === module) {
    seedWhopAI();
}