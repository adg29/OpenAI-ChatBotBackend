const express = require("express");
const env = require("dotenv");
const axios = require("axios");

const app = express();

env.config();
app.use(express.json());

const systemMessage = {
  role: "system",
  content:
    "You are a narrative designer who designs unique role based on Club details and User's interest,\
    These roles are defined with a name, attractive description which is assigned to a user.",
  response_format: { type: "json_object" }, // Added response_format for JSON mode
};

// API endpoint to receive user messages and get Chatbot responses
app.post("/api/chat", async (req, res) => {
  const userMessage = req.body.message;

  const apiUrl = "https://api.openai.com/v1/chat/completions";
  const bearerToken = process.env.API_KEY;

  const headers = {
    Authorization: `Bearer ${bearerToken}`,
    "Content-Type": "application/json",
  };

  const apiMessages = [{ role: "user", content: userMessage }];

  const requestData = {
    model: "gpt-4-1106-preview", // Updated model to GPT-4 Turbo
    messages: [systemMessage, ...apiMessages],
  };

  try {
    const response = await axios.post(apiUrl, requestData, { headers });
    const content = response?.data?.choices?.[0]?.message?.content;
    const finishReason = response?.data?.choices?.[0]?.finish_reason;

    if (finishReason === "length") {
      return res.status(200).json({
        status: "Partial",
        response:
          "Output exceeded token limit or conversation exceeded token limit.",
      });
    }

    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
      // Handle parsed JSON content here
      res.status(200).json({
        status: "Success",
        response: parsedContent,
      });
    } catch (err) {
      console.error("Error in JSON parsing: ", err.message);
      res.status(500).json({
        status: "Failed",
        error: "Error in JSON parsing",
      });
    }
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({
      status: "Failed",
      error: error.message,
    });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
