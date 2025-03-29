"use client"
import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { db } from '@/utils/db'
import { MockInterview } from '@/utils/schema'
import { eq } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import moment from 'moment'
import { use } from 'react'

export default function InterviewDetails({ params }) {
    const { user } = useUser();
    const [interview, setInterview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Unwrap params at the component level
    const unwrappedParams = use(params);
    const interviewId = unwrappedParams.interviewId;

    useEffect(() => {
        const getInterviewDetails = async () => {
            if (!interviewId) {
                setError('Invalid interview ID');
                setLoading(false);
                return;
            }

            try {
                const result = await db.select()
                    .from(MockInterview)
                    .where(eq(MockInterview.mockId, interviewId));

                if (result && result.length > 0) {
                    const interviewData = result[0];
                    let questions = [];
                    try {
                        questions = JSON.parse(interviewData.jsonMockResp);
                        if (!Array.isArray(questions)) {
                            questions = [];
                        }
                    } catch (e) {
                        console.error('Error parsing questions:', e);
                        questions = [];
                    }
                    setInterview({
                        ...interviewData,
                        questions
                    });
                } else {
                    setError('Interview not found');
                }
            } catch (error) {
                console.error('Error fetching interview:', error);
                setError('Failed to load interview details');
            } finally {
                setLoading(false);
            }
        };

        getInterviewDetails();
    }, [interviewId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-red-500">{error}</div>
            </div>
        );
    }

    // Ensure we have valid data before rendering
    if (!interview) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-red-500">Invalid interview data</div>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8">
            <Card>
                <CardHeader>
                    <CardTitle>Interview Details</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div>
                            <h3 className="font-medium">Position</h3>
                            <p className="text-gray-600">{interview.jobPosition || 'Not specified'}</p>
                        </div>
                        <div>
                            <h3 className="font-medium">Experience Level</h3>
                            <p className="text-gray-600">{interview.jobExperience || 'Not specified'}</p>
                        </div>
                        <div>
                            <h3 className="font-medium">Job Description</h3>
                            <p className="text-gray-600">{interview.jobDesc || 'Not specified'}</p>
                        </div>
                        <div>
                            <h3 className="font-medium">Questions</h3>
                            <div className="space-y-4 mt-2">
                                {Array.isArray(interview.questions) && interview.questions.map((question, index) => (
                                    <div key={index} className="p-4 bg-gray-50 rounded-lg">
                                        <h3 className="font-medium text-gray-900">Question {index + 1}</h3>
                                        <p className="text-gray-600 mt-1">
                                            {typeof question === 'object' && question.question 
                                                ? question.question 
                                                : 'Question text not available'}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="mt-8 flex justify-end">
                <Link href={`/dashboard/interview/${interview.mockId}/start?mockId=${interview.mockId}`}>
                    <Button size="lg" className="gap-2">
                        Start Interview
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
