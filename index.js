const express = require("express");
const env = require("dotenv");
const { promisify } = require("util");
const { default: OpenAI } = require("openai");
const axios = require("axios");
// const { NFTStorage, File } = require("nft.storage");
// const FormData = require("form-data");
// const { fromBuffer } = require("file-type");

// const { ethers } = require("ethers");
// const Near8RolePlaying = require("./abi.json");

env.config();

const app = express();
const port = process.env.PORT || 3000;

// Define routes
app.use(express.json());

// // Image generation function
// const generateImage = async (text) => {
//   try {
//     const form = new FormData();
//     form.append("prompt", text);

//     const response = await axios.post(
//       "https://clipdrop-api.co/text-to-image/v1",
//       form,
//       {
//         headers: {
//           "x-api-key": process.env.IMAGE_API_KEY,
//           ...form.getHeaders(),
//         },
//         responseType: "arraybuffer", // To get binary image data
//       }
//     );
//     return response.data;
//   } catch (error) {
//     console.log("generateImage error", error);
//     throw new Error("Image generation failed");
//   }
// };

// // IPFS upload function
// const storeImageNFT = async (imageBuffer, name, description) => {
//   try {
//     const fileType = await fromBuffer(imageBuffer);
//     const image = new File([imageBuffer], "temp.jpg", { type: fileType?.mime });

//     console.log("File", image);

//     const nftstorage = new NFTStorage({ token: process.env.NFT_STORAGE_KEY });
//     const result = await nftstorage.store({
//       image,
//       name,
//       description,
//     });
//     console.log(result);
//     return { metadataUrl: result.url, metadataContent: result.data };
//   } catch (error) {
//     throw new Error(error);
//   }
// };

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

const sleep = promisify(setTimeout);

async function createAndMonitorRun(threadId, assistantId, imageDescription) {
  console.log("create and monitor imageDescription", imageDescription);
  let run;
  let generatedImageDescription;
  try {
    run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: assistantId,
    });
    while (run.status === "queued" || run.status === "in_progress") {
      await sleep(500); // Poll every 0.5 seconds
      run = await openai.beta.threads.runs.retrieve(threadId, run.id);

      // Handle "completed" status
      if (run.status === "completed") {
        console.log(run.id, "completed");
      }

      // Handle "requires_action" status
      if (run.status === "requires_action") {
        const { toolOutputs, generatedImageDescriptionData } =
          await handleRequiredActions(run, imageDescription);
        console.log(
          "generatedImageDescriptionData",
          generatedImageDescriptionData
        );
        generatedImageDescription = generatedImageDescriptionData;

        if (run.required_action.type === "submit_tool_outputs") {
          run = await openai.beta.threads.runs.submitToolOutputs(
            threadId,
            run.id,
            { tool_outputs: toolOutputs }
          );
        }
      }
    }
    console.log("return gen desc", generatedImageDescription);
    return { run, generatedImageDescription };
  } catch (error) {
    console.error(`Failed to create or monitor run: ${error}`);
    throw error; // Rethrow to handle it in the caller
  }
}

async function handleRequiredActions(run, imageDescription) {
  let toolOutputs = [];
  let generatedImageDescriptionData = null;
  let imagegen_ledger = imageDescription
    ? { description: imageDescription }
    : {};

  console.log(run.id, "requires actions");
  console.log("All runs", run.required_action.submit_tool_outputs.tool_calls);
  for (let tool_call of run.required_action.submit_tool_outputs.tool_calls) {
    console.log(tool_call.function.name);
    if (tool_call.function.name === "generate_image") {
      const prompt = JSON.parse(tool_call.function.arguments).prompt;
      const imageUrl = await generateImage(prompt);
      generatedImageDescriptionData = await describeImage(
        imageUrl,
        prompt,
        imagegen_ledger
      );
      console.log("Image URL:", imageUrl);
      console.log("imageDescription", generatedImageDescriptionData);
      toolOutputs.push({
        tool_call_id: tool_call.id,
        output: imageUrl,
      });
    }

    if (tool_call.function.name === "generate_image_consistent") {
      const prompt = JSON.parse(tool_call.function.arguments).prompt;
      console.log("generateImageConsistent", prompt, imagegen_ledger);
      const imageUrl = await generateImageConsistent(prompt, imagegen_ledger);
      console.log("Consistent Image URL:", imageUrl);
      toolOutputs.push({
        tool_call_id: tool_call.id,
        output: imageUrl,
      });
    }
  }
  return { toolOutputs, generatedImageDescriptionData };
}

async function retrieveAssistantMessages(threadId) {
  try {
    const assistantMessages = await openai.beta.threads.messages.list(threadId);
    const assistantMessagesFiltered = assistantMessages.body.data.filter(
      (message) => message.role === "assistant"
    );
    return assistantMessagesFiltered;
  } catch (error) {
    console.error(`Failed to retrieve messages: ${error}`);
    throw error; // Rethrow to handle it in the caller
  }
}

async function processThread(req, res, next) {
  const { message, assistant, threadId, imageDescription } = req.body;

  console.log("imageDescription", imageDescription);
  if (assistant === "posts" && !imageDescription) {
    next(Error("imageDescription required for posts"));
    return;
  }

  let thread = { id: threadId || (await createNewThread()) };

  try {
    const assistantId = getAssistantId(assistant);

    let modifiedResponse = { userMessage: req.body.message };
    modifiedResponse = { ...modifiedResponse, thread: thread?.id };
    // Add user message to the thread
    const userMessage = await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: message,
    });

    const { run, generatedImageDescription } = await createAndMonitorRun(
      thread.id,
      assistantId,
      imageDescription
    );
    console.log("generatedImageDescription", generatedImageDescription);

    const assistantMessages = await retrieveAssistantMessages(thread.id);
    const latestAssistantValue = parseLatestAssistantMessage(assistantMessages);

    const formattedResponse = formatResponse(
      req.body.message,
      latestAssistantValue,
      run,
      generatedImageDescription // Include the description in the response
    );

    console.log("Response sent successfully.");
    res.json(formattedResponse);
  } catch (error) {
    console.log("processTrhead error", error);
    next(error); // Pass errors to the error handler
    return;
  }
}

function formatResponse(
  userInput,
  latestAssistantValue,
  run,
  imageDescription
) {
  console.log(`UserInput: ${userInput}`);
  if (latestAssistantValue) {
    console.log(`Name: ${latestAssistantValue.op1}`);
    console.log(
      `Description: ${latestAssistantValue.op2 + latestAssistantValue.op3}`
    );
    console.log(`ImageDescription: ${latestAssistantValue.op0}`);
  }

  return {
    userInput,
    runStatus: run.status,
    assistantResponse:
      latestAssistantValue || "No assistant response available",
    imageDescription,
  };
}

function parseLatestAssistantMessage(messages) {
  if (
    messages.length > 0 &&
    messages[0].content &&
    messages[0].content[0].text
  ) {
    try {
      return JSON.parse(
        messages[0].content[0].text.value.replace(/```json|```/g, "")
      );
    } catch (error) {
      console.error("Error parsing message content:", error);
    }
  }
  return null;
}

async function createNewThread() {
  const thread = await openai.beta.threads.create();
  console.log(`New thread created with ID: ${thread.id}`);
  return thread.id;
}

function getAssistantId(assistant) {
  return assistant === "roles"
    ? process.env.ROLES_ASSISTANT
    : process.env.POSTS_ASSISTANT;
}

const describeSystemPrompt = `
    You are a system generating detailed descriptions of the main subject of an image, a character for a role-playing game.
    Describe the detailed character for an image generator to recreate consistency of the main subject, including characteristics (e.g., human/non-human, gender, age), style (e.g., Real-Time, Realistic, Cartoon, Anime, Manga, Surreal), and resolution (e.g., SD, HD, QHD, 4k, 8k).
    Provided with an image, you will describe the main subject that you see in the image, giving details that will be used to describe and maintain consistency with the main subject when new images are generated with the image generation model.
    You can describe unambiguously the main subject of the image.
`;

async function describeImage(imgUrl, title, imagegen_ledger) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: describeSystemPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: imgUrl,
              },
            },
          ],
        },
        {
          role: "user",
          content: title,
        },
      ],
    });

    imagegen_ledger["url"] = imgUrl;
    imagegen_ledger["prompt"] = title;
    image_description = response.choices[0].message.content;
    imagegen_ledger["description"] = image_description;

    return image_description;
  } catch (error) {
    console.error("Failed to describe image:", error);
    throw error;
  }
}

async function generateImage(prompt, n = 1, size = "1024x1024") {
  console.log("Generating image:", prompt);
  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      size: size,
      quality: "standard",
      n: n,
    });

    const imageUrl = response.data[0].url;
    return imageUrl;
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
}

async function generateImageConsistent(
  prompt,
  imagegen_ledger,
  n = 1,
  size = "1024x1024"
) {
  const imagegen_ledger_consistent = imagegen_ledger || { description: "" };
  console.log("Generating image consistently:", prompt);
  try {
    const adjustedPrompt = prompt + imagegen_ledger_consistent["description"];
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: adjustedPrompt,
      size: size,
      quality: "standard",
      n: n,
    });

    const imageUrl = response.data[0].url;
    return imageUrl;
  } catch (error) {
    console.error("Error generating consistent image:", error);
    throw error;
  }
}

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

app.post("/api/assist", async (req, res, next) => {
  try {
    processThread(req, res, next);
  } catch (error) {
    console.error("Error:", typeof error, error);
    next(error); // Pass errors to the error handler
  }
});

app.post("/api/vision", async (req, res, next) => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "What’s in this image?" },
            {
              type: "image_url",
              image_url: {
                url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg",
              },
            },
          ],
        },
      ],
    });
    console.log(response.choices[0]);
    res.json({ description: response.choices[0] });
  } catch (error) {
    console.error("Error:", typeof error, error);
    next(error); // Pass errors to the error handler
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
