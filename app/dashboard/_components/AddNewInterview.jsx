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
import { chatSession } from '@/utils/GemeniAIModal'
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
        return;
      }

      console.log('Sending request to Gemini AI...');
      const InputPrompt = `Job Position: ${jobPosition}, Job Description: ${jobDesc}, Years of Experience: ${jobExperience}. 

Based on this information, please provide 5 interview questions with answers in JSON format.

Return ONLY a valid JSON array with the following structure (no markdown formatting, no code blocks, just pure JSON):
[
  {
    "question": "Your interview question here",
    "answer": "The expected answer or explanation"
  },
  {
    "question": "Another interview question",
    "answer": "Another expected answer"
  }
]

Make sure the response is valid JSON that can be parsed directly.`;

      const result = await chatSession.sendMessage(InputPrompt);
      console.log('Received response from Gemini AI');
      
      let MockJsonResp = result.response.text();
      console.log('Raw AI response:', MockJsonResp.substring(0, 200) + '...');
      
      // Clean the response to handle various formatting issues
      MockJsonResp = MockJsonResp
        .replace(/```json\n?/g, '')  // Remove opening json code block
        .replace(/```\n?/g, '')      // Remove closing code block
        .replace(/^[\s\n]*{/, '{')   // Remove leading whitespace before opening brace
        .replace(/}[\s\n]*$/, '}')   // Remove trailing whitespace after closing brace
        .replace(/^[\s\n]*\[/, '[')  // Remove leading whitespace before opening bracket
        .replace(/\]\s\n]*$/, ']')   // Remove trailing whitespace after closing bracket
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
        .trim();

      console.log('Cleaned response:', MockJsonResp.substring(0, 200) + '...');

      let parsedResponse;
      try {
        parsedResponse = JSON.parse(MockJsonResp);
        // Validate that we have a valid structure
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
            MockJsonResp = extractedJson; // Update the cleaned response
            console.log('Successfully extracted and parsed JSON from response');
          } else {
            throw new Error('No valid JSON found in response');
          }
        } catch (extractError) {
          console.error('Failed to extract JSON:', extractError);
          toast.error("Failed to generate interview questions. Please try again.");
          return;
        }
      }

      setJsonResponse(MockJsonResp);

      // Validate required fields before database insertion
      if (!user?.primaryEmailAddress?.emailAddress) {
        toast.error("User information is missing. Please try again.");
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
