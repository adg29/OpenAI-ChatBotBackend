const express = require("express");
const env = require("dotenv");
const axios = require("axios");

const app = express();

env.config();
app.use(express.json());

const systemMessage = {
  role: "system",
  content:
    "Create a Limerick with an unsettling tone\
    The output will contain a Name, Limerick and two Timelines\
    Representation of a Timeline is Date, Time, Place, and the Place’s Coordinates,\
    Make sure the whole Timeline is only one string,\
    Make sure the Coordinates are in the decimal degrees format,\
    Make sure the Date is in the format of YYYY-MM-DD,\
    Format the output as a JSON object where the key value pair is as follows:\
    1 for Name, 2 for Limerick, 3 for first Timeline, 4 for second Timeline",
  // "Create a limerick with an unsettling tone\
  //  Provide the output in a JSON format with Limerick as the key",
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
