import mongoose,{Schema} from "mongoose"
//saare comments to de nhi skte user ko..usko pagination krna padta h taki aur ya to load kra le comments ya next pg pr ho 
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2"

const commentSchema=new Schema(
    {
        content:{
            type:String,
            required:true
        },
        video:{
            type:Schema.Types.ObjectId,
            ref:"Video"
        },
        owner:{
            type:Schema.Types.ObjectId,
            ref:"User"
        }
    },
    {timestamps:true}
)

commentSchema.plugin(mongooseAggregatePaginate)

export const Comment=mongoose.model("Comment",commentSchema)