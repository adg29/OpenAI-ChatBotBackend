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

app.post("/api/process", async (req, res) => {
  const userMessage = req.body.message;

  try {
    const systemMessage = {
      role: "system",
      content:
        'You are a narrative designer who designs unique roles based on Club details and User interests.\
        These roles are defined with a name and an attractive description assigned to a user.\
        Provide the output in JSON structure like this {"roleName": "<The name of the role>", "roleDescription": "<The descritpion of the role>"}',
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
      const { roleName, roleDescription } =
        JSON.parse(choices[0].message.content) || {};

      console.log("Generating Image");
      const generatedImage = await generateImage(roleName);
      console.log("Image Generated");

      const { metadataUrl, metadataContent } = await storeImageNFT(
        generatedImage,
        roleName,
        roleDescription
      );

      const imageUrl = `https://ipfs.io/ipfs/${metadataContent.image.hostname}${metadataContent.image.pathname}`;

      // Replacing 'ipfs://' with 'https://ipfs.io/ipfs/'
      const updatedUrl = metadataUrl.replace(
        "ipfs://",
        "https://ipfs.io/ipfs/"
      );

      res.status(200).json({
        ipfsUrl: updatedUrl,
        roleName,
        roleDescription,
        image: imageUrl,
      });

      console.log("Image Uploaded to IPFS Successfully");
    } else {
      throw new Error("No choices found in the OpenAI response");
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
