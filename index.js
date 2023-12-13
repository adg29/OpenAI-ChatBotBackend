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
    "Your task is to develop a Description of a story in the style of a Mise-en-scène and Limerick with an unsettling tone, \
    The output will contain a Name, Limerick and Description \
    The Name should be a funny title of the Limerick, \
    Format the output as a JSON object where the key value pair is as follows: \
    1 for Name, 2 for Limerick, 3 for Description",
};

app.post("/api/chat", async (req, res) => {
  const userMessage = req.body.message;

  // const apiUrl = "https://api.openai.com/v1/chat/completions";
  const bearerToken = process.env.OPENAI_API_KEY;

  const headers = {
    Authorization: `Bearer ${bearerToken}`,
    "Content-Type": "application/json",
  };

  const apiMessages = [{ role: "user", content: userMessage }];

  const requestData = {
    model: "gpt-4-1106-preview",
    messages: [systemMessage, ...apiMessages],
  };

  try {
    const response = await openai.chat.completions.create(requestData);
    let content = response.choices[0].message.content;

    // Remove non-JSON elements ("```json") from the content
    content = content.replace(/^```json\s+/, "").replace(/\s+```$/, "");

    console.log("Received content:", content);

    // Parse the JSON content within the response
    const parsedResponse = JSON.parse(content);

    // Format the output for better readability
    const formattedOutput = {
      status: "Success",
      response: {
        Name: parsedResponse["1"],
        Limerick: parsedResponse["2"]
          .replace(/^\n\s+/, "")
          .replace(/\s+\n$/, ""),
        Description: parsedResponse["3"],
      },
    };

    res.status(200).json(formattedOutput);
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
