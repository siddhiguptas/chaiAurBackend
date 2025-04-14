import {Router} from "express";
import { changeCurrentPassword, getCurrentUser, getUserChannelProfile, getWatchHistory, loginUser, logoutUser, refreshAccessToken, registerUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage } from "../controllers/user.controllers.js";
import {upload} from "../middlewares/multer.middlewares.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router=Router()

router.route("/register").post(
    upload.fields([
        {
            name:"avatar",
            maxCount:1
        },
        {
            name:"coverImage",
            maxCount:1
        }
    ]),
    registerUser
)
//agr is route pr aaye to post method run hona chahie aur loginUser method run krega
router.route("/login").post(loginUser)

//secured Routes
//verifyjwt ho jayega phir logout user call hoga islie verifyJWT me last me next() add kiya taki ye hone k baad next fn pr chla jaye
router.route("/logout").post(verifyJWT,logoutUser)

router.route("/refresh-token").post(refreshAccessToken)

router.route("/change-password").post(verifyJWT,changeCurrentPassword)

router.route("/current-user").get(verifyJWT,getCurrentUser)
//patch islie taki kuch chize hi update kare...post se sara ka sara update kr dega
router.route("/update-account").patch(verifyJWT,updateAccountDetails)

//pehle jwt hona chhahie kyuki pehle user loggedin ho tbhi hme file bheje..second middleware lgayenge upload multer ka
router.route("/avatar").patch(verifyJWT,upload.single("avatar"),updateUserAvatar)

router.route("/cover-image").patch(verifyJWT,upload.single("coverImage"),updateUserCoverImage)

//jb params me se lete ...:k baad milta h
router.route("/c/:username").get(verifyJWT,getUserChannelProfile)

router.route("/history").get(verifyJWT,getWatchHistory)
export default router;