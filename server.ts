import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

function cleanJsonText(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/i, "");
    cleaned = cleaned.replace(/\n?```$/, "");
  }
  return cleaned.trim();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support JSON bodies with larger limits for PDFs and large statements
  app.use(express.json({ limit: "25mb" }));

  // Helper function to get Gemini client
  const getAiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing. Please configure it in the Secrets panel in AI Studio settings.");
    }
    return new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  };

  // Response schema for consistency
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      guessedBankName: {
        type: Type.STRING,
        description: "The name of the bank guessed from the statement, e.g., 'HDFC Bank', 'State Bank of India', 'ICICI Bank', or 'Main Bank Account' if unknown."
      },
      transactions: {
        type: Type.ARRAY,
        description: "List of all transactions found in the statement.",
        items: {
          type: Type.OBJECT,
          properties: {
            date: {
              type: Type.STRING,
              description: "The transaction date in 'YYYY-MM-DD' format."
            },
            description: {
              type: Type.STRING,
              description: "The narration or transaction details (UPI info, transfer remark, cheque details, payee name)."
            },
            refNo: {
              type: Type.STRING,
              description: "UPI Ref, Cheque, IMPS Reference Number or other transaction ID if present. Otherwise empty."
            },
            type: {
              type: Type.STRING,
              description: "Whether money is in ('credit') or money is out ('debit'). Must be either 'credit' or 'debit'."
            },
            amount: {
              type: Type.NUMBER,
              description: "The positive transaction amount."
            }
          },
          required: ["date", "description", "type", "amount"]
        }
      }
    },
    required: ["guessedBankName", "transactions"]
  };

  // 1. Parse raw text bank statement
  app.post("/api/parse-statement", async (req: express.Request, res: express.Response) => {
    try {
      const { statementText } = req.body;
      if (!statementText || !statementText.trim()) {
        return res.status(400).json({ error: "Statement text is required" });
      }

      const ai = getAiClient();
      const prompt = `You are an expert bank statement parser. Analyze the following raw bank statement text and extract the list of transactions.
Identify the bank name if possible. Convert all dates to YYYY-MM-DD format (if only DD-MM or DD-Mon is present, assume year 2026 or appropriate).
Determine if each transaction is a 'credit' (money deposited / receipt / inflow) or 'debit' (money withdrawn / payment / outflow).
Ensure amounts are positive numbers.

Bank statement raw text:
${statementText}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error("No response returned from the AI model.");
      }

      console.log("Gemini statement response text length:", text.length);
      const cleanedText = cleanJsonText(text);
      try {
        const parsed = JSON.parse(cleanedText);
        return res.json(parsed);
      } catch (e: any) {
        console.error("Failed to parse Gemini response as JSON:", text);
        throw new Error(`AI returned invalid JSON: ${e.message}. Raw output: ${text.slice(0, 150)}...`);
      }
    } catch (error: any) {
      console.error("Error parsing bank statement text:", error);
      return res.status(500).json({
        error: error.message || "An unexpected error occurred during bank statement parsing."
      });
    }
  });

  // 2. Parse PDF statement (multimodal inlineData)
  app.post("/api/parse-pdf", async (req: express.Request, res: express.Response) => {
    try {
      const { base64Data } = req.body;
      if (!base64Data) {
        return res.status(400).json({ error: "Base64 PDF data is required" });
      }

      // Remove any data URL prefix (e.g., "data:application/pdf;base64,") robustly
      const cleanBase64 = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: "application/pdf",
                data: cleanBase64
              }
            },
            {
              text: `You are an expert bank statement parser. Read the attached bank statement PDF.
Extract all transactions. Identify the bank name if possible. Convert all transaction dates to YYYY-MM-DD format.
Determine if each transaction is a 'credit' (money deposited / receipt / inflow) or 'debit' (money withdrawn / payment / outflow).
Ensure amounts are positive numbers.`
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error("No response returned from the AI model.");
      }

      console.log("Gemini PDF response text length:", text.length);
      const cleanedText = cleanJsonText(text);
      try {
        const parsed = JSON.parse(cleanedText);
        return res.json(parsed);
      } catch (e: any) {
        console.error("Failed to parse Gemini PDF response as JSON:", text);
        throw new Error(`AI returned invalid JSON: ${e.message}. Raw output: ${text.slice(0, 150)}...`);
      }
    } catch (error: any) {
      console.error("Error parsing PDF bank statement:", error);
      return res.status(500).json({
        error: error.message || "An unexpected error occurred during PDF bank statement parsing."
      });
    }
  });

  // Serve static files / Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
