"use client"
import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { generateInterviewQuestion } from '@/utils/GemeniAIModal'
import { LoaderCircle, Plus, Briefcase, FileText, Clock } from 'lucide-react'
import { useUser } from '@clerk/nextjs'
import { db } from '@/utils/db'
import { MockInterview } from '@/utils/schema'
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

function AddNewInterview() {
  const [openDialog, setOpenDialog] = useState(false);
  const [jobPosition, setJobPosition] = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [jobExperience, setJobExperience] = useState("");
  const [loading, setLoading] = useState(false);
  const [jsonResponse, setJsonResponse] = useState([]);
  const { user } = useUser();
  const router = useRouter();

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    console.log('Starting interview generation...');

    try {
      if (!jobPosition || !jobDesc || !jobExperience) {
        toast.error("Please fill in all fields");
        setLoading(false);
        return;
      }


      // Use the more robust AI prompt and response cleaning logic
      console.log('Sending request to Gemini AI...');
      const InputPrompt = `Job Position: ${jobPosition}, Job Description: ${jobDesc}, Years of Experience: ${jobExperience}. \n\nBased on this information, please provide 5 interview questions with answers in JSON format.\n\nReturn ONLY a valid JSON array with the following structure (no markdown formatting, no code blocks, just pure JSON):\n[\n  {\n    \"question\": \"Your interview question here\",\n    \"answer\": \"The expected answer or explanation\"\n  },\n  {\n    \"question\": \"Another interview question\",\n    \"answer\": \"Another expected answer\"\n  }\n]\n\nMake sure the response is valid JSON that can be parsed directly.`;

      const questionResponse = await generateInterviewQuestion(jobPosition, jobDesc, jobExperience);
      let MockJsonResp = questionResponse;
      if (typeof MockJsonResp !== 'string') {
        MockJsonResp = JSON.stringify(MockJsonResp);
      }
      // Clean the response to handle various formatting issues
      MockJsonResp = MockJsonResp
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .replace(/^[\s\n]*{/, '{')
        .replace(/}[\s\n]*$/, '}')
        .replace(/^[\s\n]*\[/, '[')
        .replace(/\]\s\n]*$/, ']')
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
        .trim();

      let parsedResponse;
      try {
        parsedResponse = JSON.parse(MockJsonResp);
        if (!parsedResponse || typeof parsedResponse !== 'object') {
          throw new Error('Invalid response structure');
        }
        console.log('Successfully parsed JSON response');
      } catch (parseError) {
        console.error('JSON parsing error:', parseError);
        console.error('Raw response:', MockJsonResp);
        // Try to extract JSON from the response if it's wrapped in other text
        try {
          const jsonMatch = MockJsonResp.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const extractedJson = jsonMatch[0];
            parsedResponse = JSON.parse(extractedJson);

            MockJsonResp = extractedJson;
            console.log('Successfully extracted and parsed JSON from response');
          } else {
            throw new Error('No valid JSON found in response');
          }
        } catch (extractError) {
          console.error('Failed to extract JSON:', extractError);
          toast.error("Failed to generate interview questions. Please try again.");

          setLoading(false);
          return;
        }
      }

      setJsonResponse(MockJsonResp);


      if (!user?.primaryEmailAddress?.emailAddress) {
        toast.error("User information is missing. Please try again.");
        setLoading(false);
        return;
      }

      console.log('Inserting into database...');
      const mockId = uuidv4();
      const resp = await db.insert(MockInterview)
        .values({
          mockId: mockId,
          jsonMockResp: MockJsonResp,
          jobPosition: jobPosition,
          jobDesc: jobDesc,
          jobExperience: jobExperience,
          createdBy: user.primaryEmailAddress.emailAddress,
          createdAt: moment().format("DD-MM-YYYY")
        }).returning({ mockId: MockInterview.mockId });

      console.log('Database response:', resp);

      if (resp && resp[0]?.mockId) {
        console.log('Interview created successfully, redirecting...');
        toast.success("Interview created successfully!");
        setOpenDialog(false);
        router.push('/dashboard/interview/' + resp[0].mockId);
      } else {
        console.error('Database insertion failed - no response or mockId');
        throw new Error("Failed to create interview");
      }
    } catch (error) {
      console.error("Error:", error);
      console.error("Error details:", {
        jobPosition,
        jobDesc,
        jobExperience,
        userEmail: user?.primaryEmailAddress?.emailAddress
      });
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  function generateInterviewQuestionsFromResponse(response, jobPosition, jobDesc, jobExperience) {
    // Determine if this is a technical role
    const technicalKeywords = [
      'developer', 'engineer', 'programmer', 'frontend', 'backend', 
      'fullstack', 'software', 'devops', 'sre', 'security', 'data scientist', 'ml', 
      'ai', 'coding', 'code', 'java', 'javascript', 'python', 'typescript', 'c#', 
      'react', 'node', 'angular', 'vue', 'web', 'mobile', 'cloud', 'aws', 'azure', 
      'database', 'sql', 'nosql', 'dsa', 'algorithms', 'data structures', 'pandas', 'tensorflow'
    ];

    // Check if job position or description indicates a technical role
    const isTechnicalRole = technicalKeywords.some(keyword => 
      jobPosition.toLowerCase().includes(keyword.toLowerCase()) || 
      jobDesc.toLowerCase().includes(keyword.toLowerCase())
    );

    if (response.error) {
      // Fallback questions if there was an error
      if (isTechnicalRole) {
        // Technical fallback questions
        return generateTechnicalFallbackQuestions(jobPosition, jobDesc, jobExperience);
      } else {
        // Non-technical fallback questions
        return [
          {
            question: `Tell me about your experience as a ${jobPosition}.`,
            answer: "Look for a clear explanation of relevant experience and skills."
          },
          {
            question: `What specific skills or knowledge areas mentioned in the job description (${jobDesc}) are you most proficient in?`,
            answer: "Candidate should highlight specific skills that match the job requirements."
          },
          {
            question: "Can you describe a challenging project or situation you've handled recently?",
            answer: "Evaluate problem-solving abilities and domain expertise."
          },
          {
            question: "How do you stay updated with the latest trends in your field?",
            answer: "Look for commitment to continuous learning and professional development."
          },
          {
            question: "Do you have any questions about the role or company?",
            answer: "Assess the candidate's interest and research about the position."
          }
        ];
      }
    }

    // Use the first question from the AI response
    const firstQuestion = {
      question: response.question,
      answer: response.idealAnswer || response.solution || response.context
    };

    if (isTechnicalRole) {
      // For technical roles, generate additional technical questions based on job description
      const techSkills = extractTechnicalSkills(jobDesc);
      
      // Generate four more technical questions
      const additionalQuestions = generateAdditionalTechnicalQuestions(jobPosition, techSkills, jobExperience);
      
      return [firstQuestion, ...additionalQuestions];
    } else {
      // For non-technical roles, use more general additional questions
      const keyPoints = response.keyPoints || [];
      const additionalQuestions = [
        {
          question: `Based on your ${jobExperience} years of experience, how have you applied ${keyPoints[0] || 'your skills'} in your previous roles?`,
          answer: "Look for practical examples and applications of skills relevant to the job."
        },
        {
          question: `The job requires knowledge of ${jobDesc.split(' ').slice(0, 3).join(' ')}... How would you rate your expertise in this area?`,
          answer: "Evaluate honest self-assessment and depth of knowledge."
        },
        {
          question: "Tell me about a time when you faced a difficult problem at work. How did you solve it?",
          answer: "Assess problem-solving approach, creativity, and perseverance."
        },
        {
          question: "What are your career goals and how does this position align with them?",
          answer: "Look for alignment between candidate's aspirations and company objectives."
        }
      ];
      
      return [firstQuestion, ...additionalQuestions];
    }
  }

  // Helper function to extract technical skills from job description
  function extractTechnicalSkills(jobDesc) {
    // Convert job description to lowercase and split by non-word characters
    const words = jobDesc.toLowerCase().split(/\W+/);
    
    // Common technical skills to look for
    const techKeywords = ['python', 'java', 'javascript', 'typescript', 'react', 'angular', 'vue', 
      'node', 'express', 'mongodb', 'sql', 'mysql', 'postgresql', 'nosql', 'aws', 'azure', 'gcp',
      'docker', 'kubernetes', 'ci/cd', 'git', 'rest', 'graphql', 'ml', 'ai', 'machine learning',
      'data science', 'tensorflow', 'pytorch', 'pandas', 'numpy', 'scipy', 'hadoop', 'spark',
      'tableau', 'power bi', 'statistics', 'algorithms', 'data structures', 'oop', 'functional programming',
      'microservices', 'cloud', 'devops', 'agile', 'scrum', 'testing', 'ci/cd', 'linux', 'unix', 
      'shell', 'bash', 'powershell', 'c#', 'c++', 'rust', 'go', 'swift', 'kotlin', 'mobile', 'ios', 
      'android', 'react native', 'flutter', 'frontend', 'backend', 'fullstack'];
    
    // Find matching skills in the job description
    const matchedSkills = techKeywords.filter(skill => 
      jobDesc.toLowerCase().includes(skill.toLowerCase())
    );
    
    // Return the matched skills or a default set if none found
    return matchedSkills.length > 0 ? matchedSkills : ['coding', 'algorithms', 'problem-solving'];
  }

  // Helper function to generate technical fallback questions
  function generateTechnicalFallbackQuestions(jobPosition, jobDesc, jobExperience) {
    // Extract likely technical skills from the job description
    const techSkills = extractTechnicalSkills(jobDesc);
    
    return [
      {
        question: `Design a solution to implement a ${techSkills[0] || 'system'} that can handle large volumes of data efficiently.`,
        answer: "Look for architectural knowledge, scalability considerations, and specific technologies mentioned."
      },
      {
        question: `How would you optimize a slow-performing ${techSkills[1] || 'application'}? What tools and techniques would you use to identify and address performance bottlenecks?`,
        answer: "Evaluate troubleshooting skills, profiling tools knowledge, and optimization techniques."
      },
      {
        question: `Explain how you would implement error handling and logging in a ${techSkills[2] || 'production'} environment.`,
        answer: "Look for understanding of reliability engineering, monitoring strategies, and best practices."
      },
      {
        question: `Given your ${jobExperience} years of experience with ${techSkills[0] || 'technology'}, what's the most complex technical challenge you've solved?`,
        answer: "Assess technical depth, problem-solving approach, and hands-on experience."
      },
      {
        question: `What testing methodologies do you use to ensure your ${jobPosition.toLowerCase()} work is production-ready?`,
        answer: "Evaluate quality assurance knowledge, test-driven development understanding, and thoroughness."
      }
    ];
  }

  // Helper function to generate additional technical questions
  function generateAdditionalTechnicalQuestions(jobPosition, techSkills, jobExperience) {
    // Base questions on the extracted technical skills
    const questions = [];
    
    if (jobPosition.toLowerCase().includes('data scientist') || techSkills.some(skill => ['python', 'pandas', 'tensorflow', 'ml', 'ai', 'machine learning', 'data science'].includes(skill))) {
      // Data Science / ML specific questions
      questions.push(
        {
          question: `You need to build a classification model for a highly imbalanced dataset. How would you approach this problem and what metrics would you use to evaluate performance?`,
          answer: "Look for knowledge of sampling techniques (SMOTE, oversampling, undersampling), appropriate metrics (F1, precision-recall, AUC), and handling class imbalance strategies."
        },
        {
          question: `Explain the difference between supervised and unsupervised learning with specific examples of algorithms from each category that you've used in your projects.`,
          answer: "Candidate should clearly distinguish between the two types and demonstrate practical experience with algorithms like random forests, neural networks, k-means, etc."
        },
        {
          question: `How would you implement a data pipeline to process large datasets efficiently using ${techSkills.includes('pandas') ? 'pandas' : 'Python'} and other relevant tools?`,
          answer: "Look for understanding of data engineering concepts, memory optimization, parallel processing, and ETL workflows."
        },
        {
          question: `Describe how you would design and implement a recommendation system using collaborative filtering or content-based approaches. What challenges might you encounter?`,
          answer: "Evaluate understanding of recommendation algorithms, feature engineering for recommendations, and handling cold-start problems."
        }
      );
    } else if (techSkills.some(skill => ['frontend', 'react', 'angular', 'vue', 'javascript', 'typescript'].includes(skill))) {
      // Frontend specific questions
      questions.push(
        {
          question: `Explain how you would optimize the performance of a complex ${techSkills.includes('react') ? 'React' : 'JavaScript'} application with many components and state updates.`,
          answer: "Look for knowledge of memoization, virtual DOM optimization, code splitting, and state management optimization."
        },
        {
          question: `How would you implement a secure authentication system in a ${techSkills.includes('react') ? 'React' : 'frontend'} application? What security considerations are important?`,
          answer: "Evaluate understanding of JWT, OAuth, secure storage, CSRF protection, and frontend security best practices."
        },
        {
          question: `Describe your approach to writing maintainable CSS for large-scale applications. What methodologies or libraries do you prefer?`,
          answer: "Look for knowledge of CSS-in-JS, CSS modules, BEM, SASS/LESS, or other scalable CSS approaches."
        },
        {
          question: `How would you implement accessibility requirements in a web application? What tools and testing methods would you use?`,
          answer: "Assess knowledge of ARIA attributes, semantic HTML, screen reader compatibility, and accessibility testing tools."
        }
      );
    } else if (techSkills.some(skill => ['backend', 'api', 'server', 'java', 'node', 'express', 'python', 'c#', 'go'].includes(skill))) {
      // Backend specific questions
      questions.push(
        {
          question: `Design a RESTful API for a social media platform. Explain your resource structure, endpoints, and how you would handle authentication and authorization.`,
          answer: "Look for API design knowledge, RESTful principles, security considerations, and resource modeling."
        },
        {
          question: `How would you ensure your backend application can scale to handle millions of requests? What architectural patterns would you use?`,
          answer: "Evaluate understanding of horizontal scaling, caching strategies, load balancing, and stateless design."
        },
        {
          question: `Explain how you would implement database transactions and ensure data consistency in a distributed system.`,
          answer: "Look for knowledge of ACID properties, distributed transactions, eventual consistency, and handling race conditions."
        },
        {
          question: `How would you secure a backend API against common threats like SQL injection, XSS, and CSRF attacks?`,
          answer: "Assess security awareness, input validation practices, and framework-specific security features."
        }
      );
    } else {
      // Generic technical questions if no specific category is detected
      questions.push(
        {
          question: `Explain how you would approach debugging a complex issue in a ${techSkills[0] || 'technical'} system that only occurs in production.`,
          answer: "Look for methodical debugging approach, use of monitoring tools, and production debugging experience."
        },
        {
          question: `What strategies do you use for keeping your ${techSkills[1] || 'technical'} skills current and learning new technologies?`,
          answer: "Assess commitment to continuous learning, self-improvement, and technology awareness."
        },
        {
          question: `Describe a time when you had to make a technical decision with incomplete information. How did you approach it?`,
          answer: "Evaluate decision-making process, risk assessment abilities, and pragmatism."
        },
        {
          question: `How do you ensure code quality and maintainability in your ${jobPosition} projects?`,
          answer: "Look for knowledge of code reviews, testing, documentation, and coding standards."
        }
      );
    }
    
    // If we don't have enough questions, add generic technical ones
    while (questions.length < 4) {
      questions.push({
        question: `How would you implement and optimize a system using ${techSkills[questions.length % techSkills.length] || 'technology'} to solve a complex business problem?`,
        answer: "Look for technical depth, architectural knowledge, and problem-solving skills."
      });
    }
    
    return questions;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className='p-8 border rounded-lg bg-white hover:shadow-lg cursor-pointer transition-all duration-200'
        onClick={() => setOpenDialog(true)}>
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="p-4 bg-blue-50 rounded-full">
            <Plus className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className='font-semibold text-xl text-gray-800'>Start New Interview</h2>
          <p className="text-gray-500 text-center">Create a new AI-powered mock interview session</p>
        </div>
      </div>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle className='text-2xl font-bold text-gray-900'>Create New Interview</DialogTitle>
            <DialogDescription className="text-gray-600">
              Fill in the details below to start your AI-powered mock interview
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="mt-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Job Position
                </label>
                <Input
                  value={jobPosition}
                  placeholder="e.g., Senior Full Stack Developer"
                  required
                  onChange={(event) => setJobPosition(event.target.value)}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Job Description
                </label>
                <Textarea
                  value={jobDesc}
                  placeholder="Describe the role, required skills, and tech stack (e.g., React, Node.js, AWS)"
                  required
                  onChange={(event) => setJobDesc(event.target.value)}
                  className="min-h-[100px]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Years of Experience
                </label>
                <Input
                  value={jobExperience}
                  placeholder="e.g., 5"
                  type="number"
                  min="0"
                  max="40"
                  required
                  onChange={(event) => setJobExperience(event.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            <div className='flex gap-4 justify-end pt-4'>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setOpenDialog(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={loading}
                className="min-w-[120px]"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    <span>Generating...</span>
                  </div>
                ) : (
                  "Start Interview"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AddNewInterview;
