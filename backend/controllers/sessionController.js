const Session = require("../models/Session");

const createSession = async (req, res) => {
  try {
    const { text, log, pauses, suspicious, score, wpm } = req.body;

    const session = await Session.create({
      user: req.user.userId,
      text,
      log,
      pauses,
      suspicious,
      score,
      wpm,
    });

    res.status(201).json({
      message: "Session saved successfully",
      session,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to save session",
      error: error.message,
    });
  }
};

const getAllSessions = async (req, res) => {
  try {
    const sessions = await Session.find({ user: req.user.userId }).sort({
      createdAt: -1,
    });

    res.status(200).json(sessions);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch sessions",
      error: error.message,
    });
  }
};

module.exports = {
  createSession,
  getAllSessions,
};