import {Router} from "express";
import { loginUser, logoutUser, registerUser } from "../controllers/user.controllers.js";
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

export default router;