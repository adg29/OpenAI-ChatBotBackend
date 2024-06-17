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
        console.log("Run Usage", run.id, run.usage);
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

    // Filter out messages where the role is "assistant"
    const assistantMessagesFiltered = assistantMessages.body.data.filter(
      (message) => message.role === "assistant"
    );

    if (assistantMessagesFiltered.length > 0) {
      const assistantMessageContent = assistantMessagesFiltered[0].content;

      let latestAssistantValue;
      if (typeof assistantMessageContent === "string") {
        latestAssistantValue = JSON.parse(
          assistantMessageContent.replace(/```json|```/g, "")
        );
      } else {
        latestAssistantValue = assistantMessageContent;
      }

      // Since latestAssistantValue is a list, we need to access the first element
      if (
        Array.isArray(latestAssistantValue) &&
        latestAssistantValue.length > 0
      ) {
        const parsedValue = JSON.parse(latestAssistantValue[0].text.value);

        console.log(`Name : ${parsedValue.op1}`);
        console.log(`Description : ${parsedValue.op2 + parsedValue.op3}`);
        console.log(`ImageDescription : ${parsedValue.op0}`);

        return parsedValue;
      } else {
        return "No assistant message content response available";
      }
    } else {
      return "No assistant response available";
    }
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

    const parsedValue = await retrieveAssistantMessages(thread.id);
    // const latestAssistantValue = parseLatestAssistantMessage(assistantMessages);

    // Fetch run usage details
    const runUsage = await getTokenUsageByRun(thread.id, run.id);
    const formattedResponse = {
      threadId: thread.id,
      userMessage: req.body.message,
      run: run.id,
      name: parsedValue.op1,
      description:
        parsedValue.op2 || parsedValue.op3
          ? [parsedValue.op2, parsedValue.op3].join("")
          : undefined,
      generatedImageDescriptionForPosts: generatedImageDescription, // Include the description in the response
      imageUrl: imageUrl,
      RunUsage: runUsage, // Add run usage to the response
    };

    modifiedResponse = {
      ...modifiedResponse,
      op1: parsedValue.op1,
      op2: parsedValue.op2 + parsedValue.op3,
      op0: parsedValue.op0,
    };

    console.log("Response sent successfully.");
    res.json(formattedResponse);
  } catch (error) {
    console.log("processThread error", error);
    next(error); // Pass errors to the error handler
    return;
  }
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
Provide a detailed description of a role-playing game character, focusing on key visual traits essential for consistent image generation. Required characteristics include race, gender, and hairstyle. Additionally, include unique facial features in the description. For example, an image subject might have a pointy nose, piercing eyes, big eyes, or a mole on the face. The resulting description should be concise, limited to 550 characters, exclude any background details, and avoid the use of Markdown or special characters. This format ensures compatibility with JSON API endpoints.
`;

const describeSystemPromptCharacteristics = `
Analyze the provided image of a role-playing game character and extract the following characteristics, returning them in a JSON object format:

{
  Form: Humanoid/Non-Humanoid,
  Gender: Male/Female/Non-Binary, etc.,
  Age: Approximate age range (25-30),
  Height: Tall/Average/Short,
  Build: Slim/Athletic/Heavyset, etc.,
  SkinTone: Light/Fair/Medium/Olive/Dark, etc.,
  Eyes: Blue/Black/Brown, etc.,
  Hair: {
    Color: Black/Brunette/Blond/Red/White etc.,
    Length: Short/Medium/Long,
    Style: Curly/Straight/Wavy, etc.
  },
  FacialFeatures: Mole/Scar/Freckels(Specify location)
  Clothing: {
    Style: Medieval/Modern/Futuristic, etc.,
    Details: Armor/Robes/Casual, etc.,
    Footwear: Boots/Sandals, etc.,
    Accessory: Jewelry/Weapons, etc.
  },
  AdditionalFeatures: Tattoo/Wings/Tails/Magic/Aura/None(Describe if any)

The response should be concise, limited to the specified characteristics, and compatible with JSON API endpoints.
`;

const characteristics = `
Form: Humanoid, Non-Humanoid
Gender: Male, female, non-binary, etc.
Age: 20 to 30 years.
Height: Tall or not.
Build: Slim or not.
Skin Tone: Light, fair, medium, olive, dark.
Hair: Color, length, style (e.g., black, long, curly).
Eyes: Color(blue, black, brown, etc), shape (almond-shaped, etc).
Facial Features: Distinctive marks, facial hair, scars, freckles.
Clothing and Accessories: Style, details, footwear, accessories, weaponry (if applicable).
Additional Features(Optional): Tattoos, Wings or Tails, Magic or Aura
`;

async function describeImage(imgUrl, title, imagegen_ledger) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: describeSystemPromptCharacteristics,
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

async function getTokenUsageByRun(threadId, runId) {
  try {
    const run = await openai.beta.threads.runs.retrieve(threadId, runId);
    if (run && run.usage) {
      console.log("Token usage for run:", run.usage);
      return run.usage;
    } else {
      console.log("No usage data available for this run.");
      return null;
    }
  } catch (error) {
    console.error("Failed to retrieve run usage:", error);
    throw error;
  }
}

async function getTotalTokenUsage(threadId) {
  try {
    const runs = await openai.beta.threads.runs.list(threadId);
    let totalUsage = {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };

    runs.forEach((run) => {
      if (run.usage) {
        totalUsage.prompt_tokens += run.usage.prompt_tokens;
        totalUsage.completion_tokens += run.usage.completion_tokens;
        totalUsage.total_tokens += run.usage.total_tokens;
      }
    });

    console.log("Total token usage for all runs in the thread:", totalUsage);
    return totalUsage;
  } catch (error) {
    console.error("Failed to retrieve total token usage:", error);
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

    const cancelResponse = await openai.beta.threads.runs.cancel(threadId, {
      role: "user",
      // content: message,
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
