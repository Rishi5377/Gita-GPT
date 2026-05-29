import { retrieveContext } from "@/services/database/retriever";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  console.log("Testing retrieveContext...");
  const result = await retrieveContext("I am scared of losing my family");
  
  console.log("\n--- RESULT ---");
  console.log(result.masterShloka ? `Master Shloka: BG ${result.masterShloka.chapter}.${result.masterShloka.verse}` : "No Master Shloka");
  console.log(`Chunks retrieved: ${result.chunks.length}`);
}

run();
