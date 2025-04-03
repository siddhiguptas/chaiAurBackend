import { asyncHandler } from "../../utils/asyncHandler.js";
import{ApiError} from "../../utils/ApiError.js"
import {User} from "../models/user.models.js"
import { uploadOnCloudinary } from "../../utils/cloudinary.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { jwt } from "jsonwebtoken";

const generateAccessAndRefreshTokens=async(userId)=>{
    try{
        const user=await User.findById(userId)
        const accessToken=user.generateAccessToken()
        const refreshToken=user.generateRefreshToken()
        //refToken kouser ko dene k sath sath database me bhi daalte h
        user.refreshToken=refreshToken
        //bina kuch change kiye hi save kr do
        await user.save({validateBeforeSave:false})

        return {accessToken,refreshToken}
    }catch(error){
        throw new ApiError(500,"Something went wrong while generating refresh and access token")
    }
}


const registerUser=asyncHandler(async(req,res)=>{
    //get user details from frontend
    //validation-not empty
    //check if user already exists:email,username
    //check for images, check for avatar
    //upload them to cloudinary
    //create user object-create entry in db
    //remove pass and refresh token field from response
    //check for user creation
    //return yes

    const {fullname,email,username,password}=req.body
    //console.log("email:",email);

    if([fullname,email,username,password].some((field)=>field?.trim()==="")){
        throw new ApiError(400,"All fields are required")
    }

    const existedUser= await User.findOne({
        $or:[{username},{email}]
    })

    if(existedUser){
        throw new ApiError(409,"User with email or username already exists");
    }
    

    const avatarLocalPath=req.files?.avatar[0]?.path;
    
    const coverImageLocalPath=req.files?.coverImage[0]?.path;
    /*let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
        coverImageLocalPath=req.files.coverImage[0].path
    }
        */

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required")
    }

    const avatar=await uploadOnCloudinary(avatarLocalPath)
    const coverImage=await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400,"Avatar file is required")
    }

    const user=await User.create({
        fullname,
        avatar:avatar.url,
        coverImage:coverImage?.url||"",
        email,
        password,
        username:username.toLowerCase()
    })

    const createdUser=await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200,createdUser,"User registered successfully")
    )

})
const loginUser=asyncHandler(async(req,res)=>{
    //req body->data nikalvayenge
    //username or email enter krayenge
    //find the user (check krenge is username ya email ka user exist bhi krta h ya nhi)
    //password check
    //access and refresh token generate karayenge
    //send cookie
    
    const {email,username,password}=req.body
    //console.log(email)
    //agar dono me se ek bhi nhi h to error
    if (!(username || email)){
        throw new ApiError(400,"username or email is required")
    }
    //findOne jaise hi pehla use matching entry mil jayegi vo return kr dega
    //hame krna h ya to email dhund do ya to username dhund do to we make use of $or,,isk andr array k andr obj pass kr skte h ...ye find krega ya to username k basis pr mil jaye ya email
    //console.log(await User.find());
    const user = await User.findOne({
        $or: [{ username: username }, { email: email }]
    });
    
    if(!user){
        throw new ApiError(404,"User does not exist")
    }
    //agr user mil gya to password check...use isPasscorrect by using bcrypt
    //User tb use krte jb mongoose k fn use krne jaise findOne etc
    //user.isPasswordCorrect(password) ye pass hmne req.body se nikala
    const isPasswordValid=await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiError(401,"Invalid user credentials")
    }
    //agr user ka pass thik h to access and refresh token bnao...ye boht baar krna padega to ise ek method me daal dete h..jb bhi krna ho to vo method call kr lo
    const {accessToken,refreshToken}=await generateAccessAndRefreshTokens(user._id)

    
    //user ko hme kya kya info bhejni h...we dont want to send some unwantef=d fields which we got in user like we dont want to send pass to  user...aur pehle rt aur access token khali tha to sbse acha vapas se databse se user le lo
    //.select---jo jo field nhi chahiye use mna kr do
    const loggedInUser=await User.findById(user._id).select("-password -refreshToken")

    //ab ise cookies me bhejenge-kiski cookie me bhejenge kaise bhejenge
    //jb cookies bhejte h to kuch options decide krne hote h
    //isse hmari cookies ko koi bhi modify nhi kr payega frontend pr...ab sirf server se modifiable hogi
    const options={
        httpOnly:true,
        secure:true
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {user:loggedInUser,accessToken,refreshToken},
            "User logged in successfully"
        )
    )
})
//cookie vagairah dlt krni padegi,access refresh token gayab krne padenge logout k lie
//middleware-jane se pehle mil kr jaiega
//ham khud ka middleware  design krenge
//set kya kya update krna h vo krdega
//new se new updated valiue aayegi
const logoutUser=asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken:undefined
            }
        },
        {
            new:true
        }
    )

    const options={
        httpOnly:true,
        secure:true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User logged out"))
})

//access token aur refresh token ka bs itna sa kaam h ki user ko baar baar apna emai aur username na dena pade 
//hame ek endpoint bnana h jaha pr hit hote hi user apna token refresh kara paye
//refresh karane k lie refresh token bhejna hi padega jo ki cookies se access kr skte
const refreshAccessToken=asyncHandler(async(req,res)=>{
    const incomingRefreshToken=req.cookies.refreshToken||req.body.refreshToken;
    if(!incomingRefreshToken){
        throw new ApiError(401,"Unauthorised request")
    }
    //ab verify kraenge incoming token ko jwt se
    try {
        const decodedToken=jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
        const user=await User.findById(decodedToken?._id);
        if(!user){
            throw new ApiError(401,"Invalid refresh token")
        }
        //hmare paas 2 token aya h ek to incomingRefreshToken (jo user hme bhej rha) aur hmne jo user find kiya usk paas bhi token hoga dono ko match krao
    
        if(incomingRefreshToken!=user?.refreshToken){
            throw new ApiError(401,"Refresh token is expired or used")
        }
    
        //agr dono match krte h to naya generate krk dedo denerateaccessand refresh token method se
        const options={
            httpOnly:true,
            secure:true
        }
        const {accessToken,newRefreshToken}=await generateAccessAndRefreshTokens(user._id)
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newRefreshToken,options)
        .json(
            new ApiError(
                200,
                {accessToken,refreshToken:newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401,error?.message||"Invalid refresh token")
    }
})

//kuch basic activities jo hme krni hi hoti h jb hm user bnate h
//user se pass change krate time ye dekhne k lie ki user already logged in h ya nhi ,cookies h ya nhi ye check krne k lie to jb route bnayenge to middleware use krlenge jwt
//user se pass change krate time kya kya field chahie,old,new
//user chahie tbhi to field me jakar pass verify krva paunga
//agr vo pass change kjr pa rha--logged in h--middleware lga h to loggedin ho paya
//middleware req.user k andr user h to vaha se id nikalo
const changeCurrentPassword=asyncHandler(async(req,res)=>{
    const {oldPassword,newPassword}=req.body
    const user=await User.findById(req.user?._id)
    const isPasswordCorrect=await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400,"Invalid old password")
    }

    user.password=newPassword
    await user.save({validateBeforeSave:false})

    return res
    .status(200)
    .json(new ApiResponse(200,{},"Password changed successfully"))

})

//agr mujhe current user lena h to ek end point bnana padega jaha pr current user get kr paao
const getCurrentUser=asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(200,req.user,"current user fetched successfully")
})

//agr koi file update kra rhe to alg end points rkha jata h..better approach..user sirf apni image update krna chahta to usko vhi ki vhi update aur save option de do end pt hit kr do
//pura user vapas se save krte to text data bhi baar baar jaata h to aisa na kro
const updateAccountDetails=asyncHandler(async(req,res)=>{
    const {fullname,email}=req.body
    if(!fullname||!email){
        throw new ApiError(400,"All fields are required")
    }

    const user=await User.findByIdAndUpdate(req.user?._id,
        {
            $set:{
                fullname,
                email
            }
        },
        {new:true}
    ).select("-password")

    return res 
    .status(200)
    .json(new ApiResponse(200,user,"Account details updated successfully"));
})

//to update files--first middleware multer lgana padega taki files accept kr paao secound auth middleware taki vahi update kr paye jo loggedin h
//jb bhi hame multer middleware inject krna h hame file option mil jaega vaha
//yha sirf ek file leni h to req.file na ki files
const updateUserAvatar=asyncHandler(async(req,res)=>{
    const avatarLocalPath=req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is missing")
    }

    const avatar=await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400,"Error while uploading on avatar")
    }

    //ab hme krna h update
    const user=await User.findByIdAndUpdate(req.user?._id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200,user,"Avatar updated successfully"))



})

const updateUserCoverImage=asyncHandler(async(req,res)=>{
    const coverImageLocalPath=req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400,"Cover image file is missing")
    }

    const coverImage=await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400,"Error while uploading on coverImage")
    }

    //ab hme krna h update
    const user=await User.findByIdAndUpdate(req.user?._id,
        {
            $set:{
                coverImage:coverImage.url
            }
        },
        {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200,user,"Cover image updated successfully"))


})
export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage
}

