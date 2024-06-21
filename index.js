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
  content: `
    You are a narrative designer who designs posts (a caption and a fortune cookie message).
    Make sure the caption is a short, tweet-sized one-sentence plot point to flesh out an existing storyline.
    Make sure that the fortune cookie message is in the format of a social post like Instagram with a limit of 60 words.
    Assign a catchy name to this post.
    Utilize the provided imageDescription and incorporate the post's scene/setting to create a prompt that can be used to generate images.
    Make sure the prompt that describes image is well detailed based on the provided attributes.
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
        content = JSON.parse(response.choices[0].message.content);
      } catch (parseError) {
        throw new Error(`Parsing response failed: ${parseError.message}`);
      }

      // Generate image URL
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
