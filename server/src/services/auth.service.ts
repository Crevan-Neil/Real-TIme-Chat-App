import userModel from "../models/user.model";
import { NotFoundException, UnauthorizedException, ConflictException } from "../utils/app-error";
import { LoginSchemaType, RegisterSchemaType } from "../validators/auth.validator";

export const registerService= async(body: RegisterSchemaType)=>{
    const {email}=body
    const existingUser= await userModel.findOne({email});
    if(existingUser)throw new ConflictException("User already exists");
    const newUser= new userModel({
        name: body.name,
        email: body.email,
        password: body.password,
        avatar: body.avatar
    })
    await newUser.save();
    return newUser;
}

export const loginService= async(body: LoginSchemaType)=>{
    const {email, password}=body;
    const user= await userModel.findOne({email});
    if(!user)throw new NotFoundException("Email or Password is incorrect");
    const isPasswordValid= await user.comparePassword(password);
    if(!isPasswordValid)throw new UnauthorizedException("Email or Password is invalid");
    return user;

}