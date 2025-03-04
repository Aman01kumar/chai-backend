import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.models.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import path from "path"

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

   if (
       [fullName, email, username, password].some((field) => field?.trim() === "")
   ) {
      throw new ApiError(400, "All fields are required");
   }

   const existedUser = await User.findOne({
       $or: [{username}, {email}]
    });

   if(existedUser){
      throw new ApiError(409, "user with email or username is already exiss")
   }

   //console.log("Uploaded files:", req.files);
   

   const avatarLocalPath = req.files?.avatar[0]?.path || null;
   //const coverImageLocalPath = req.files?.coverImage[0]?.path || null;
   let coverImageLocalPath;
   if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
    coverImageLocalPath = req.files.coverImage[0].path
   }

   //console.log("Resolved Avatar Path:", avatarLocalPath);


   if(!avatarLocalPath){
      throw new ApiError(400, "Avatar file is required ")
   }

   const avatar = await uploadOnCloudinary(avatarLocalPath);
   const coverImage = await uploadOnCloudinary(coverImageLocalPath);

   if(!avatar || !avatar.secure_url){
      throw new ApiError(400, "Avatar file is required in cloudinary");
   }

    const user = await User.create({
       fullName,
       avatar: avatar.secure_url,
       coverImage: coverImage?.secure_url || "",
       email,
       password,
       username: username.toLowerCase()
   })

   const createdUser = await User.findById(user._id).select(
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

