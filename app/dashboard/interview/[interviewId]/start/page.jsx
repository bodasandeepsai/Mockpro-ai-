"use client";
import { useEffect, useState } from "react";
import { db } from "@/utils/db";
import { MockInterview, UserAnswer } from "@/utils/schema";
import { eq } from "drizzle-orm";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import RecordAnsSection from "./_components/RecordAnsSection";
import QuestionsSection from "./_components/QuestionsSection";
import CodeEditor from "./_components/CodeEditor";
import WebcamSection from "./_components/WebcamSection";
import { generateCodingQuestion } from "@/utils/GemeniAIModal";
import { useUser } from "@clerk/nextjs";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { use } from 'react'

export default function StartInterview({ params }) {
    const { user } = useUser();
    const [interviewDetails, setInterviewDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [codingQuestion, setCodingQuestion] = useState(null);
    const router = useRouter();
    const searchParams = useSearchParams();
    const mockId = searchParams.get('mockId');

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
                    const interview = result[0];
                    let parsedQuestions = [];
                    
                    try {
                        parsedQuestions = JSON.parse(interview.jsonMockResp);
                        if (!Array.isArray(parsedQuestions)) {
                            parsedQuestions = [];
                        }
                    } catch (e) {
                        console.error('Error parsing questions:', e);
                        parsedQuestions = [];
                    }

                    // Generate coding question
                    const codingQ = await generateCodingQuestion(
                        interview.jobPosition,
                        interview.jobDesc,
                        interview.jobExperience
                    );

                    setInterviewDetails(interview);
                    setQuestions(parsedQuestions);
                    setCodingQuestion(codingQ);
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

    const handleNext = () => {
        if (currentQuestionIndex < questions.length) {
            setCurrentQuestionIndex(prev => prev + 1);
        }
    };

    const handlePrevious = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(prev => prev - 1);
        }
    };

    const handleFinishInterview = () => {
        router.push(`/dashboard/interview/${interviewId}/feedback?mockId=${mockId}`);
    };

    const handleSaveCode = async (code) => {
        if (!user?.primaryEmailAddress?.emailAddress || !codingQuestion) return;

        try {
            await db.insert(UserAnswer).values({
                mockIdref: mockId,
                question: codingQuestion.question,
                userAns: code,
                correctAns: codingQuestion.solution,
                feedback: `Time Complexity: ${codingQuestion.complexity.time}\nSpace Complexity: ${codingQuestion.complexity.space}`,
                userEmail: user.primaryEmailAddress.emailAddress,
                createdAt: new Date().toISOString(),
                isCodingQuestion: true,
                codeLanguage: 'javascript',
                testCases: JSON.stringify(codingQuestion.testCases)
            });
            toast.success('Code saved successfully!');
            handleFinishInterview();
        } catch (error) {
            console.error('Error saving code:', error);
            toast.error('Failed to save code');
        }
    };

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

    if (!interviewDetails || !questions.length) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-red-500">Invalid interview data</div>
            </div>
        );
    }

    const isLastQuestion = currentQuestionIndex === questions.length;
    const currentQuestion = isLastQuestion ? codingQuestion : questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / (questions.length + 1)) * 100;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold text-gray-900">Mock Interview</h1>
                    <p className="text-sm text-gray-500">
                        {interviewDetails?.jobPosition} - {interviewDetails?.jobExperience} years
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => router.push('/dashboard')}
                    className="flex items-center gap-2"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Dashboard
                </Button>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                        Question {currentQuestionIndex + 1} of {questions.length + 1}
                    </span>
                    <span className="text-gray-600">{Math.round(progress)}% Complete</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-blue-600 transition-all duration-300 ease-in-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column - Questions and Recording */}
                <div className="lg:col-span-8 space-y-6">
                    

                    {/* Recording/Code Section */}
                    <Card className="bg-white shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-xl">
                                {isLastQuestion ? 'Coding Question' : 'Record Your Answer'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isLastQuestion ? (
                                <CodeEditor
                                    question={codingQuestion?.question}
                                    onSave={handleSaveCode}
                                />
                            ) : (
                                <RecordAnsSection
                                    question={currentQuestion}
                                    mockId={mockId}
                                    onNext={handleNext}
                                />
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column - Webcam */}
                <div className="lg:col-span-4">
                    <Card className="bg-white shadow-sm sticky top-6">
                        <CardContent className="p-6">
                            <WebcamSection />
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Navigation Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <Button
                        variant="outline"
                        onClick={handlePrevious}
                        disabled={currentQuestionIndex === 0}
                        className="flex items-center gap-2"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                    </Button>
                    <Button
                        onClick={isLastQuestion ? handleFinishInterview : handleNext}
                        className="flex items-center gap-2"
                    >
                        {isLastQuestion ? (
                            <>
                                Finish Interview
                                <ArrowRight className="h-4 w-4" />
                            </>
                        ) : (
                            <>
                                Next
                                <ChevronRight className="h-4 w-4" />
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
