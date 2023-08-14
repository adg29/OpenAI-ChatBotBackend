const axios = require("axios");
const { systemMessage } = require("../utils/chat");
const env = require("dotenv");

env.config();

class ChatService {

    static async getChatResponse(userMessage) {
        const apiUrl = "https://api.openai.com/v1/chat/completions";
        const bearerToken = process.env.API_KEY;

        const headers = {
            Authorization: `Bearer ${bearerToken}`,
            "Content-Type": "application/json",
        };

        const apiMessages = [{ role: "user", content: userMessage }];
  
        const requestData = {
            model: "gpt-3.5-turbo",
            messages: [
                systemMessage, // The system message DEFINES the logic of our chatGPT
                ...apiMessages, // The messages from our chat with ChatGPT
            ],
        };
        const res = await axios.post(apiUrl, requestData, { headers });

        return JSON.parse(res?.data?.choices?.[0]?.message?.content);
    }

};

module.exports = ChatService;