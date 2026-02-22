const { createGoogleGenerativeAI } = require("@ai-sdk/google");
const { generateText } = require("ai");
const { questionCache, feedbackCache } = require("./apiCache");

class GeminiAI {
  constructor() {
    // Use Gemini 2.5 Flash model for optimal performance on free tier
    this.modelName = "gemini-2.5-flash";
    this.apiKey = "";
    this.google = null;
    this.initialized = false;
    this.lastInitTime = 0;
  }

  init(apiKey) {
    if (!apiKey) throw new Error("Gemini API key is required");
    
    // Reuse existing instance if API key hasn't changed
    if (this.apiKey === apiKey && this.initialized && this.google) {
      return;
    }
    
    this.apiKey = apiKey;
    this.google = createGoogleGenerativeAI({ apiKey: this.apiKey });
    this.initialized = true;
    this.lastInitTime = Date.now();
    
    if ((process.env.DEBUG_GEMINI || "") === "1") {
      console.log("[GeminiAI] Provider initialized");
    }
  }

  /**
   * Enhanced retry logic with exponential backoff
   * Better for free tier API limits
   */
  async _callWithRetry(fn, retries = 3, initialDelayMs = 500) {
    let lastErr;
    let delay = initialDelayMs;
    
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        
        // Check if error is rate limit or quota related
        const isRateLimit = 
          err.message?.includes("429") ||
          err.message?.includes("quota") ||
          err.message?.includes("too many") ||
          err.message?.includes("rate limit");
        
        if (i < retries - 1) {
          if (isRateLimit) {
            // Use longer backoff for rate limits
            delay = Math.min(delay * 2, 5000); // exponential backoff, max 5s
          }
          if ((process.env.DEBUG_GEMINI || "") === "1") {
            console.log(`[GeminiAI] Retry ${i + 1}/${retries} after ${delay}ms`);
          }
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    throw lastErr;
  }

  async generateResponse({ prompt, temperature = 0.3, maxOutputTokens = 1200 } = {}) {
    if (!this.google) {
      throw new Error("Gemini client not initialized. Call init(apiKey).");
    }

    const call = async () => {
      try {
        const model = this.google(this.modelName);
        
        const result = await generateText({
          model,
          prompt,
          temperature,
          maxTokens: maxOutputTokens,
        });

        if ((process.env.DEBUG_GEMINI || "") === "1") {
          console.log(`[GeminiAI] Response received: ${result.text.length} chars`);
        }

        return {
          text: result.text,
          raw: result,
        };
      } catch (err) {
        console.error("[GeminiAI] API error:", err.message);
        throw err;
      }
    };

    return this._callWithRetry(call);
  }

  extractTechStack(jobDesc = "") {
    if (!jobDesc) return "";
    const techKeywords = [
      "java",
      "sql",
      "dsa",
      "oops",
      "python",
      "javascript",
      "react",
      "node",
      "angular",
      "vue",
      "spring",
      "hibernate",
      "typescript",
      "aws",
      "docker",
      "kubernetes",
      "graphql",
      "rest",
      "express",
      "mongodb",
      "postgresql",
    ];
    const found = techKeywords.filter((t) => jobDesc.toLowerCase().includes(t));
    return Array.from(new Set(found)).join(", ");
  }

  generatePrompt(position, desc, experience, techStack) {
    return `You are an expert technical interviewer. Generate 5 high-quality THEORETICAL AND CONCEPTUAL interview questions for the role below.
IMPORTANT CONSTRAINT: Questions must be answerable through explanation and discussion only. DO NOT ask candidates to write code, implement functions, or solve coding problems.
Instead, focus on: concepts, principles, design patterns, best practices, architectural trade-offs, decision-making, and domain knowledge.
Use question starters like: "Explain...", "Describe...", "Discuss...", "Compare...", "What are the benefits/drawbacks of...", "How would you approach..."

Role: ${position}
Experience: ${experience} year(s)
Technologies: ${techStack || "general software engineering"}
Job Description: ${desc}

Strict output requirement:
Return ONLY a single JSON array (no explanation, no markdown, no surrounding text). Each item must have:
{
  "question": "string (theoretical question, no coding asked)",
  "answer": "string (model answer / key points)",
  "difficulty": "Easy|Medium|Hard",
  "category": "Technical",
  "topics": ["array", "of", "topics"]
}

Example format: [{"question":"Explain the key principles of REST API design and how they ensure scalability.","answer":"REST principles include: using standard HTTP methods for operations, statelessness for scalability, uniform resource identification via URIs, representation of resources in multiple formats, HATEOAS for navigation, and proper use of HTTP status codes. These enable horizontal scaling and loose coupling.","difficulty":"Medium","category":"Technical","topics":["api","rest","design"]}]

Produce exactly 5 theoretical questions in this JSON array format.`;
  }

  parseResponse(text) {
    if (!text || typeof text !== "string") return [];
    
    let clean = text.trim();
    
    // Remove markdown code blocks
    clean = clean.replace(/```(?:json)?\n?([\s\S]*?)```/gi, "$1");
    clean = clean.replace(/`/g, "");
    
    // Try to parse as JSON with several fallbacks and sanitization attempts
    const tryParse = (str) => {
      try {
        return JSON.parse(str);
      } catch (e) {
        return null;
      }
    };

    // 1) Direct parse
    let parsed = tryParse(clean);
    if (parsed) {
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.questions)) return parsed.questions;
      if (parsed && parsed.data && Array.isArray(parsed.data.questions)) return parsed.data.questions;
      if (parsed && Array.isArray(parsed.items)) return parsed.items;
      return [parsed];
    }

    // 2) Extract explicit JSON array/object from text
    const arrMatch = clean.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      parsed = tryParse(arrMatch[0]);
      if (Array.isArray(parsed)) return parsed;
    }
    const objMatch = clean.match(/\{[\s\S]*\}/);
    if (objMatch) {
      parsed = tryParse(objMatch[0]);
      if (parsed) return Array.isArray(parsed) ? parsed : [parsed];
    }

    // 3) Sanitization attempts: remove trailing commas, normalize quotes
    let sanitized = clean
      .replace(/,\s*([}\]])/g, "$1") // remove trailing commas before closing
      .replace(/\r\n|\r/g, "\n");

    // If there are more single quotes than double quotes, try converting single->double
    const singleCount = (sanitized.match(/'/g) || []).length;
    const doubleCount = (sanitized.match(/"/g) || []).length;
    if (singleCount > doubleCount) {
      sanitized = sanitized.replace(/'/g, '"');
    }

    // Try to quote unquoted keys (simple heuristic)
    sanitized = sanitized.replace(/([,{\n\s])(\w+)\s*:/g, '$1"$2":');

    parsed = tryParse(sanitized);
    if (parsed) {
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.questions)) return parsed.questions;
      if (parsed && parsed.data && Array.isArray(parsed.data.questions)) return parsed.data.questions;
      if (parsed && Array.isArray(parsed.items)) return parsed.items;
      return [parsed];
    }

    // 4) Last resort: attempt to split by lines and build simple objects (very conservative)
    const lines = clean.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const maybeItems = [];
    for (const line of lines) {
      // match simple JSON-like entries: - {"question": "..."}
      const jsonMatch = line.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const p = tryParse(jsonMatch[0]);
        if (p) maybeItems.push(p);
      }
    }
    if (maybeItems.length) return maybeItems;

    return [];
  }

  /**
   * Generate interview questions with caching
   */
  async generateInterviewQuestions(jobPosition, jobDesc, jobExperience) {
    if (!jobPosition || !jobDesc || !jobExperience) {
      throw new Error("Missing required parameters: jobPosition, jobDesc or jobExperience");
    }

    // Create cache key from critical parameters
    const cacheKey = `questions_${jobPosition}_${jobExperience}`;
    
    // Check cache first
    const cachedQuestions = questionCache.get(cacheKey);
    if (cachedQuestions) {
      console.log(`[GeminiAI] Returning cached questions for position=${jobPosition}`);
      return cachedQuestions;
    }

    const techStack = this.extractTechStack(jobDesc);
    const prompt = this.generatePrompt(jobPosition, jobDesc, jobExperience, techStack);

    try {
      console.log(`[GeminiAI] Generating questions for role=${jobPosition} experience=${jobExperience}`);
      
      // Deduplicate concurrent requests for same questions
      const res = await questionCache.deduplicate(cacheKey, async () => {
        return await this.generateResponse({
          prompt,
          temperature: 0.25,
          maxOutputTokens: 1400,
        });
      });
      
      const text = res?.text ?? "";
      console.log(`[GeminiAI] Response received: ${String(text).length} chars`);

      const parsed = this.parseResponse(text);
      console.log(`[GeminiAI] Parsed items count=${parsed.length}`);

      if (Array.isArray(parsed) && parsed.length > 0) {
        const normalized = parsed.map((q) => ({
          question: q.question || q.q || q.prompt || "Question text not available",
          answer: q.answer || q.a || q.solution || "",
          difficulty: q.difficulty || q.level || "Medium",
          category: q.category || "Technical",
          topics: Array.isArray(q.topics)
            ? q.topics
            : q.topics
            ? String(q.topics).split(",").map((s) => s.trim())
            : [],
        }));
        
        // Cache the normalized response
        questionCache.set(cacheKey, normalized, 86400000); // 24 hours
        console.log(`[GeminiAI] Cached and returning ${normalized.length} questions`);
        return normalized;
      }

      console.warn("[GeminiAI] No valid questions parsed; returning empty array");
      return [];
    } catch (err) {
      const errorMsg = err?.message || String(err);
      if (errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("exceeded")) {
        console.error("[GeminiAI] Rate limit/quota error:", errorMsg);
      } else {
        console.error("[GeminiAI] Generation error:", errorMsg);
      }
      return [];
    }
  }

  generateFeedbackPrompt(question, userAnswer, correctAnswer) {
    return `You are an expert technical interviewer evaluating a candidate's answer.

QUESTION: ${question}

CORRECT/MODEL ANSWER: ${correctAnswer}

CANDIDATE'S ANSWER: ${userAnswer}

Your task:
1. Evaluate how well the candidate answered the question compared to the model answer
2. Identify strengths and areas of improvement
3. Provide constructive feedback
4. Rate the answer on a scale of 1-5 based on:
   - Accuracy and completeness (does it match key points in the model answer?)
   - Clarity of explanation
   - Understanding of concepts
   - Relevance to the question

Strict output requirement:
Return ONLY a single JSON object (no explanation, no markdown, no surrounding text):
{
  "feedback": "string (constructive feedback about what was done well and what could be improved, 2-3 sentences)",
  "strengths": ["array", "of", "key strengths"],
  "improvements": ["array", "of", "areas to improve"],
  "rating": "number between 1 and 5"
}

Example format:
{"feedback":"Strong understanding of REST principles with clear explanation of statelessness and scalability. Could have elaborated more on HATEOAS and error handling conventions.","strengths":["Clear concept understanding","Good use of examples"],"improvements":["More detail on error handling","Mention of security best practices"],"rating":4}`;
  }

  /**
   * Generate feedback with caching
   */
  async generateFeedback(question, userAnswer, correctAnswer) {
    if (!question || !userAnswer || !correctAnswer) {
      console.error("[GeminiAI] Missing parameters for feedback generation");
      return null;
    }

    // Create cache key - only cache if answers are exact (avoid cache pollution)
    // This prevents caching feedback for similar but different answers
    const answerHash = Math.abs(
      (userAnswer.substring(0, 50) + correctAnswer.substring(0, 50))
        .split('')
        .reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)
    );
    const cacheKey = `feedback_${answerHash}_${question.substring(0, 30)}`;

    // Check cache for identical or very similar feedback
    const cachedFeedback = feedbackCache.get(cacheKey);
    if (cachedFeedback) {
      console.log(`[GeminiAI] Returning cached feedback`);
      return cachedFeedback;
    }

    const prompt = this.generateFeedbackPrompt(question, userAnswer, correctAnswer);

    try {
      console.log(`[GeminiAI] Generating feedback for question`);

      const res = await this.generateResponse({
        prompt,
        temperature: 0.5,
        maxOutputTokens: 800,
      });

      const text = res?.text ?? "";
      console.log(`[GeminiAI] Feedback response: ${String(text).length} chars`);

      // Parse feedback response
      let clean = text.trim();
      clean = clean.replace(/```(?:json)?\n?([\s\S]*?)```/gi, "$1");
      clean = clean.replace(/`/g, "");
      clean = clean.replace(/,\s*([}\]])/g, "$1");

      try {
        const parsed = JSON.parse(clean);
        if (parsed && typeof parsed === "object") {
          console.log("[GeminiAI] Parsed feedback successfully");
          
          const feedbackResult = {
            feedback: parsed.feedback || "Answer recorded",
            strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
            improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
            rating: Math.max(1, Math.min(5, parseInt(parsed.rating) || 3))
          };
          
          // Cache the feedback result
          feedbackCache.set(cacheKey, feedbackResult, 3600000); // 1 hour
          return feedbackResult;
        }
      } catch (e) {
        console.error("[GeminiAI] Failed to parse feedback JSON:", e.message);
      }

      console.warn("[GeminiAI] Unable to parse feedback response; returning null");
      return null;
    } catch (err) {
      console.error("[GeminiAI] Feedback generation error:", err?.message || String(err));
      return null;
    }
  }
}

const geminiAI = new GeminiAI();

module.exports = {
  geminiAI,
  generateInterviewQuestion: async (jobPosition, jobDesc, jobExperience) => {
    // Use server-side environment variable
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }
    // Singleton reuse - init is idempotent when API key matches
    geminiAI.init(apiKey);
    return geminiAI.generateInterviewQuestions(jobPosition, jobDesc, jobExperience);
  },
  generateFeedback: async (question, userAnswer, correctAnswer) => {
    // Use server-side environment variable
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }
    // Singleton reuse - init is idempotent when API key matches
    geminiAI.init(apiKey);
    return geminiAI.generateFeedback(question, userAnswer, correctAnswer);
  },
  // Utility to get cache stats
  getCacheStats: () => ({
    questions: questionCache.getStats(),
    feedback: feedbackCache.getStats(),
  }),
  // Utility to clear cache if needed
  clearCache: () => {
    questionCache.clear();
    feedbackCache.clear();
    console.log("[GeminiAI] All caches cleared");
  },
};