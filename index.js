const express = require("express");
const axios = require("axios");
const env = require("dotenv");
const FormData = require("form-data");
const app = express();
const port = process.env.PORT || 3000; // Use environment variable or default port 3000

env.config();
app.use(express.json());

// Middleware for logging errors
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

// Middleware for request validation
function validateRequest(req, res, next) {
  const { text } = req.body;
  if (!text || typeof text !== "string") {
    return res
      .status(400)
      .json({ error: 'Invalid input: "text" is missing or not a string' });
  }
  next();
}

// Route for text-to-image conversion
app.post("/generate-image", validateRequest, async (req, res) => {
  try {
    const { text } = req.body;
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
        responseType: "arraybuffer",
      }
    );

    res.contentType("image/png");
    res.send(response.data);
  } catch (error) {
    console.error(error);
    if (error.response && error.response.status === 401) {
      return res.status(401).json({ error: "Unauthorized request" });
    }
    if (error.response && error.response.status === 429) {
      return res.status(429).json({ error: "Too many requests" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
