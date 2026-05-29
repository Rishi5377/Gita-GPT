import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

async function listModels() {
  try {
    const response = await client.models.list();
    console.log("Current Groq Available Models:");
    response.data.forEach(model => {
      console.log(`- ${model.id}`);
    });
  } catch (err) {
    console.error("Error fetching models:", err);
  }
}

listModels();
