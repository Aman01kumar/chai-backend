import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.models.js"
import {uploadOnCloudinary, deleteFromCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import path from "path"
import jwt from "jsonwebtoken"

const generateAccessAndRefereshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new ApiError(404, "User not found"); // ✅ FIXED: Handle case where user is not found
        }

        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})

        return {accessToken, refreshToken}


    } catch (error) {
        throw new ApiError(500, "something went wrong while generating access and refresh token")
        
        
    }
}

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
      throw new ApiError(409, "user with email or username is already exists")
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
   const coverImage = coverImageLocalPath ? await uploadOnCloudinary(coverImageLocalPath) : null;

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
       throw new ApiError(500, "something went wrong while registering the user")
   }

   return res.status(201).json(
       new ApiResponse(200, createdUser, "user regiatered successfully")
   )

})

const loginUser = asyncHandler(async (req,res) => {
    // req body
    // email or username
    // find the user
    // check password
    // access and refresh token
    // send cokies

    const {email, username, password} = req.body

    if (!(username || email)) {
        throw new ApiError(400, "username or email is required")  
    }

    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if(!user){
        throw new ApiError(404, "user does not exists")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(! isPasswordValid){
        throw new ApiError(401, "Invalid user credentials ")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefereshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken

            },
            "User loggedIn successfully"
        )
    )
})

const logoutUser = asyncHandler( async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"))
})


const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401, "unauthorized request")
    }

    try {
        const decodeToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodeToken?._id)
    
        if(!user){
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh token is expired or used")
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, refreshToken: newRefreshToken} = await generateAccessAndRefereshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken: newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
        
    }


})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(401, "Invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "password changeed successfully"))
})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully"))
})

const updateAccountDetails = asyncHandler(async (req, res) => {
    const {fullName, email} = req.body

    if(!fullName || !email){
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName:fullName,
                email: email
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Account details updated successfully"))
})

const updateUserAvatar= asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(401, "Avatar file is missing")
    }

    const user = await User.findById(req.user?._id);
    if (!user) {
        throw new ApiError(404, "User not found"); // Added: Handle case where user doesn't exist
    }

    // Delete old avatar
    if (user.avatar) {
        await deleteFromCloudinary(user.avatar);
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar || !avatar.secure_url){
        throw new ApiError(500, "error while uploading an avatar")
    }

    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.secure_url
            }
        },
        {new: true}
    ).select("-password")

    return res.
    status(200)
    .json(
        new ApiResponse(200, updatedUser, "avatar updated successfully")
    )
})

const updateUserCoverImage= asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(401, "Cover image file is missing")
    }

    const user = await User.findById(req.user?._id); // Added: Fetching user before accessing user.coverImage
    if (!user) {
        throw new ApiError(404, "User not found"); // Added: Handle case where user doesn't exist
    }

    // Delete old coverImage
    if (user.coverImage) {
        await deleteFromCloudinary(user.coverImage);
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage||!coverImage.secure_url){
        throw new ApiError(500, "error while uploading a cover image")
    }

    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.secure_url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, updatedUser, "coverImage updated successfully")
    )

}) 

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const {username} = req.params

    if(!username?.trim()){
        throw new ApiError(401, "Username is missing")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404, "channel does not exists")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
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
        getUserChannelProfile
}

