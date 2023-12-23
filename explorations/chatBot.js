const express = require("express");
const env = require("dotenv");
const { default: OpenAI } = require("openai");

const app = express();

env.config();
app.use(express.json());

const openai = new OpenAI();

const systemMessage = {
  role: "system",
  content:
    "You are a narrative designer who designs unique role based on Club details and User's interest,\
     These roles are defined with a name, attractive description which is assigned to a user.",
};

app.post("/api/chat", async (req, res) => {
  const userMessage = req.body.message;

  const bearerToken = process.env.OPENAI_API_KEY;

  const headers = {
    Authorization: `Bearer ${bearerToken}`,
    "Content-Type": "application/json",
  };

  const apiMessages = [{ role: "user", content: userMessage }];

  const requestData = {
    model: "gpt-4-1106-preview",
    response_format: { type: "json_object" },
    messages: [systemMessage, ...apiMessages],
  };

  try {
    const response = await openai.chat.completions.create(requestData);
    let content = response.choices[0].message.content;

    let parsedContent = JSON.parse(content);

    console.log("Received content:", parsedContent);

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
