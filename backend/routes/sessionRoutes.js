const express = require("express");
const router = express.Router();
const {
  createSession,
  getAllSessions,
} = require("../controllers/sessionController");
const protect = require("../middleware/authMiddleware");

router.post("/", protect, createSession);
router.get("/", protect, getAllSessions);

module.exports = router;