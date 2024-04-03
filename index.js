const express = require("express");
const env = require("dotenv");
const { promisify } = require("util");
const { default: OpenAI } = require("openai");

const axios = require("axios");
const { NFTStorage, File } = require("nft.storage");
const FormData = require("form-data");
const { fromBuffer } = require("file-type");

// const { ethers } = require("ethers");
// const Near8RolePlaying = require("./abi.json");

env.config();

const app = express();
const port = process.env.PORT || 3000;

// Define routes
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
    console.log(result);
    return { metadataUrl: result.url, metadataContent: result.data };
  } catch (error) {
    throw new Error(error);
  }
};

// // Set up provider
// const provider = new ethers.providers.JsonRpcProvider("YOUR_RPC_PROVIDER_URL");

// // Set up signer
// const privateKey = "YOUR_PRIVATE_KEY"; // Replace with your private key
// const wallet = new ethers.Wallet(privateKey, provider);

// // Connect to the contract
// const contractAddress = "CONTRACT_ADDRESS"; // Replace with your contract address
// const contract = new ethers.Contract(
//   contractAddress,
//   Near8RolePlaying.abi,
//   wallet
// );

// // mint on-chain
// const mintOnChain = async () => {};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/api/assist", async (req, res) => {
  let modifiedResponse = { userMessage: req.body.message };
  try {
    const { message, assistant, threadId } = req.body;

    let thread;
    let createdNewThread = false;

    // If threadId is provided, use existing thread, otherwise create a new thread
    if (!threadId) {
      thread = await openai.beta.threads.create();
      console.log("New thread created with ID:", thread.id);
      createdNewThread = true;
    }

    // If threadId is provided and it's not a new thread, use the provided threadId
    if (threadId && !createdNewThread) {
      thread = { id: threadId }; // Dummy object with threadId for compatibility with existing code
      console.log(`ThreadID : ${threadId}`);
    }

    modifiedResponse = { ...modifiedResponse, thread: thread?.id };
    // Add user message to the thread
    const userMessage = await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: message,
    });

    // Run the selected assistant on the thread
    const assistantId =
      assistant === "roles"
        ? process.env.ROLES_ASSISTANT
        : process.env.POSTS_ASSISTANT;
    console.log(`AssistantID : ${assistantId}`);

    let run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId,
    });

    const sleep = promisify(setTimeout);
    while (run.status === "queued" || run.status === "in_progress") {
      await sleep(500); // Wait for 0.5 seconds
      run = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }

    modifiedResponse = {
      ...modifiedResponse,
      runStatus: run.status,
      runUsage: run.usage,
    };
    // Retrieve assistant's response messages
    const assistantMessages = await openai.beta.threads.messages.list(
      thread.id
    );

    // Assuming assistantMessages is the JSON object containing the assistant response
    // Filter out messages where the role is "assistant"
    const assistantMessagesFiltered = assistantMessages.body.data.filter(
      (message) => message.role === "assistant"
    );

    // Extract the "value" field from the latest assistant message
    const latestAssistantValue = assistantMessagesFiltered[0]
      ? JSON.parse(assistantMessagesFiltered[0].content[0].text.value)
      : "No assistant response available";

    modifiedResponse = {
      ...modifiedResponse,
      assistantResponse: latestAssistantValue,
    };
    console.log(`UserInput : ${req.body.message}`);
    console.log(`Name : ${latestAssistantValue.op1}`);
    console.log(`Description : ${latestAssistantValue.op2}`);
    console.log(`ImageDescription : ${latestAssistantValue.op0}`);
    const name = latestAssistantValue.op1;
    // condition because of posts assistant consists op3 too
    const description = latestAssistantValue.op3
      ? latestAssistantValue.op2 + latestAssistantValue.op3
      : latestAssistantValue.op2;

    const ImageDes = latestAssistantValue.op0
      ? latestAssistantValue.op0
      : req.body.message;

    console.log("Generating Image");
    const generatedImage = await generateImage(ImageDes);
    console.log("Image Generated");

    console.log("Uploading to IPFS");
    const { metadataUrl, metadataContent } = await storeImageNFT(
      generatedImage,
      name,
      description,
      ImageDes
    );
    console.log("Uploaded");

    const imageUrl = `https://nftstorage.link/ipfs/${metadataContent.image.hostname}${metadataContent.image.pathname}`;
    const updatedUrl = metadataUrl.replace(
      "ipfs://",
      "https://nftstorage.link/ipfs/"
    );

    // Modify the response object before sending it
    modifiedResponse = {
      ...modifiedResponse,
      ipfsUrl: updatedUrl,
      image: imageUrl,
    };

    // Log the modified response
    console.log("Modified Response:", modifiedResponse);

    // Send the modified response
    res.json(modifiedResponse);

    console.log("All Jobs Done!");
  } catch (error) {
    console.error("Error:", typeof error, error);
    res.status(500).json({
      error: error?.message || "Internal server error",
      currentResponse: modifiedResponse,
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
