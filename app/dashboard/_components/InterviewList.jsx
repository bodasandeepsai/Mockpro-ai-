"use client"
import { db, getDb } from '@/utils/db';
import { MockInterview } from '@/utils/schema';
import { useUser } from '@clerk/nextjs'
import { desc, eq } from 'drizzle-orm';
import React, { useEffect, useState } from 'react'
import InterviewItemCard from './InterviewItemCard';
import { LoaderCircle } from 'lucide-react';

function InterviewList() {
    const {user} = useUser();
    const [interviewList, setInterviewList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Fetch all interviews without pagination
    useEffect(() => {
        const fetchInterviews = async () => {
            if (!user?.primaryEmailAddress?.emailAddress) return;
            
            try {
                setLoading(true);
                
                // Get all interviews for this user without limit
                const result = await db.select()
                    .from(MockInterview)
                    .where(eq(MockInterview.createdBy, user.primaryEmailAddress.emailAddress))
                    .orderBy(desc(MockInterview.id));
                
                // Process the interviews to include question count
                const processedInterviews = result.map(interview => {
                    let questionCount = 0;
                    try {
                        const questions = JSON.parse(interview.jsonMockResp || '[]');
                        questionCount = Array.isArray(questions) ? questions.length : 0;
                    } catch (err) {
                        console.error("Error parsing questions for interview:", interview.mockId, err);
                    }
                    
                    return {
                        ...interview,
                        questionCount: questionCount + 1, // +1 for coding question
                    };
                });
                
                setInterviewList(processedInterviews);
                setError(null);
            } catch (err) {
                console.error("Error fetching interviews:", err);
                setError("Failed to load interviews. Please refresh and try again.");
            } finally {
                setLoading(false);
            }
        };
        
        if (user) {
            fetchInterviews();
        }
    }, [user]);

    return (
        <div>
            <h2 className='font-medium text-xl'>Previous mock Interviews</h2>

            {error && (
                <div className="text-red-500 my-3">{error}</div>
            )}

            {loading ? (
                <div className="flex justify-center items-center h-40">
                    <LoaderCircle className="h-8 w-8 animate-spin text-gray-400" />
                </div>
            ) : interviewList.length === 0 ? (
                <div className="text-gray-500 my-5 text-center p-8 border border-dashed rounded-md">
                    No interviews found. Create a new interview to get started!
                </div>
            ) : (
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 my-3'>
                    {interviewList.map((interview, index) => (
                        <InterviewItemCard 
                            interview={interview}
                            key={`interview-${interview.mockId}-${index}`} 
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

export default InterviewList
