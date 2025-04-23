const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");

// Ensure API key is properly accessed and validated
const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

// Check if API key is defined
if (!apiKey) {
  console.error("Gemini API key is not defined. Please check your .env file.");
}

const genAI = new GoogleGenerativeAI(apiKey);

// Configuration for the model
const generationConfig = {
  temperature: 0.7, // Lower temperature for more predictable outputs
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 2048, // Reduced to ensure it fits within free tier limits
  responseMimeType: "text/plain",
};

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

// Simple caching mechanism for API responses
const responseCache = new Map();
const MAX_CACHE_SIZE = 20; // Limit cache size to avoid memory issues

// Try multiple models in order of preference
let chatSession;

// Create a promise with timeout to prevent hanging on API calls
const withTimeout = (promise, timeoutMs) => {
  const timeoutPromise = new Promise((_, reject) => {
    const timeoutId = setTimeout(() => {
      clearTimeout(timeoutId); // Clean up resources
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  
  return Promise.race([promise, timeoutPromise]);
};

// Add a retry mechanism for API calls
const withRetry = async (fn, maxRetries = 3, delay = 2000, timeoutMs = 30000) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Use progressively longer timeouts for retries
      const currentTimeout = timeoutMs * Math.min(attempt, 2); // Scale timeout but don't make it too long
      
      return await withTimeout(fn(), currentTimeout);
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        // Use exponential backoff, but cap at a reasonable delay
        const backoffDelay = Math.min(delay * Math.pow(1.5, attempt - 1), 10000);
        console.log(`Retrying in ${backoffDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
  }
  
  throw lastError; // Throw the last error if all retries fail
};

try {
  // First try gemini-1.5-flash for better performance
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash", // Faster model
  });
  
  chatSession = model.startChat({
    generationConfig,
    safetySettings,
  });
  
  console.log("Using gemini-1.5-flash model");
} catch (error) {
  console.error("Error initializing gemini-1.5-flash model:", error);
  
  try {
    // Fallback to gemini-pro
    const fallbackModel = genAI.getGenerativeModel({
      model: "gemini-pro",
    });
    
    chatSession = fallbackModel.startChat({
      generationConfig,
      safetySettings,
    });
    
    console.log("Switched to fallback model: gemini-pro");
  } catch (fallbackError) {
    console.error("Failed to initialize fallback model:", fallbackError);
    
    // Create a minimal mock chat session that returns error responses
    chatSession = {
      sendMessage: async () => ({
        response: {
          text: () => JSON.stringify({
            error: "Could not initialize Gemini AI model. Please check your API key and quota."
          })
        }
      })
    };
  }
}

// Helper to create a cache key from input parameters
const createCacheKey = (jobPosition, jobDesc, jobExperience) => {
  // Create a stable key by trimming and normalizing the inputs
  const posKey = jobPosition?.toLowerCase().trim().substring(0, 30) || '';
  const expKey = jobExperience?.toString().trim().substring(0, 10) || '';
  // Use only the first part of the job description to keep the key size reasonable
  const descKey = jobDesc?.toLowerCase().trim().substring(0, 50) || ''; 
  
  return `${posKey}:${descKey}:${expKey}`;
};

// Helper to manage the cache size
const addToCache = (key, value) => {
  // If cache is full, remove oldest entry
  if (responseCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = responseCache.keys().next().value;
    responseCache.delete(oldestKey);
  }
  responseCache.set(key, value);
};

/**
 * Generates interview questions for any job role based on position, description, and experience.
 * Handles both technical and non-technical roles appropriately.
 * 
 * @param {string} jobPosition - The job position title
 * @param {string} jobDesc - Job description containing skills and requirements
 * @param {string|number} jobExperience - Years of experience 
 * @returns {Promise<Object>} - Returns a structured question response
 */
const generateInterviewQuestion = async (jobPosition, jobDesc, jobExperience) => {
  // Verify inputs
  if (!jobPosition || !jobDesc) {
    console.error("Missing required parameters: jobPosition or jobDesc");
    return {
      question: "Could not generate a question due to missing parameters.",
      error: "Missing job position or description."
    };
  }

  // Default experience to "entry level" if not provided
  const experience = jobExperience || "entry level";
  
  // Check if we have a cached response
  const cacheKey = createCacheKey(jobPosition, jobDesc, jobExperience);
  if (responseCache.has(cacheKey)) {
    console.log("Using cached interview question");
    return responseCache.get(cacheKey);
  }
  
  // Determine if the role is technical or non-technical by checking both job position and description
  const technicalKeywords = [
    'developer', 'engineer', 'programming', 'programmer', 'frontend', 'backend', 
    'fullstack', 'software', 'devops', 'sre', 'security', 'data scientist', 'ml', 
    'ai', 'coding', 'code', 'java', 'javascript', 'python', 'typescript', 'c#', 
    'react', 'node', 'angular', 'vue', 'web', 'mobile', 'cloud', 'aws', 'azure', 
    'database', 'sql', 'nosql', 'dsa', 'algorithms', 'data structures'
  ];
  
  // Check if either job position or description contains technical keywords
  const isTechnicalRole = technicalKeywords.some(keyword => 
    jobPosition.toLowerCase().includes(keyword.toLowerCase()) || 
    jobDesc.toLowerCase().includes(keyword.toLowerCase())
  );
  
  let prompt;
  
  if (isTechnicalRole) {
    // Enhanced prompt for technical roles with better test cases and solutions
    prompt = `Generate a high-quality technical interview question for a ${jobPosition} position with ${experience} experience level.
    The job description mentions: ${jobDesc}
    
    The question should be specifically about technical skills, coding, or problem-solving related to the role.
    
    Return the following JSON without any markdown or code blocks:
    {
      "question": "A detailed technical problem to solve with all necessary context and constraints",
      "context": "A paragraph explaining why this question is relevant for the role, what skills it tests, and how it relates to real-world scenarios",
      "solution": "Complete working code solution with detailed explanation of the approach. Include comments and explain the time and space complexity.",
      "detailedFeedback": "Comprehensive feedback that explains the optimal solution, alternative approaches, common mistakes, and performance considerations. This should be educational and help the candidate improve.",
      "keyPoints": ["key technical concept 1", "key technical concept 2", "key technical concept 3"],
      "complexity": {
        "time": "Time complexity with explanation (e.g., O(n) because...)",
        "space": "Space complexity with explanation (e.g., O(1) because...)"
      },
      "testCases": [
        {
          "input": "Sample input formatted as a string or JSON that can be parsed",
          "output": "Expected output for this input",
          "explanation": "Why this output is expected for this input"
        },
        {
          "input": "Another sample input",
          "output": "Expected output for this input",
          "explanation": "Why this output is expected for this input"
        },
        {
          "input": "Edge case input",
          "output": "Expected output for this edge case",
          "explanation": "Why this output is expected for this edge case"
        }
      ]
    }`;
  } else {
    // Enhanced prompt for non-technical roles with more detailed feedback
    prompt = `Generate a detailed interview question for a ${jobPosition} position with ${experience} experience level.
    The job description mentions: ${jobDesc}
    
    Return the following JSON without any markdown or code blocks:
    {
      "question": "A thoughtful and challenging interview question for this role",
      "context": "A paragraph explaining why this question is important for the role and what skills or qualities it assesses",
      "keyPoints": ["key point 1", "key point 2", "key point 3", "key point 4", "key point 5"],
      "idealAnswer": "A comprehensive model answer that demonstrates excellence in the required skills",
      "assessmentCriteria": ["criterion 1 - what to look for", "criterion 2", "criterion 3", "criterion 4"],
      "followUpQuestions": ["Question to dig deeper into the candidate's response", "Another follow-up question"],
      "detailedFeedback": "Comprehensive feedback on how to evaluate responses, what constitutes a strong vs. weak answer, and guidance for interviewers on probing for depth."
    }`;
  }

  try {
    console.log(`Generating question for: ${jobPosition} (${isTechnicalRole ? 'Technical' : 'Non-technical'})`);
    
    // Use the retry mechanism instead of a simple timeout
    // Start with a 30-second timeout that will increase with retries
    const result = await withRetry(
        () => chatSession.sendMessage(prompt),
        3,  // Maximum 3 attempts
        2000,  // Start with 2 second delay between retries
        30000  // Initial timeout of 30 seconds
    );
    
    const response = await result.response;
    const text = response.text();
    
    console.log("Raw response received");
    
    // More robust JSON parsing with multiple fallbacks
    try {
      // First attempt: Clean and parse as is
      let cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanText);
      // Cache the successful result
      addToCache(cacheKey, parsed);
      return parsed;
    } catch (firstParseError) {
      try {
        // Second attempt: Try to extract JSON object from text
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          // Cache the successful result
          addToCache(cacheKey, parsed);
          return parsed;
        }
        throw new Error("No JSON object found in response");
      } catch (secondParseError) {
        console.error("JSON parsing errors:", firstParseError, secondParseError);
        
        // Create an enhanced fallback response based on the role type
        if (isTechnicalRole) {
          return {
            question: `Implement a function to solve the following problem: Given an array of integers, find the pair with the largest sum. Return the indices of these two numbers.`,
            context: `This question tests algorithm design, array manipulation, and optimization skills required for the ${jobPosition} role.`,
            solution: `function findPairWithLargestSum(arr) {
  if (!arr || arr.length < 2) return null;
  
  let maxSum = arr[0] + arr[1];
  let maxPair = [0, 1];
  
  // Check all possible pairs
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      const currentSum = arr[i] + arr[j];
      if (currentSum > maxSum) {
        maxSum = currentSum;
        maxPair = [i, j];
      }
    }
  }
  
  return maxPair;
}`,
            detailedFeedback: `This problem tests your ability to work with arrays and optimize algorithms. While the brute force approach works in O(n²) time by checking all pairs, more efficient approaches exist. Look for opportunities to optimize by sorting the array first or using a hash map to find complements. Consider edge cases like empty arrays, arrays with duplicate values, and negative numbers. A strong solution will handle all these cases and have optimal time complexity.`,
            keyPoints: ["Algorithm design", "Array manipulation", "Time complexity optimization", "Edge case handling"],
            complexity: {
              time: "O(n²) in the brute force approach because we check every possible pair",
              space: "O(1) as we only store the indices of the maximum pair"
            },
            testCases: [
              {
                input: "[1, 3, 5, 7, 9]",
                output: "[3, 4]",
                explanation: "7 + 9 = 16, which is the largest sum. These values are at indices 3 and 4."
              },
              {
                input: "[-5, -2, 1, 3]",
                output: "[2, 3]",
                explanation: "1 + 3 = 4, which is the largest sum. These values are at indices 2 and 3."
              },
              {
                input: "[10, 10]",
                output: "[0, 1]",
                explanation: "With only two elements, the pair is indices 0 and 1."
              }
            ],
            error: "Original response could not be parsed. Using fallback question."
          };
        } else {
          return {
            question: `Describe a challenging situation you faced in your previous role and how you resolved it. What would you do differently if you encountered a similar situation now?`,
            context: "This behavioral question helps assess problem-solving abilities, self-awareness, and growth mindset - all critical for success in this role.",
            keyPoints: ["Problem identification", "Solution implementation", "Stakeholder management", "Lessons learned", "Personal growth"],
            idealAnswer: "A strong answer will clearly describe the situation and challenges, explain the specific actions taken by the candidate, measurable results achieved, and demonstrate reflection on what could be improved. The candidate should show ownership of the problem and solution rather than blaming others.",
            assessmentCriteria: ["Problem complexity and relevance", "Actions taken and ownership", "Results achieved and quantification", "Self-reflection and growth", "Communication clarity"],
            followUpQuestions: ["What resources did you need to resolve the situation?", "How did you convince stakeholders to support your approach?"],
            detailedFeedback: "When evaluating responses, look for STAR method structure (Situation, Task, Action, Result) plus reflection. Strong candidates will provide specific details rather than vague generalities. They should demonstrate how they've grown from the experience. Weak answers will lack specifics, show little ownership, or fail to identify learnings. If answers focus entirely on technical solutions without addressing people/process factors, probe further on stakeholder management.",
            error: "Original response could not be parsed. Using fallback question."
          };
        }
      }
    }
  } catch (error) {
    console.error('Error generating interview question:', error);
    const errorMessage = error.message || "Unknown error";
    
    // Check for network or timeout errors
    const isNetworkError = errorMessage.includes('network') || 
                          errorMessage.includes('timeout') || 
                          errorMessage.includes('connection') ||
                          errorMessage.includes('offline');
    
    // Return an enhanced fallback response with error information
    if (isTechnicalRole) {
      return {
        question: "Write a function that takes a string as input and returns true if the string is a palindrome, false otherwise. A palindrome is a word that reads the same backward as forward.",
        context: "This question tests basic string manipulation, a fundamental skill for any technical role.",
        solution: `function isPalindrome(str) {
  // Remove non-alphanumeric characters and convert to lowercase
  const cleanStr = str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  
  // Compare with its reverse
  const reversed = cleanStr.split('').reverse().join('');
  return cleanStr === reversed;
}`,
        detailedFeedback: "This problem tests understanding of string operations and algorithm implementation. A strong solution handles edge cases like empty strings, mixed case, and non-alphanumeric characters. While the naive approach is to reverse the string and compare, optimized solutions might use two pointers moving from both ends toward the center, stopping early if a mismatch is found. This approach is more efficient for long strings as it doesn't require creating a reversed copy.",
        keyPoints: ["String manipulation", "Edge case handling", "Algorithm optimization"],
        complexity: {
          time: "O(n) where n is the string length",
          space: "O(n) for storing the cleaned and reversed strings"
        },
        testCases: [
          {
            input: "\"racecar\"",
            output: "true",
            explanation: "\"racecar\" reads the same backward as forward"
          },
          {
            input: "\"A man, a plan, a canal: Panama\"",
            output: "true",
            explanation: "After removing spaces and punctuation, \"amanaplanacanalpanama\" is a palindrome"
          },
          {
            input: "\"hello\"",
            output: "false",
            explanation: "\"hello\" is not the same as \"olleh\""
          }
        ],
        error: errorMessage
      };
    } else {
      return {
        question: "How do you prioritize competing tasks when you have multiple deadlines approaching simultaneously?",
        context: "This question assesses time management, decision-making, and ability to work under pressure.",
        keyPoints: ["Task assessment", "Prioritization framework", "Stakeholder communication", "Resource allocation", "Stress management"],
        idealAnswer: "A strong answer will describe a systematic approach to evaluating task importance and urgency, demonstrate clear decision-making criteria, explain how they communicate changes to stakeholders, and show adaptability when priorities shift.",
        assessmentCriteria: ["Methodology for prioritization", "Communication strategy", "Adaptability", "Results focus"],
        followUpQuestions: ["How do you handle stakeholder disappointment when their project isn't prioritized?", "Can you give a specific example of when you had to reprioritize quickly?"],
        detailedFeedback: "Look for candidates who balance both urgency and importance in their prioritization, not just focusing on whoever is shouting loudest. Strong candidates will proactively communicate changes rather than avoiding difficult conversations. They should demonstrate specific techniques rather than generic statements about 'being organized'. Weak answers focus only on working longer hours rather than making strategic decisions.",
        error: errorMessage
      };
    }
  }
};

// Export the functions
module.exports = {
  generateInterviewQuestion,
  // Keep the original function name for backward compatibility
  generateCodingQuestion: generateInterviewQuestion
};