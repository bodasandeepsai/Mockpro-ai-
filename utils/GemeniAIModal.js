const {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
  } = require("@google/generative-ai");
  
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey);
  
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
  });
  
  const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
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
 
    export const chatSession = model.startChat({
      generationConfig,
      safetySettings,
    });
  
export const generateCodingQuestion = async (jobPosition, jobDesc, jobExperience) => {
    const prompt = `Generate a coding question for a ${jobPosition} position with ${jobExperience} years of experience. 
    The job description is: ${jobDesc}
    
    Please provide:
    1. A clear problem statement
    2. The expected input/output format
    3. Example test cases
    4. The solution in JavaScript
    5. Time and space complexity analysis
    
    Return ONLY a JSON object with the following structure (no markdown formatting or code blocks):
    {
        "question": "problem statement",
        "inputFormat": "description of input format",
        "outputFormat": "description of output format",
        "testCases": [
            {
                "input": "example input",
                "output": "expected output",
                "explanation": "explanation of the test case"
            }
        ],
        "solution": "complete solution code",
        "complexity": {
            "time": "time complexity analysis",
            "space": "space complexity analysis"
        }
    }`;

    try {
        const result = await chatSession.sendMessage(prompt);
        const response = await result.response;
        const text = response.text();
        // Clean the response text to ensure it's valid JSON
        const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(cleanText);
    } catch (error) {
        console.error('Error generating coding question:', error);
        throw error;
    }
};
  
    