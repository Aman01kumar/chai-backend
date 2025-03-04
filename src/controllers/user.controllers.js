import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.models.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"

const registerUser = asyncHandler( async (req,res) => {
    // get user details from frontend
    // validation-not empty
    // check if user already exists: username,email
    // check for images, check fro avatar
    // upload them to cloudinary, avatar uloaded or not
    // create user object - create entry in db
    // remove password and refresh token field from response
   // check for user creation
   // return response

   const { fullName, username, email, password } = req.body
   console.log("email:", email);

   if (
       [fullName, email, username, password].some((field) => field?.trim() === "")
   ) {
      throw new ApiError(400, "All fields are required")
   }

   const existedUser = User.findOne({
       $or: [{username}, {email}]
   })

   if(existedUser){
      throw new ApiError(409, "user with email or username is already exiss")
   }

   const avatarLocalPath = req.files?.avatar[0]?.path;
   const coverImageLocalPath = req.files?.coverImage[0]?.path

   if(!avatarLocalPth){
      throw new ApiError(400, "Avatar file is required ")
   }

   const avatar = await uploadOnCloudinary(avatarLocalPath)
   const coverImage = await uploadOnCloudinary(coverImageLocalPath)

   if(!avatar){
      throw new ApiError(400, "Avatar file is required")
   }

    const user = await User.create({
       fullName,
       avatar: avatar.url,
       coverImage: coverImage?.url || "",
       email,
       password,
       username: username.toLowerCase()
   })

   const createdUser = await User.findByID(user._id).select(
       "-password -refreshToken"
   )

   if(!createdUser){
       throw new ApiError(500, "somethind went wrong while registering the user")
   }

   return res.status(201).json(
       new ApiResponse(200, createdUser, "user regiatered successfully")
   )

})


export {registerUser}