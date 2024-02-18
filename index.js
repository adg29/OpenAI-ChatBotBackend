const express = require("express");
const axios = require("axios");
const env = require("dotenv");
const FormData = require("form-data");
const app = express();
const port = 3000; // You can change this port as needed

env.config();
app.use(express.json());

// Define a route to handle text-to-image requests
app.post("/generate-image", async (req, res) => {
  try {
    const { text } = req.body;

    // Check if the "text" field is missing or not a string
    if (!text || typeof text !== "string") {
      return res
        .status(400)
        .json({ error: 'Invalid input: "text" is missing or not a string' });
    }

    // Create a FormData object to send the text to the external API
    const form = new FormData();
    form.append("prompt", text);

    // Send a POST request to the external Text to Image API
    const response = await axios.post(
      "https://clipdrop-api.co/text-to-image/v1",
      form,
      {
        headers: {
          "x-api-key": process.env.API_KEY,
          ...form.getHeaders(),
        },
        responseType: "arraybuffer", // To get binary image data
      }
    );

    // Set the response headers and send the image
    res.contentType("image/png");
    res.send(response.data);
  } catch (error) {
    console.error(error);
    if (error.response.status === 401) {
      return res.status(401).json({ error: "Unauthorized request" });
    }
    if (error.response.status === 429) {
      return res.status(429).json({ error: "Unacceptable input" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
