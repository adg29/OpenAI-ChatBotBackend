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
    'You are a narrative designer who designs Mise-en-scène and Limerick,\
    Make sure to generate the Limerick in unsettling tone,\
    The output will contain a Name, Limerick and Description\
    The Name should be a title of the limerick that describes what takes place in the limerick\
    Provide the output in JSON structure like this {"1": "<The name>", "2": "<The Limerick>", "3": "<The Mise-en-scène>"}',
};

app.post("/api/chat", async (req, res) => {
  const userMessage = req.body.message;

  const apiMessages = [{ role: "user", content: userMessage }];

  const requestData = {
    model: "gpt-4-1106-preview",
    response_format: { type: "json_object" },
    messages: [systemMessage, ...apiMessages],
  };

  try {
    const response = await openai.chat.completions.create(requestData);
    console.log("OpenAI API Call", response);
    const choices = response.choices;
    if (response && response.choices && response.choices.length > 0) {
      const content = JSON.parse(choices[0].message.content) || {};
      console.log(content);
    }

    res.status(200).json(content);
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
