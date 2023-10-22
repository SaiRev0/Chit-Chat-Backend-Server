const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config({ path: "./.env" });

process.on("uncaughtException", (err) => {
  console.log(err);
  console.log("UNCAUGHT Exception! Shutting down ...");
  process.exit(1);
});

const app = require("./app");
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const User = require("./models/user");
const FriendRequest = require("./models/friendRequest");
const OneToOneMessage = require("./models/OneToOneMessage");
const GroupChat = require("./models/GroupChat");
const CallLog = require("./models/callLog");

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const DB = process.env.DATABASE.replace(
  "<password>",
  process.env.DATABASE_PASSWORD
);

mongoose.set("strictQuery", true);
mongoose.connect(DB, {}).then((con) => {
  console.log("DB Connection successful");
});

const port = process.env.PORT || 8000;

server.listen(port, () => {
  console.log(`App running on port ${port} ...`);
});

io.on("connection", async (socket) => {
  console.log(JSON.stringify(socket.handshake.query));
  const user_id = socket.handshake.query["user_id"];

  console.log(`User connected ${socket.id}`);

  if (user_id != null && Boolean(user_id)) {
    try {
      await User.findByIdAndUpdate(user_id, {
        socket_id: socket.id,
        status: "Online",
      });
    } catch (e) {
      console.log(e);
    }
  }

  // We can write our socket event listeners in here...
  socket.on("friend_request", async (data) => {
    const to = await User.findById(data.to).select("socket_id");
    const from = await User.findById(data.from).select("socket_id");

    // create a friend request
    await FriendRequest.create({
      sender: data.from,
      recipient: data.to,
    });
    // emit event request received to recipient
    io.to(to?.socket_id).emit("new_friend_request", {
      message: "New friend request received",
    });
    io.to(from?.socket_id).emit("request_sent", {
      message: "Request Sent successfully!",
    });
  });

  socket.on("accept_request", async (data) => {
    // accept friend request => add ref of each other in friends array
    const request_doc = await FriendRequest.findById(data.request_id);

    const sender = await User.findById(request_doc.sender);
    const receiver = await User.findById(request_doc.recipient);

    sender.friends.push(request_doc.recipient);
    receiver.friends.push(request_doc.sender);

    await receiver.save({ new: true, validateModifiedOnly: true });
    await sender.save({ new: true, validateModifiedOnly: true });

    await FriendRequest.findByIdAndDelete(data.request_id);

    // delete this request doc
    // emit event to both of them

    // emit event request accepted to both
    io.to(sender?.socket_id).emit("request_accepted", {
      message: "Friend Request Accepted",
    });
    io.to(receiver?.socket_id).emit("request_accepted", {
      message: "Friend Request Accepted",
    });
  });

  socket.on("get_direct_conversations", async ({ user_id }, callback) => {
    const existing_conversations = await OneToOneMessage.find({
      participants: { $all: [user_id] },
    }).populate("participants", "firstName lastName avatar _id email status");

    callback(existing_conversations);
  });

  socket.on("get_group_conversations", async ({ user_id }, callback) => {
    const existing_group_conversations = await GroupChat.find({
      participants: { $all: [user_id] },
    }).populate("participants", "firstName lastName avatar _id email status");

    callback(existing_group_conversations);
  });

  socket.on("start_conversation", async (data) => {
    // data: {to: from:}

    const { to, from } = data;

    // check if there is any existing conversation

    const existing_conversations = await OneToOneMessage.find({
      participants: { $size: 2, $all: [to, from] },
    }).populate("participants", "firstName lastName _id email status");

    // if no => create a new OneToOneMessage doc & emit event "start_chat" & send conversation details as payload
    if (existing_conversations.length === 0) {
      let new_chat = await OneToOneMessage.create({
        participants: [to, from],
      });

      new_chat = await OneToOneMessage.findById(new_chat).populate(
        "participants",
        "firstName lastName _id email status"
      );

      socket.emit("start_chat", new_chat);
    }
    // if yes => just emit event "start_chat" & send conversation details as payload
    else {
      socket.emit("start_chat", existing_conversations[0]);
    }
  });

  socket.on("start_group", async (data) => {
    // data: {group_name: , participants: []}

    const { group_name, participants } = data;

    // create a new GroupChat doc & emit event "start_group_chat" & send group details as payload
    let new_group = await GroupChat.create({
      groupName: group_name,
      participants: participants,
      avatar: `https://ui-avatars.com/api/?rounded=true&format=svg&bold=true&name=${group_name}`,
    });

    new_group = await GroupChat.findById(new_group).populate(
      "participants",
      "firstName lastName _id email"
    );
    socket.emit("start_group_chat", new_group);
  });

  socket.on("get_messages", async (data, callback) => {
    try {
      const modelToUse =
        data.chat_type === "individual" ? OneToOneMessage : GroupChat;
      const { messages } = await modelToUse
        .findById(data.conversation_id)
        .select("messages");
      callback(messages);
    } catch (error) {
      console.log(error);
    }
  });

  // Handle incoming text/link messages
  socket.on("text_message", async (data) => {
    // data: {to, from, text}
    const { message, conversation_id, from, to, type } = data;

    const to_user = await User.findById(to);
    const from_user = await User.findById(from);

    // message => {to, from, type, created_at, text, file}

    const new_message = {
      to: to,
      from: from,
      fromName: `${from_user.firstName} ${from_user.lastName}`,
      fromImg: from_user.avatar,
      type: type,
      created_at: Date.now(),
      text: message,
    };

    // fetch OneToOneMessage Doc & push a new message to existing conversation
    const chat = await OneToOneMessage.findById(conversation_id);
    chat.messages.push(new_message);
    // save to db`
    const savedChat = await chat.save({
      new: true,
      validateModifiedOnly: true,
    });

    // Get the last message from the saved chat
    const savedMessage = savedChat.messages[savedChat.messages.length - 1];

    // Update the lastMsg, lastMsgFrom, and lastMsgTime fields
    savedChat.lastMsg = savedMessage.text;
    savedChat.lastMsgFrom = savedMessage.fromName;
    savedChat.lastMsgTime = savedMessage.created_at;
    await savedChat.save();

    // emit incoming_message -> to user
    io.to(to_user?.socket_id).emit("new_message", {
      chat_type: "individual",
      conversation_id,
      message: savedMessage,
    });

    // emit outgoing_message -> from user
    io.to(from_user?.socket_id).emit("new_message", {
      chat_type: "individual",
      conversation_id,
      message: savedMessage,
    });
  });

  // Handle incoming text/link group messages
  socket.on("group_message", async (data) => {
    // data: {group_id, from, text, type}

    const { message, group_id, from, type } = data;

    const from_user = await User.findById(from);

    const new_message = {
      from: from,
      fromName: `${from_user.firstName} ${from_user.lastName}`,
      fromImg: from_user.avatar,
      type: type,
      created_at: Date.now(),
      text: message,
    };

    // fetch GroupChat Doc & push a new message to existing conversation
    const chat = await GroupChat.findById(group_id);
    chat.messages.push(new_message);
    // save to db
    const savedChat = await chat.save({
      new: true,
      validateModifiedOnly: true,
    });

    // Get the last message from the saved chat
    const savedMessage = savedChat.messages[savedChat.messages.length - 1];

    // Update the lastMsg, lastMsgFrom, and lastMsgTime fields
    savedChat.lastMsg = savedMessage.text;
    savedChat.lastMsgFrom = savedMessage.fromName;
    savedChat.lastMsgTime = savedMessage.created_at;
    await savedChat.save();

    io.to(from_user?.socket_id).emit("new_message", {
      chat_type: "group",
      group_id,
      message: savedMessage,
    });

    chat.participants.forEach(async (participant) => {
      if (participant.valueOf() !== from) {
        let to_user = await User.findById(participant.valueOf());
        io.to(to_user?.socket_id).emit("new_message", {
          chat_type: "group",
          group_id,
          message: savedMessage,
        });
      }
    });
  });

  // -------------- HANDLE AUDIO CALL SOCKET EVENTS ----------------- //

  // handle start_audio_call event
  socket.on("start_audio_call", async (data) => {
    const { from, to, roomID } = data;

    const to_user = await User.findById(to);
    const from_user = await User.findById(from);

    // send notification to receiver of call
    io.to(to_user?.socket_id).emit("audio_call_notification", {
      from: from_user,
      roomID,
      streamID: from,
      userID: to,
      userName: to,
    });
  });

  // handle audio_call_not_picked
  socket.on("audio_call_not_picked", async (data) => {
    // find and update call record
    const { to, from } = data;

    const to_user = await User.findById(to);

    await CallLog.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
        callType: "audio",
      },
      { verdict: "Missed", status: "Ended", endedAt: Date.now() }
    );

    // TODO => emit call_missed to receiver of call
    io.to(to_user?.socket_id).emit("audio_call_missed", {
      from,
      to,
    });
  });

  // handle audio_call_accepted
  socket.on("audio_call_accepted", async (data) => {
    const { to, from } = data;

    const from_user = await User.findById(from);

    // find and update call record
    await CallLog.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
        callType: "audio",
      },
      { verdict: "Accepted" }
    );

    // TODO => emit call_accepted to sender of call
    io.to(from_user?.socket_id).emit("audio_call_accepted", {
      from,
      to,
    });
  });

  // handle audio_call_denied
  socket.on("audio_call_denied", async (data) => {
    // find and update call record
    const { to, from } = data;

    await CallLog.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
        callType: "audio",
      },
      { verdict: "Denied", status: "Ended", endedAt: Date.now() }
    );

    const from_user = await User.findById(from);
    // TODO => emit call_denied to sender of call

    io.to(from_user?.socket_id).emit("audio_call_denied", {
      from,
      to,
    });
  });

  // handle user_is_busy_audio_call
  socket.on("user_is_busy_audio_call", async (data) => {
    const { to, from } = data;
    // find and update call record
    await CallLog.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
        callType: "audio",
      },
      { verdict: "Busy", status: "Ended", endedAt: Date.now() }
    );

    const from_user = await User.findById(from);

    // TODO => emit on_another_audio_call to sender of call {Not Implemented on client side}
    io.to(from_user?.socket_id).emit("on_another_audio_call", {
      from,
      to,
    });
  });

  // --------------------- HANDLE VIDEO CALL SOCKET EVENTS ---------------------- //

  // handle start_video_call event
  socket.on("start_video_call", async (data) => {
    const { from, to, roomID } = data;

    const to_user = await User.findById(to);
    const from_user = await User.findById(from);

    // send notification to receiver of call
    io.to(to_user?.socket_id).emit("video_call_notification", {
      from: from_user,
      roomID,
      streamID: from,
      userID: to,
      userName: to,
    });
  });

  // handle video_call_not_picked
  socket.on("video_call_not_picked", async (data) => {
    // find and update call record
    const { to, from } = data;

    const to_user = await User.findById(to);

    await CallLog.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
        callType: "video",
      },
      { verdict: "Missed", status: "Ended", endedAt: Date.now() }
    );

    // TODO => emit call_missed to receiver of call
    io.to(to_user?.socket_id).emit("video_call_missed", {
      from,
      to,
    });
  });

  // handle video_call_accepted
  socket.on("video_call_accepted", async (data) => {
    const { to, from } = data;

    const from_user = await User.findById(from);

    // find and update call record
    await CallLog.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
        callType: "video",
      },
      { verdict: "Accepted" }
    );

    // TODO => emit call_accepted to sender of call
    io.to(from_user?.socket_id).emit("video_call_accepted", {
      from,
      to,
    });
  });

  // handle video_call_denied
  socket.on("video_call_denied", async (data) => {
    // find and update call record
    const { to, from } = data;

    await CallLog.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
        callType: "video",
      },
      { verdict: "Denied", status: "Ended", endedAt: Date.now() }
    );

    const from_user = await User.findById(from);
    // TODO => emit call_denied to sender of call

    io.to(from_user?.socket_id).emit("video_call_denied", {
      from,
      to,
    });
  });

  // handle user_is_busy_video_call
  socket.on("user_is_busy_video_call", async (data) => {
    const { to, from } = data;
    // find and update call record
    await CallLog.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
        callType: "video",
      },
      { verdict: "Busy", status: "Ended", endedAt: Date.now() }
    );

    const from_user = await User.findById(from);
    // TODO => emit on_another_video_call to sender of call
    io.to(from_user?.socket_id).emit("on_another_video_call", {
      from,
      to,
    });
  });

  // -------------- HANDLE SOCKET DISCONNECTION ----------------- //

  socket.on("end", async (data) => {
    // Find user by ID and set status as offline

    if (data.user_id) {
      await User.findByIdAndUpdate(data.user_id, { status: "Offline" });
    }

    // broadcast to all conversation rooms of this user that this user is offline (disconnected)

    console.log("closing connection");
    socket.disconnect(0);
  });
});

process.on("unhandledRejection", (err) => {
  console.log(err);
  console.log("UNHANDLED REJECTION! Shutting down ...");
  server.close(() => {
    process.exit(1);
  });
});
