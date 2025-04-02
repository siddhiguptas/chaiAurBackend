//ye sirf verify krega ki user h ya nhi h
import { User } from "../models/user.models.js";
import jwt from "jsonwebtoken";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {ApiError} from "../../utils/ApiError.js"

//jb user ko verify karaya to at,rt de diya to unhi k basis pr  to verify krenge agr true login hua to req k andr req .user add kr dunga
//req k paass cookie ka access h udhr se at rt le lenge ya to authorisation se token nikal lo
//header k andr ek key authorisation bhejte h value Bearer <accessToken>
//jb res ka use nhi hota to _ de dete async(req,_,next) me
export const verifyJWT=asyncHandler(async(req,_,next)=>{
    try {
        const token=req.cookies?.accessToken||req.header("Authorization")?.replace("Bearer ","")
    
        if(!token){
            throw new ApiError(401,"Unauthorised request")
        }
    
        //agr token h to hame jwt ka use krk puchna padega ki ye token sahi h ya nhi aur is token me kya kya info h
        //token ko decode vahi kr payega jiske paass secret hoga
        const decodedToken=jwt.verify(token,process.env.ACCESS_TOKEN_SECRET)
    
        const user=await User.findById(decodedToken?._id).select("-password -refreshToken")
        if(!user){
            
            throw new ApiError(401,"Invalid Access Token")
        }
    
        //agr user h to req k andr ek naya obj add kr do aur usme user ka access dedo
    
        req.user=user;
        next()
    } catch (error) {
        throw new ApiError(401,error?.message||"Invalid access token")
    }
    //middleware use routes me aate h
})