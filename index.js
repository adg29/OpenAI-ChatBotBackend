const express = require("express");
const env = require("dotenv");
const { default: OpenAI } = require("openai");

const app = express();
env.config();
app.use(express.json());
// Middleware to catch JSON parsing errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    console.error(`JSON Syntax Error: ${err.message}`);
    console.error(`Request Body: ${req.rawBody}`);
    return res.status(400).send({ status: 400, message: "Invalid JSON" });
  }
  next();
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const systemMessage = {
  role: "system",
  content: `
    I want you act as a social media writer who designs posts based around the role playing character from the input message.
    Create an postImage using imageDescription and incorporate the role playing character into the scene.
    Make sure the prompt that describes image is well detailed based on the provided attributes.
    Create a description of the post picture which contains a caption and a fortune cookie message.
    Make sure the caption is a short, tweet-sized one-sentence plot point to flesh the storyline from the input.
    Make sure that the fortune cookie message is in the format of a social post like Instagram with a limit of 60 words.
    Assign a catchy name to this post and include the caption and fortune cookie message in description.
    Provide the output in JSON structure like this {"name": "<name>", "description": "<caption, fortune-cookie>", "postImage": "<prompt>"}.
  `,
};

app.post("/api/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    const imageDescription = req.body.imageDescription;

    // Combine user message and image description
    const combinedMessage = `${userMessage} ${imageDescription}`;
    const apiMessages = [
      systemMessage,
      { role: "user", content: combinedMessage },
    ];

    const requestData = {
      model: "gpt-3.5-turbo-0125",
      messages: apiMessages,
    };

    const response = await openai.chat.completions.create(requestData);
    console.log("OpenAI API Call", response);

    if (response && response.choices && response.choices.length > 0) {
      let content;
      try {
        console.log(
          "response.choices[0].message.content",
          response.choices[0].message.content
        );
        content = JSON.parse(response.choices[0].message.content);
        console.log("content", content);
      } catch (parseError) {
        throw new Error(`Parsing response failed: ${parseError.message}`);
      }

      // Generate image URL
      console.log("content.postImage", content.postImage);
      const imageUrl = await generateImage(content.postImage);

      const formattedContent = {
        name: content.name.replace(/\n/g, " "),
        description: content.description.replace(/\n/g, " "),
        postImage: imageUrl,
      };

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

async function generateImage(prompt, n = 1, size = "1024x1024") {
  console.log("Generating image:", prompt);
  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      size: size,
      n: n,
    });

    const imageUrl = response.data[0].url;
    return imageUrl;
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
}

const port = process.env.PORT || 3000;
const startServer = () => {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
};

startServer();
