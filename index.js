const express = require("express");
const env = require("dotenv");
const axios = require("axios");

const app = express();

env.config();
app.use(express.json());

const systemMessage = {
  role: "system",
  content:
    "Process the input considering it comprises of users' moments with attributes like name, description\
    Your task is to create a limerick based on these moments, but ensure it carries an unsettling tone\
    Your output should be formatted in a JSON structure with properties named 'Name', 'Description', 'Date', 'Time', 'Place', and 'Coordinates'\
    The generated limerick should be included as the value for the 'description' key in the output JSON\
    The presentation of the coordinates should be in the decimal degrees format, for ex lat,long\
    Ensure correct punctuation and syntax of the JSON output so there is no unexpected token present at any position",
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
    model: "gpt-4",
    messages: [
      systemMessage, // The system message DEFINES the logic of our chatGPT
      ...apiMessages, // The messages from our chat with ChatGPT
    ],
  };

  axios
    .post(apiUrl, requestData, { headers })
    .then((response) => {
      const content = response?.data?.choices?.[0]?.message?.content;
      const cleanedContent = content
        .replace(/[\n\r]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      let parsedContent;
      try {
        parsedContent = JSON.parse(cleanedContent);
        for (const key in parsedContent) {
          if (typeof parsedContent[key] === "string") {
            parsedContent[key] = parsedContent[key]
              .replace(/\n/g, " ")
              .replace(/\s+/g, " ")
              .trim();
          }
        }
      } catch (err) {
        console.error("Error in JSON parsing: ", err.message);
        return res.status(500).json({
          status: "Failed",
          error: "Error in JSON parsing",
        });
      }
      // Handle the response data
      res.status(200).json({
        status: "Success",
        response: parsedContent,
      });
    })
    .catch((error) => {
      // Handle errors
      console.error("Error:", error.message);
      res.status(500).json({
        status: "Failed",
        error: error.message,
      });
    });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
