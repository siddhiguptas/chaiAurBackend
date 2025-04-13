//subscription me ek channel hota h aur us channel k boht sare subscribers hote h
// //channel bhi ek trh ka user hi h tbhi to mai comment vagairah kr pata hu
//subscribers bhi user hi h
//ab in users ko bs alg jgh rkha jata h taki inki id vagairah match kr le
//channels me dikhai deta no. of subscribers and whether user pg is subscribed or not

//mujhe ab aisa controller bnana h jo mujhe user ki profile vapas de(get userchannelprofile)-coverimage,profileimage,avatar,username,fullname,no. of channels subscribed by users,and subscribers of user,jo nye h unko subscribe button show krta
//hm aisa bhi kr skte the ki user k andr subscriber ka ek array bna lete aur usme sbki id add kr dete
//but logo k million subscribers bhi hote h...to million me se bich me ek value dlt krni pad jati tooo...
//is schema me 2 chize h subscriber aur channel
//dono h to user hi
//yha pr array kyu nhi h vo smjhna padega
//subscribers
//channels
//User-a,b,c,d,e
//Channel-chaiAurCode,hiteshChaudaryChannel,freeCodeCamp--hai to ye bhi user hi
//jb bhi doc bnta to usme 2 value hogi subs,channel
//ek user h a usne ek channel subscribe kiya  to doc me aisa hoga....doc5-ch-CAC,subs-a
//doc-4-user b--ch-CAC,subs-B
//c ne tin channels ko subscribe kr rkhe h to 3 documents bne
//doc1-User c--ch-CAC,subs-C
//doc2-ch-hcc,subs-c((subs-kisne subscribe kiya h))
//doc3-ch-fcc,subs-c
//ab hame kisi channel(CAC) k subscribers pta krne h to ham un sare docs ko select krenge jisme channel CAC hoga aur unhe count krenge uska count=no. of subscriber of that channel
//ab hame pta krna h ki hamne kin channels ko subscribe kr rkha h --to subscriber ki value c ko dhundo us doc me jitne alg alg channel h unhe count kr lo
 //jaise hi ham channel ko subscribe krenge ek doc create hoga..jaise hi channel kisi ko subscribe krta h tb bhi ek naya doc create hota h


//aggregation pipelines-
//ham subscriptions ko join krenge users k andr isko hi bola jata h left join --subscription sw jitni info milti h usko join kr do user k andr
//aggregation stages hoti h aur hamne agr kisi bhi stage pr filtering lga di ki hame 100 nhi 50 hhi doc select krk do to next stage me 50 doc hi original dataset h
//db.users.aggregate --usk andr array -array k andr hr ek obj ek stage hota h
//[
//{ $lookup:{from:"authors",localField:"author_id",foreignField:"_id",as:"test"}},  return value ek array aayega jiska name test hoga aur us array k andr ek object milega 0th idx pr 
//ab ek aur pipeline add kr skte h addFields naam se ..jo ki kya krta h naye fields add krta h
// //{$addFields:{author_details:{$first:"$author_details" ya fir aise de skte $arrayElemAt:["$author_details",0](is field me se lekr aao 0th idx vali value)}
//}}
//]
//$project-hmaRE doc me boht sare fields h...ab aap jo jo field bologe vhi mai add krunga

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