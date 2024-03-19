const express = require("express");
const env = require("dotenv");
const { default: OpenAI } = require("openai");

const app = express();
const port = 3000;
env.config();

// Define routes
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/api/assist", async (req, res) => {
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
    }

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

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId,
    });

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
    const latestAssistantValue =
      assistantMessagesFiltered[0].content[0].text.value;

    // Send response with assistant's messages
    res.json({
      threadId: thread.id,
      userMessage,
      assitantResponse: latestAssistantValue,
      runResponse: run,
    });

    console.log("done!");
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
