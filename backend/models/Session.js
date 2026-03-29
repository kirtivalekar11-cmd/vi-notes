const mongoose = require("mongoose");

const SessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      default: "",
    },
    log: {
      type: Array,
      default: [],
    },
    pauses: {
      type: Array,
      default: [],
    },
    suspicious: {
      type: Array,
      default: [],
    },
    score: {
      type: Number,
      default: 0,
    },
    wpm: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Session", SessionSchema);