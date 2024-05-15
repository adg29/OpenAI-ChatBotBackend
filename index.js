const express = require("express");
const env = require("dotenv");
const { promisify } = require("util");
const { default: OpenAI } = require("openai");
const axios = require("axios");

env.config();

const app = express();
const port = process.env.PORT || 3000;

// Define routes
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const sleep = promisify(setTimeout);

async function createAndMonitorRun(threadId, assistantId, imageDescription) {
  console.log(
    "Creating and monitoring run for thread:",
    threadId,
    assistantId,
    imageDescription
  );
  let run;
  let generatedImageDescription;
  let imageUrl = ""; // Declare imageUrl variable
  try {
    run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: assistantId,
    });
    while (run.status === "queued" || run.status === "in_progress") {
      await sleep(500); // Poll every 0.5 seconds
      console.log(`Polling run status for thread ${threadId}: ${run.status}`);
      run = await openai.beta.threads.runs.retrieve(threadId, run.id);

      // Handle "completed" status
      if (run.status === "completed") {
        console.log("Run", run.id, "completed");
      }

      // Handle "requires_action" status
      if (run.status === "requires_action") {
        console.log("Run", run.id, "requires action");

        const { toolOutputs, generatedImageDescriptionData, imageUrlData } =
          await handleRequiredActions(run, imageDescription);

        console.log("[handleRequiredActions] Response:", {
          generatedImageDescriptionData,
          imageUrlData,
        });

        generatedImageDescription = generatedImageDescriptionData;
        imageUrl = imageUrlData; // Assign the obtained imageUrl

        if (run.required_action.type === "submit_tool_outputs") {
          console.log("Submitting tool outputs for run", run.id);
          run = await openai.beta.threads.runs.submitToolOutputs(
            threadId,
            run.id,
            { tool_outputs: toolOutputs }
          );
        }
      }
    }
    console.log(
      "[createAndMonitorRun] Returning generated image description and URL:",
      generatedImageDescription,
      imageUrl
    );
    return { run, generatedImageDescription, imageUrl };
  } catch (error) {
    console.error(`Failed to create or monitor run: ${error}`);
    throw error; // Rethrow to handle it in the caller
  }
}

async function handleRequiredActions(run, imageDescription) {
  console.log("Handling required actions for run:", run.id);
  let toolOutputs = [];
  let generatedImageDescriptionData;
  let imageUrlData = null; // To store the most recent or relevant image URL
  let imagegen_ledger = imageDescription
    ? { description: imageDescription }
    : {};

  console.log(run.id, "requires actions");
  console.log("All runs", run.required_action.submit_tool_outputs.tool_calls);
  for (let tool_call of run.required_action.submit_tool_outputs.tool_calls) {
    console.log(
      "[handleRequiredActions] Tool Call func name:",
      tool_call.function.name
    );
    if (tool_call.function.name === "generate_image") {
      const prompt = JSON.parse(tool_call.function.arguments).prompt;
      const imageUrl = await generateImage(prompt);
      generatedImageDescriptionData = await describeImage(
        imageUrl,
        prompt,
        imagegen_ledger
      );
      console.log(
        "[generate_image Tool Call] generateImage & describeImage Response:",
        {
          imageUrl,
          generatedImageDescriptionData,
        }
      );
      toolOutputs.push({
        tool_call_id: tool_call.id,
        output: imageUrl,
      });
      imageUrlData = imageUrl; // Save the last generated image URL
    }

    if (tool_call.function.name === "generate_image_consistent") {
      const prompt = JSON.parse(tool_call.function.arguments).prompt;
      console.log(
        "Generating consistent image with prompt:",
        prompt,
        imagegen_ledger
      );
      const imageUrl = await generateImageConsistent(prompt, imagegen_ledger);
      console.log("Consistent Image URL:", imageUrl);
      toolOutputs.push({
        tool_call_id: tool_call.id,
        output: imageUrl,
      });
      imageUrlData = imageUrl; // Save the last generated image URL
    }
  }
  return { toolOutputs, generatedImageDescriptionData, imageUrlData };
}

async function retrieveAssistantMessages(threadId) {
  console.log("Retrieving messages for thread:", threadId);
  try {
    const assistantMessages = await openai.beta.threads.messages.list(threadId);
    console.log("[Retrieve Assistant Message]:", assistantMessages);
    console.log("---------------------------------------------");
    const assistantMessagesFiltered = assistantMessages.body.data.filter(
      (message) => message.role === "assistant"
    );
    console.log("[Filtered Assistant Message]:", assistantMessagesFiltered);
    console.log("---------------------------------------------");
    console.log(
      "assistantMessagesFilteredContent",
      assistantMessagesFiltered[0].content[0]
    );
    console.log("---------------------------------------------");
    return assistantMessagesFiltered;
  } catch (error) {
    console.error(`Failed to retrieve messages: ${error}`);
    throw error; // Rethrow to handle it in the caller
  }
}

async function processThread(req, res, next) {
  const { message, assistant, threadId, imageDescription } = req.body;
  console.log("message", message);

  console.log("[Received request]", req.body);

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

    const { run, generatedImageDescription, imageUrl } =
      await createAndMonitorRun(thread.id, assistantId, imageDescription);
    console.log("[createAndMonitorRun]", {
      generatedImageDescription,
      imageUrl,
    });

    const assistantMessages = await retrieveAssistantMessages(thread.id);
    const latestAssistantValue = parseLatestAssistantMessage(assistantMessages);

    console.log("[Latest Assistant Value]:", latestAssistantValue);

    const formattedResponse = formatResponse(
      thread.id,
      req.body.message,
      latestAssistantValue,
      run,
      generatedImageDescription, // Include the description in the response
      imageUrl
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
  threadId,
  userInput,
  latestAssistantValue,
  run,
  imageDescription,
  imageUrl // Add imageUrl parameter
) {
  console.log(`Formatting response for user input: ${userInput}`);
  if (latestAssistantValue) {
    console.log(`Assistant name: ${latestAssistantValue.op1}`);
    console.log(
      `Assistant description: ${
        latestAssistantValue.op2 + latestAssistantValue.op3
      }`
    );
    console.log(`Image description: ${latestAssistantValue.op0}`);
  }

  const assistantResponse = {
    op0: imageUrl,
    op1: latestAssistantValue?.op1,
    op2: (latestAssistantValue?.op2 || "") + (latestAssistantValue?.op3 || ""),
  };

  return {
    threadId,
    userInput,
    runStatus: run.status,
    runId: run.id,
    assistantResponse: latestAssistantValue
      ? assistantResponse
      : "No assistant response available",
    imageDescriptionForPosts: imageDescription,
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
    You are a system generating detailed descriptions of the main subject of an image, a character for a role-playing game. Provide a detailed description of a the game character, focusing on key visual traits essential for consistent image generation. Describe the detailed character for an image generator to recreate consistency of the main subject, including characteristics (e.g., human/non-human, gender, age), style (e.g., Real-Time, Realistic, Cartoon, Anime, Manga, Surreal). Required characteristics include race, gender, and hairstyle. Always include unique facial features in the description. For example, an image subject might have a particular complexion, or a particularly shaped nose, or piercing eyes, or big eyes, or a mole on the face. The resulting description should be concise, limited to 550 characters, exclude any background details, and avoid the use of Markdown or special characters. This format ensures compatibility with JSON API endpoints.
`;

async function describeImage(imgUrl, title, imagegen_ledger) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
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
  try {
    const adjustedPrompt = prompt + imagegen_ledger_consistent["description"];
    console.log("Generating image consistently:", adjustedPrompt);
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

// Middleware to catch JSON parsing errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    console.error(`JSON Syntax Error: ${err.message}`);
    console.error(`Request Body: ${req.rawBody}`);
    return res.status(400).send({ status: 400, message: "Invalid JSON" });
  }
  next();
});

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

app.delete("/api/run", async (req, res, next) => {
  try {
    const { threadId, runId } = req.body;
    console.log("canceling", threadId, runId);

    console.log("[Received cancel request]", req.body);

    if (!threadId || !runId) {
      next(Error("thread and run id required"));
      return;
    }

    const cancelResponse = await openai.beta.threads.runs.cancel(thread.id, {
      role: "user",
      content: message,
    });
    console.log(cancelResponse);

    res.json({ ...req.body, status: "cancelled" });
  } catch (error) {
    console.error("Error:", typeof error, error);
    next(error); // Pass errors to the error handler
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
