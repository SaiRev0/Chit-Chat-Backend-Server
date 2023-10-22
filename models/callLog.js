const mongoose = require("mongoose");

const callLogSchema = new mongoose.Schema({
  callType: {
    type: String,
    enum: ["audio", "video"],
    required: true,
  },
  participants: [
    {
      type: mongoose.Schema.ObjectId,
      ref: "User",
    },
  ],
  from: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
  },
  to: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
  },
  startTime: {
    type: Date,
    default: Date.now,
  },
  endTime: Date,
  status: {
    type: String,
    enum: ["Ongoing", "Ended"],
    default: "Ended",
  },
  verdict: {
    type: String,
    enum: ["Accepted", "Denied", "Missed", "Busy"],
  },
});

const CallLog = mongoose.model("CallLog", callLogSchema);

module.exports = CallLog;
