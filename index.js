const express = require("express");
const env = require("dotenv");
const axios = require("axios");

const app = express();

env.config();
app.use(express.json());

const systemMessage = {
  role: "system",
  content:
    "Create a brief initial piece of a narrative(one liner) based on the USER message in a different TME, different GNRE, and different PLCE\
    TME should vary from past to future related to USER message timeline\
    GNRE can vary from Fantasy, Science Fiction, Adventure, Romance, True Crime or a hybrid of two of those\
    PLCE uses the location of the latitude and longitude\
    Add one weird or dramatic question(one liner) to continue the story with two options\
    Provide the output in a json format, Name: , Description: , Date: , Time: , Place: , Co-ordinate: , Question (Option 1: Option 2:)\
    Only provide the description the first time",
};

// const systemMessage = {
//   role: "system",
//   content:
//     "Generate a short story(One or Two liner) based on the input in a different timeline\
//     Don't use the input's name in the generated story's name\
//     Make sure the generated story is in a different genre\
//     Provide the output in a json format with Story name, description, date, time, place, coordinate",
// };

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
