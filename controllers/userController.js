const CallLog = require("../models/callLog");
const FriendRequest = require("../models/friendRequest");
const User = require("../models/user");
const catchAsync = require("../utils/catchAsync");
const filterObj = require("../utils/filterObj");

const { generateToken04 } = require("./zegoServerAssistant");

// Please change appID to your appId, appid is a number
// Example: 1234567890
const appID = parseInt(process.env.ZEGO_APP_ID); // type: number

// Please change serverSecret to your serverSecret, serverSecret is string
// Example：'sdfsdfsd323sdfsdf'
const serverSecret = process.env.ZEGO_SERVER_SECRET; // type: 32 byte length string

exports.getMe = catchAsync(async (req, res, next) => {
  res.status(200).json({
    status: "success",
    data: req.user,
  });
});

exports.updateMe = catchAsync(async (req, res, next) => {
  const filteredBody = filterObj(
    req.body,
    "firstName",
    "lastName",
    "about",
    "avatar"
  );

  const userDoc = await User.findByIdAndUpdate(req.user._id, filteredBody);

  res.status(200).json({
    status: "success",
    data: userDoc,
    message: "User Updated successfully",
  });
});

exports.getUsers = catchAsync(async (req, res, next) => {
  const all_users = await User.find({
    verified: true,
  }).select("firstName lastName _id");

  const this_user = req.user;

  // Fetch friend requests sent to and from the current user
  const receivedRequests = await FriendRequest.find({
    recipient: req.user._id,
  });
  const sentRequests = await FriendRequest.find({ sender: req.user._id });

  const requestSenders = receivedRequests.map((request) =>
    request.sender.toString()
  );
  const requestRecipients = sentRequests.map((request) =>
    request.recipient.toString()
  );

  const remaining_users = all_users.filter(
    (user) =>
      !this_user.friends.includes(user._id) &&
      user._id.toString() !== req.user._id.toString() &&
      !requestSenders.includes(user._id.toString()) && // Exclude users who have sent a friend request
      !requestRecipients.includes(user._id.toString()) // Exclude users to whom a friend request has been sent
  );

  res.status(200).json({
    status: "success",
    data: remaining_users,
    message: "Users found successfully!",
  });
});

exports.getAllVerifiedUsers = catchAsync(async (req, res, next) => {
  const all_users = await User.find({
    verified: true,
  }).select("firstName lastName _id");

  const remaining_users = all_users.filter(
    (user) => user._id.toString() !== req.user._id.toString()
  );

  res.status(200).json({
    status: "success",
    data: remaining_users,
    message: "Users found successfully!",
  });
});

exports.getRequests = catchAsync(async (req, res, next) => {
  const requests = await FriendRequest.find({ recipient: req.user._id })
    .populate("sender")
    .select("_id firstName lastName");

  res.status(200).json({
    status: "success",
    data: requests,
    message: "Requests found successfully!",
  });
});

exports.getFriends = catchAsync(async (req, res, next) => {
  const this_user = await User.findById(req.user._id).populate(
    "friends",
    "_id firstName lastName avatar"
  );
  res.status(200).json({
    status: "success",
    data: this_user.friends,
    message: "Friends found successfully!",
  });
});

/**
 * Authorization authentication token generation
 */

exports.generateZegoToken = catchAsync(async (req, res, next) => {
  try {
    const { userId, room_id } = req.body;

    const effectiveTimeInSeconds = 3600; //type: number; unit: s; token expiration time, unit: second
    const payloadObject = {
      room_id, // Please modify to the user's roomID
      // The token generated allows loginRoom (login room) action
      // The token generated in this example allows publishStream (push stream) action
      privilege: {
        1: 1, // loginRoom: 1 pass , 0 not pass
        2: 1, // publishStream: 1 pass , 0 not pass
      },
      stream_id_list: null,
    }; //
    // const payload = JSON.stringify(payloadObject);
    const payload = "";
    // Build token

    const token = generateToken04(
      appID, // APP ID NEEDS TO BE A NUMBER
      userId,
      serverSecret,
      effectiveTimeInSeconds,
      payload
    );
    res.status(200).json({
      status: "success",
      message: "Token generated successfully",
      token,
    });
  } catch (err) {
    console.log(err);
  }
});

exports.startAudioCall = catchAsync(async (req, res, next) => {
  const from = req.user._id;
  const to = req.body.id;

  const from_user = await User.findById(from);
  const to_user = await User.findById(to);

  // create a new call log document and send required data to client
  const new_call_log = await CallLog.create({
    callType: "audio",
    participants: [from, to],
    from,
    to,
    status: "Ongoing",
  });

  res.status(200).json({
    data: {
      from: to_user,
      roomID: new_call_log._id,
      streamID: to,
      userID: from,
      userName: `${from_user.firstName} ${from_user.lastName}`,
    },
  });
});

exports.startVideoCall = catchAsync(async (req, res, next) => {
  const from = req.user._id;
  const to = req.body.id;

  const from_user = await User.findById(from);
  const to_user = await User.findById(to);

  // create a new call videoCall Doc and send required data to client
  const new_call_log = await CallLog.create({
    callType: "video",
    participants: [from, to],
    from,
    to,
    status: "Ongoing",
  });

  res.status(200).json({
    data: {
      from: to_user,
      roomID: new_call_log._id,
      streamID: to,
      userID: from,
      userName: `${from_user.firstName} ${from_user.lastName}`,
    },
  });
});

exports.getCallLogs = catchAsync(async (req, res, next) => {
  const user_id = req.user._id;

  const call_logs = await CallLog.find({
    participants: user_id,
  }).populate("from to");

  const formatted_logs = call_logs.map((log) => {
    const other_user =
      log.from._id.toString() === user_id.toString() ? log.to : log.from;
    const missed = log.verdict !== "Accepted";
    const incoming = log.from._id.toString() !== user_id.toString();

    // Create a new Date object with IST (UTC+5:30) timezone offset
    const dateInUTC = new Date(log.startTime);
    const dateInIST = new Date(dateInUTC.getTime());
    const ISTTime = dateInIST.toLocaleTimeString("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
    });

    return {
      id: log._id,
      img: other_user.avatar,
      name: `${other_user.firstName} ${other_user.lastName}`,
      online: true,
      incoming,
      missed,
      callType: log.callType,
      time: ISTTime,
    };
  });

  res.status(200).json({
    status: "success",
    message: "Call Logs Found successfully!",
    data: formatted_logs,
  });
});
