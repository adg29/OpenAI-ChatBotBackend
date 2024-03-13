const express = require("express");
const env = require("dotenv");
const { default: OpenAI } = require("openai");

const app = express();
env.config();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const systemMessage = {
  role: "system",
  content:
    'You are a narrative designer who crafts a Mise-en-scène story and a rhyming riddle with a whimsical flair,\
    Ensure the story is succinct yet captivating, akin to a tweet-length narrative,\
    The riddle should follow the structure of a limerick and be no more than 60 words,\
    Assign a catchy name to this creation,\
    Format the output as a JSON structure resembling: {"1": "<name>", "2": "<limerick>", "3": "<story>"}',
};

app.post("/api/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    const apiMessages = [{ role: "user", content: userMessage }];

    const requestData = {
      model: "gpt-4-1106-preview",
      response_format: { type: "json_object" },
      messages: [systemMessage, ...apiMessages],
    };

    const response = await openai.chat.completions.create(requestData);
    console.log("OpenAI API Call", response);

    if (response && response.choices && response.choices.length > 0) {
      const content = JSON.parse(response.choices[0].message.content) || {};
      // Remove newline characters and format the output
      const formattedContent = {};
      Object.keys(content).forEach((key) => {
        formattedContent[key] = content[key].replace(/\n/g, " ");
      });
      res.status(200).json(formattedContent);
    } else {
      throw new Error("No valid response from OpenAI.");
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
const startServer = () => {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
};

startServer();
