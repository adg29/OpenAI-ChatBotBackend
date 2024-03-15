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
    const { message, assistant } = req.body;

    // Create a Thread for the user
    const thread = await openai.beta.threads.create();
    let assistantId = null;

    // Determine which assistant to use based on input
    if (assistant === "roles") {
      assistantId = "asst_CkwYy1lpgzmDgBTKbILkFzWP";
    } else if (assistant === "post") {
      assistantId = "asst_az3JPhCITaudTbulFz2NnRaw";
    } else {
      return res.status(400).json({ error: "Invalid assistant specified" });
    }

    // Add user message to the thread
    const userMessage = await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: message,
    });

    // Run the selected assistant on the thread
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId,
    });

    // Retrieve assistant's response messages
    const assistantMessages = await openai.beta.threads.messages.list(
      thread.id
    );

    // Send response with assistant's messages
    res.json({ messages: run });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
