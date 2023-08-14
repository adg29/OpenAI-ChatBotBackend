const authMiddleware = require('../middleware/authMiddleware');
const ChatService = require("../services/chatService");
const express = require('express');

const router = express.Router();


router.post('/', authMiddleware, async (req, res) => {
    const userMessage = req.body.message;
    try {
      const res = await ChatService.getChatResponse(userMessage);
      res.json({ 
        status: "Success",
        response: res,
       });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
});

module.exports = router;