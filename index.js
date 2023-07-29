const express = require("express");
const axios = require("axios");
const env = require("dotenv");

const app = express();

env.config();
app.use(express.json());

const systemMessage = {
  role: "system",
  content:
    "Pick the place from the coordinate\
    Generate a short story(One or Two liner) connected to this place time combinations\
    Don't use the coordinate in the stories rather the place",
  // Select between 20% and 80% of these hashtags as thematic influence on the story and disregard the other hashtags\
  // Make the story dystopian or romantic or mysterious\
  // Keep the story short in one or two line\
  // Allow the story to take place in the past or future, hypothetical or real\
  // Create a prompt(that can be used for a text-to-art AI) from the created story",
};

// API endpoint to receive user messages and get Chatbot responses
app.post("/api/chat", async (req, res) => {
  const userMessage = req.body.message;

  const apiUrl = "https://api.openai.com/v1/chat/completions";
  const bearerToken = process.env.API_KEY;

  const headers = {
    Authorization: `Bearer ${bearerToken}`,
    "Content-Type": "application/json", // Replace with the appropriate content type
  };

  const apiMessages = [{ role: "user", content: userMessage }];

  const requestData = {
    model: "gpt-3.5-turbo",
    messages: [
      systemMessage, // The system message DEFINES the logic of our chatGPT
      ...apiMessages, // The messages from our chat with ChatGPT
    ],
  };

  axios
    .post(apiUrl, requestData, { headers })
    .then((response) => {
      // Handle the response data
      res.json({
        status: "Success",
        response: response?.data?.choices?.[0]?.message?.content,
      });
    })
    .catch((error) => {
      // Handle errors
      console.error("Error:", error.message);
    });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
