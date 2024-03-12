const express = require("express");
const axios = require("axios");
const { NFTStorage, File } = require("nft.storage");
const FormData = require("form-data");
const { OpenAI } = require("openai");
const env = require("dotenv");
const { fromBuffer } = require("file-type");

env.config();

const app = express();
const port = process.env.PORT || 3000;

// Use bearer token for OpenAI authentication
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(express.json());

// Image generation function
const generateImage = async (text) => {
  try {
    const form = new FormData();
    form.append("prompt", text);

    const response = await axios.post(
      "https://clipdrop-api.co/text-to-image/v1",
      form,
      {
        headers: {
          "x-api-key": process.env.IMAGE_API_KEY,
          ...form.getHeaders(),
        },
        responseType: "arraybuffer", // To get binary image data
      }
    );
    return response.data;
  } catch (error) {
    console.log("generateImage error", error);
    throw new Error("Image generation failed");
  }
};

// IPFS upload function
const storeImageNFT = async (imageBuffer, name, description) => {
  try {
    const fileType = await fromBuffer(imageBuffer);
    const image = new File([imageBuffer], "temp.jpg", { type: fileType?.mime });

    console.log("File", image);

    const nftstorage = new NFTStorage({ token: process.env.NFT_STORAGE_KEY });
    const result = await nftstorage.store({
      image,
      name,
      description,
    });
    return { metadataUrl: result.url, metadataContent: result.data };
  } catch (error) {
    throw new Error("IPFS upload failed");
  }
};

const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // 1 second delay between retries

app.post("/api/process", async (req, res) => {
  const userMessage = req.body.message;

  try {
    const systemMessage = {
      role: "system",
      content:
        'You are a narrative designer who designs unique roles based on Club details and User interests\
        Describe their role incorporating the chosen interests without naming them explicitly\
        Do not use the following words in output: "fantasy, comedy, nature, time travel, cats, horror, true crime, sports, dogs, pop stars, travel, history, romcom, video games, anime, blockchain, asmr, cottagecore"\
        These roles are defined with a name and an attractive description assigned to a user\
        Make sure to create the name as a character name, a first name and a last name that belongs to a fantasy superhero world\
        Create an image for the role, limit it in one line\
        Use a few emojis in output\
        Provide the output in JSON structure like this {"roleName": "<The name of the role>", "roleDescription": "<The descritpion of the role>",  "imageDes" : "<The image>"}',
    };

    const apiMessages = [{ role: "user", content: userMessage }];

    const requestData = {
      model: "gpt-4-1106-preview",
      response_format: { type: "json_object" },
      messages: [systemMessage, ...apiMessages],
    };

    console.log("Before OpenAI API Call");
    const response = await openai.chat.completions.create(requestData);
    console.log("After OpenAI API Call");

    console.log("OpenAI Response:", response); // Log the OpenAI response

    // Access the choices array from the response and extract message content
    const choices = response.choices;
    if (response && response.choices && response.choices.length > 0) {
      const { roleName, roleDescription, imageDes } =
        JSON.parse(choices[0].message.content) || {};

      console.log("Generating Image");
      const generatedImage = await generateImage(imageDes);
      console.log("Image Generated");

      const { metadataUrl, metadataContent } = await storeImageNFT(
        generatedImage,
        roleName,
        roleDescription,
        imageDes
      );

      const imageUrl = `https://nftstorage.link/ipfs/${metadataContent.image.hostname}${metadataContent.image.pathname}`;
      const updatedUrl = metadataUrl.replace(
        "ipfs://",
        "https://nftstorage.link/ipfs/"
      );

      res.status(200).json({
        ipfsUrl: updatedUrl,
        roleName,
        roleDescription,
        imageDes,
        image: imageUrl,
      });

      console.log("Image Uploaded to IPFS Successfully");
    } else {
      throw new Error("No choices found in the OpenAI response");
    }
  } catch (error) {
    console.log(error);
    if (error.response && error.response.status === 429) {
      let retries = 0;
      while (retries < MAX_RETRIES) {
        retries++;
        console.log(`Retry attempt ${retries}`);

        // Delay before retrying
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));

        try {
          // Retry the operation
          const systemMessage = {
            role: "system",
            content:
              'You are a narrative designer who designs unique roles based on Club details and User interests\
              Describe their role incorporating the chosen interests without naming them explicitly\
              Do not use the following words in output: "fantasy, comedy, nature, time travel, cats, horror, true crime, sports, dogs, pop stars, travel, history, romcom, video games, anime, blockchain, asmr, cottagecore"\
              These roles are defined with a name and an attractive description assigned to a user\
              Make sure to create the name as a character name, a first name and a last name that belongs to a fantasy superhero world\
              Create an image for the role, limit it in one line\
              Use a few emojis in output\
              Provide the output in JSON structure like this {"roleName": "<The name of the role>", "roleDescription": "<The descritpion of the role>",  "imageDes" : "<The image>"}',
          };

          const apiMessages = [{ role: "user", content: userMessage }];

          const requestData = {
            model: "gpt-4-1106-preview",
            response_format: { type: "json_object" },
            messages: [systemMessage, ...apiMessages],
          };

          console.log("Before OpenAI API Call");
          const response = await openai.chat.completions.create(requestData);
          console.log("After OpenAI API Call");

          console.log("OpenAI Response:", response); // Log the OpenAI response

          // Access the choices array from the response and extract message content
          const choices = response.choices;
          if (response && response.choices && response.choices.length > 0) {
            const { roleName, roleDescription, imageDes } =
              JSON.parse(choices[0].message.content) || {};

            console.log("Generating Image");
            const generatedImage = await generateImage(imageDes);
            console.log("Image Generated");

            const { metadataUrl, metadataContent } = await storeImageNFT(
              generatedImage,
              roleName,
              roleDescription,
              imageDes
            );

            const imageUrl = `https://nftstorage.link/ipfs/${metadataContent.image.hostname}${metadataContent.image.pathname}`;
            const updatedUrl = metadataUrl.replace(
              "ipfs://",
              "https://nftstorage.link/ipfs/"
            );

            res.status(200).json({
              ipfsUrl: updatedUrl,
              roleName,
              roleDescription,
              imageDes,
              image: imageUrl,
            });

            console.log("Image Uploaded to IPFS Successfully");
          } else {
            throw new Error("No choices found in the OpenAI response");
          }
          break;
        } catch (retryError) {
          console.log("Retry Error:", retryError);
          if (retryError.response && retryError.response.status === 429) {
            // If rate limit error occurs again in retry, continue retrying
            continue;
          }
          // If this was the last retry attempt, return error response
          if (retries === MAX_RETRIES) {
            return res.status(500).json({ error: "Retry attempts exceeded" });
          }
        }
      }
    }

    // For other errors
    if (error.response && error.response.status >= 500) {
      let retries = 0;
      while (retries < MAX_RETRIES) {
        retries++;
        console.log(`Retry attempt ${retries}`);

        // Delay before retrying
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));

        try {
          // Retry the operation
          const systemMessage = {
            role: "system",
            content:
              'You are a narrative designer who designs unique roles based on Club details and User interests\
              Describe their role incorporating the chosen interests without naming them explicitly\
              Do not use the following words in output: "fantasy, comedy, nature, time travel, cats, horror, true crime, sports, dogs, pop stars, travel, history, romcom, video games, anime, blockchain, asmr, cottagecore"\
              These roles are defined with a name and an attractive description assigned to a user\
              Make sure to create the name as a character name, a first name and a last name that belongs to a fantasy superhero world\
              Create an image for the role, limit it in one line\
              Use a few emojis in output\
              Provide the output in JSON structure like this {"roleName": "<The name of the role>", "roleDescription": "<The descritpion of the role>",  "imageDes" : "<The image>"}',
          };

          const apiMessages = [{ role: "user", content: userMessage }];

          const requestData = {
            model: "gpt-4-1106-preview",
            response_format: { type: "json_object" },
            messages: [systemMessage, ...apiMessages],
          };

          console.log("Before OpenAI API Call");
          const response = await openai.chat.completions.create(requestData);
          console.log("After OpenAI API Call");

          console.log("OpenAI Response:", response); // Log the OpenAI response

          // Access the choices array from the response and extract message content
          const choices = response.choices;
          if (response && response.choices && response.choices.length > 0) {
            const { roleName, roleDescription, imageDes } =
              JSON.parse(choices[0].message.content) || {};

            console.log("Generating Image");
            const generatedImage = await generateImage(imageDes);
            console.log("Image Generated");

            const { metadataUrl, metadataContent } = await storeImageNFT(
              generatedImage,
              roleName,
              roleDescription,
              imageDes
            );

            const imageUrl = `https://nftstorage.link/ipfs/${metadataContent.image.hostname}${metadataContent.image.pathname}`;
            const updatedUrl = metadataUrl.replace(
              "ipfs://",
              "https://nftstorage.link/ipfs/"
            );

            res.status(200).json({
              ipfsUrl: updatedUrl,
              roleName,
              roleDescription,
              imageDes,
              image: imageUrl,
            });

            console.log("Image Uploaded to IPFS Successfully");
          } else {
            throw new Error("No choices found in the OpenAI response");
          }
          break;
        } catch (retryError) {
          console.log("Retry Error:", retryError);
          // If this was the last retry attempt, return error response
          if (retries === MAX_RETRIES) {
            return res.status(500).json({ error: "Retry attempts exceeded" });
          }
        }
      }
    }

    // If the error is not retried or exceeds the retry attempts, return error response
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
