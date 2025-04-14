import { asyncHandler } from "../../utils/asyncHandler.js";
import{ApiError} from "../../utils/ApiError.js"
import {User} from "../models/user.models.js"
import { uploadOnCloudinary } from "../../utils/cloudinary.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import jwt  from "jsonwebtoken";
import mongoose from "mongoose";

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
//new se new updated value aayegi
const logoutUser=asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset:{
                refreshToken:1 //this removes the field from document
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
    console.log(incomingRefreshToken);
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
            new ApiResponse(
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
    console.log('Old Password:', oldPassword);
console.log('Stored Password:', user.password);

    await user.save({validateBeforeSave:false})

    return res
    .status(200)
    .json(new ApiResponse(200,{},"Password changed successfully"))

})

//agr mujhe current user lena h to ek end point bnana padega jaha pr current user get kr paao
const getCurrentUser=asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(new ApiResponse(200,req.user,"current user fetched successfully"))
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

//jb hme kisi bhi channel ki profile chahie hoti h to ham us channel k url pr jate h eg /cac to hame user milega req.body se nhi req.params se mtlb ki uske url se
const getUserChannelProfile=asyncHandler(async(req,res)=>{
    const {username}=req.params

    if(!username?.trim()){
        throw new ApiError(400,"username is missing")
    }

    //isme problem ye h ki ham ek baar databse se user lenge pura -->User.find({username})-->phir uski id lgayenge ...isse acha ham direct aggregation pipeline le skte jisme match field hota to vo automatically sare docs me se ek doc find kr lega
    //aggregate pipeline likhne k baad o/p arrays aata h
    const channel=await User.aggregate([
        {
            $match:{
                username:username?.toLowerCase()
            }
        }
        //abhi yha pr hamne filter kr liya apna ek document
        //ab mere paas ek doc h bs ab us doc k basis pr mujhe krna h lookup-->ab cac k subscriber kitne h vo find krna h
        ,{
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"channel",
                as:"subscribers"
            }
        }
        //to ye ho gyi hmari first pipeline jaha hmne find kr liya h usk subscribers
        //ab maine kitne subscribe kiye h vo find krna h
        ,{
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"subscriber",
                as:"subscribedTo"
            }
        }
        //ab hmare paas ye dono field aa chuke h pr ye dono field alg alg h ...ab indono fields ko hame add bhi krna padega
        //isk lie ek aur pipeline ham likh skte h
        //isk lie ham addField use krenge--jo ki jitne fields h utne to rkhega hi rkhega plus ek additional field add kr dega
        ,{
            $addFields:{
                subscribersCount:{
                    $size:"$subscribers"
                },
                channelsSubscribedToCount:{
                    $size:"$subscribedTo"
                },
                //ab button ka sochenge ki subscribed dikhana h ya subscribe-->to ham frontend vale ko ek true or false msg bhej denge aur usk basis pr vo calculate kr lega ki true h to subscribed h nhi h to subscribe
                //mujhe ye dekhna h jo hmare pass document aaya h subscribers field usme mai hu ya nhi
                //in array aur obj dono me se dekh leta h
                isSubscribed:{
                    $cond:{
                        if:{$in:[req.user?._id,"$subscribers.subscriber"]},
                        then:true,
                        else:false
                    }


                }
            }
        },
        //ab mujhe ek aur pipeline use krni h jaha pr mujhe project use krna h
        //jo chiz k aage 1 likha h vhi vhi show krega
        {
            $project:{
                fullname:1,
                username:1,
                subscribersCount:1,
                channelsSubscribedToCount:1,
                isSubscribed:1,
                avatar:1,
                coverImage:1,
                email:1,

                

            }
        }
        
        
    ])
    console.log(channel);

    if(!channel?.length){
        throw new ApiError(404,"channel does dont exists")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,channel[0],"User channel fetched successfully")
    )
})

//ab hame user ki watch history chahie hamne jaise hi user liya req.user se id nikal kr match kr lenge
//watchHistory lane k lie mujhe join krna padega
//wH hmare pas ek array tha usme hm sare videos k id store kr rhe the,..to hmare paas boht saari id bole to boht sare docs mil jayenge ...lekin ek lookup se boht sare docs  mil gye lekin yha pr owner bhi to h vo bhi to chahie hoga ...owner bhi user h...ek aur lookup krna hoga jo ki nested lookup hoga...wH se jaise hi join krenge hmare paas multiple docs mil jayenge videos k pr usme owner hoga hi nhi to jaise hi hme voi doc mila turant ek aur join krna padega ....hr ek doc k andr ek aur join hoga
//nested lookup me kya hoga owner se jao user k paas aur uski info jo jo chahie lekr aayenge aur populate kr lenge

const getWatchHistory=asyncHandler(async(req,res)=>{
    //mongo db ki id string me milti h jo ki actually me id nhi h ..mongoose k andr internally id ko mongo db ki id me convert kr deta..req.user._id
    //aggregation pipelines me mongoose kaam nhi krta h uska code directly hi jata h to hme id ko convert krne ki jrurt h
    const user=await User.aggregate([
        {
            $match:{
                _id:new mongoose.Types.ObjectId(req.user._id)
            }
            //ab hme user mil gya h ab uski watch history k andr jana padega lookup krna padega
            
        },{
            $lookup:{
                from:"videos",
                localField:"watchHistory",
                foreignField:"_id",
                as:"watchHistory",
                pipeline:[
                    {
                        $lookup:{
                            from:"users",
                            localField:"owner",
                                foreignField:"_id",
                                as:"owner",
                                //abhi hmare paas arrays k andr boht sari multiple values aayi h ...to hm ek sub pipline lgayenge jisse owner k andr jo hme chahie vhi aaye
                                pipeline:[
                                    {
                                        $project:{
                                            fullname:1,
                                            username:1,
                                            avatar:1
                                        }
                                    }
                                    ,
                                    //ab mai array ko sudharna chahti hu
                                    {
                                        $addFields:{
                                            owner:{
                                                $first:"$owner"
                                            }
                                        }
                                        //sidhe hi owner ka first element mil jayega
                                    }

                                ]
                        }
                    }
                ]
            }
        }
        //ab ham us situation pr pahuch gye h jaha pr hmare paas me boht sare videos doc k form me aa gye...ab ek sub pipeline lhgane padenge..isme hr lookup k sath pipeline lgao
        
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(200,user[0].watchHistory,"Watch history fetched successfully")
    )
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
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}

