//subscription me ek channel hota h aur us channel k boht sare subscribers hote h
// //channel bhi ek trh ka user hi h tbhi to mai comment vagairah kr pata hu
//subscribers bhi user hi h
//ab in users ko bs alg jgh rkha jata h taki inki id vagairah match kr le

import mongoose, {Schema} from "mongoose"


const subscriptionsSchema=new Schema({
    subscriber:{
        type:Schema.Types.ObjectId, //one who is subscribing
        ref:"User"
    },
    channel:{
        type:Schema.Types.ObjectId, //one to whom subscriber is subscribing
        ref:"User"

    }

},{timestamps:true})
export const Subscriptions=mongoose.model("Subscriptions",subscriptionsSchema)