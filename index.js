const express = require("express");
const env = require("dotenv");
const axios = require("axios");

const app = express();

env.config();
app.use(express.json());

const systemMessage = {
  role: "system",
  content:
    "Generate a short story(One or Two liner) based on the input\
    Don't use the input's name in the generated story's name\
    Make sure the generated story isn't on the same time and date\
    Make sure the generated story is in a different genre\
    Make sure the generated story is in a different timeline\
    Provide the output in a json format with Story name, description, date, time, place, coordinate",
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
        response: JSON.parse(response?.data?.choices?.[0]?.message?.content),
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
