const mongoose = require("mongoose");

const groupChatSchema = new mongoose.Schema({
  groupName: {
    type: String,
    required: true,
  },
  participants: [
    {
      type: mongoose.Schema.ObjectId,
      ref: "User",
    },
  ],
  messages: [
    {
      from: {
        type: mongoose.Schema.ObjectId,
        ref: "User",
      },
      fromName: {
        type: String,
      },
      fromImg: {
        type: String,
      },
      type: {
        type: String,
        enum: ["Text", "Media", "Document", "Link"],
      },
      created_at: {
        type: Date,
        default: Date.now(),
      },
      text: {
        type: String,
      },
      file: {
        type: String,
      },
    },
  ],
  avatar: {
    type: String,
  },
  lastMsgFrom: {
    type: String,
  },
  lastMsg: {
    type: String,
  },
  lastMsgTime: { type: String },
});

const GroupChat = new mongoose.model("GroupChat", groupChatSchema);

module.exports = GroupChat;
