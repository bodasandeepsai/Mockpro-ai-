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

    try {
      if (!jobPosition || !jobDesc || !jobExperience) {
        toast.error("Please fill in all fields");
        return;
      }

      const InputPrompt = `Job Position: ${jobPosition}, Job Description: ${jobDesc}, Years of Experience: ${jobExperience}. Based on this information, please provide 5 interview questions with answers in JSON format.`;

      const result = await chatSession.sendMessage(InputPrompt);
      const MockJsonResp = result.response.text().replace('```json', '').replace('```', '');

      try {
        JSON.parse(MockJsonResp); // Validate JSON
      } catch (error) {
        toast.error("Failed to generate interview questions. Please try again.");
        return;
      }

      setJsonResponse(MockJsonResp);

      const resp = await db.insert(MockInterview)
        .values({
          mockId: uuidv4(),
          jsonMockResp: MockJsonResp,
          jobPosition: jobPosition,
          jobDesc: jobDesc,
          jobExperience: jobExperience,
          createdBy: user?.primaryEmailAddress?.emailAddress,
          createdAt: moment().format("DD-MM-YYYY")
        }).returning({ mockId: MockInterview.mockId });

      if (resp && resp[0]?.mockId) {
        toast.success("Interview created successfully!");
        setOpenDialog(false);
        router.push('/dashboard/interview/' + resp[0].mockId);
      } else {
        throw new Error("Failed to create interview");
      }
    } catch (error) {
      console.error("Error:", error);
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
