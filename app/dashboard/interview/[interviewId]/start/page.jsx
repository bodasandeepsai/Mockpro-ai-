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
import WebcamSection from "./_components/WebcamSection";
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

                    // only shortlist first five questions (all theory by design)
                    setInterviewDetails(interview);
                    setQuestions(parsedQuestions.slice(0, 5));
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
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        } else {
            handleFinishInterview();
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
        // coding question removed; stubbed out
        return;
        /*

        try {
            // Extract detailed feedback from the AI model's response
            let feedbackMessage = '';
            
            // Use the detailed feedback from the AI if available
            if (codingQuestion.detailedFeedback) {
                feedbackMessage = codingQuestion.detailedFeedback;
            } else if (codingQuestion.complexity) {
                // Fallback to complexity-based feedback
                const timeComplexity = codingQuestion.complexity.time || 'Not provided';
                const spaceComplexity = codingQuestion.complexity.space || 'Not provided';
                feedbackMessage = `Time Complexity: ${timeComplexity}\nSpace Complexity: ${spaceComplexity}`;
            } else {
                // Minimal fallback feedback
                feedbackMessage = 'Complexity analysis not available for this question.';
            }
            
            // Safely handle testCases
            const testCasesStr = codingQuestion.testCases ? 
                JSON.stringify(codingQuestion.testCases) : 
                JSON.stringify([]);
            
            // Execute user code against test cases
            let userCodeResults = [];
            
            if (codingQuestion.testCases && Array.isArray(codingQuestion.testCases)) {
                try {
                    // Create a safe execution environment for the user's code
                    // We use a function constructor instead of eval for slightly better isolation
                    let userFunction;
                    try {
                        // Create a function from the user's code
                        // This assumes the code defines a function called solution
                        // We wrap it in a try-catch for safety
                        userFunction = new Function(`
                            try {
                                ${code}
                                if (typeof solution !== 'function') {
                                    throw new Error('Your code must define a function named "solution"');
                                }
                                return solution;
                            } catch (e) {
                                throw new Error('Error in your code: ' + e.message);
                            }
                        `)();
                    } catch (codeError) {
                        // If we can't create the function, add error to all test cases
                        userCodeResults = codingQuestion.testCases.map(testCase => ({
                            input: testCase.input,
                            expected: testCase.output,
                            output: `Error: ${codeError.message}`,
                            passed: false,
                            error: codeError.message
                        }));
                    }

                    // If we successfully created the function, test it against each test case
                    if (userFunction) {
                        userCodeResults = codingQuestion.testCases.map(testCase => {
                            try {
                                // Parse the input based on its format
                                let testInput;
                                try {
                                    // Try to parse as JSON first
                                    testInput = JSON.parse(testCase.input);
                                } catch (e) {
                                    // If not valid JSON, use as is
                                    testInput = testCase.input;
                                    
                                    // Try to eval if it looks like an array or object string
                                    if ((testCase.input.startsWith('[') && testCase.input.endsWith(']')) ||
                                        (testCase.input.startsWith('{') && testCase.input.endsWith('}'))) {
                                        try {
                                            testInput = eval(`(${testCase.input})`);
                                        } catch (evalError) {
                                            // Fallback to original string if eval fails
                                            testInput = testCase.input;
                                        }
                                    }
                                }

                                // Execute the function with the input
                                let userOutput;
                                if (Array.isArray(testInput)) {
                                    // If input is an array, spread it as arguments
                                    userOutput = userFunction(...testInput);
                                } else {
                                    // Otherwise, pass it as a single argument
                                    userOutput = userFunction(testInput);
                                }

                                // Format outputs for comparison
                                let formattedUserOutput, formattedExpectedOutput;
                                
                                // Format user output based on type
                                if (typeof userOutput === 'object') {
                                    formattedUserOutput = JSON.stringify(userOutput);
                                } else {
                                    formattedUserOutput = String(userOutput);
                                }
                                
                                // Format expected output
                                try {
                                    // Try parsing the expected output as JSON
                                    const parsedExpected = JSON.parse(testCase.output);
                                    formattedExpectedOutput = JSON.stringify(parsedExpected);
                                } catch (e) {
                                    // If not valid JSON, use as string
                                    formattedExpectedOutput = String(testCase.output);
                                }
                                
                                // Compare and determine if the test passed
                                const passed = formattedUserOutput === formattedExpectedOutput;

                                return {
                                    input: testCase.input,
                                    expected: testCase.output,
                                    output: formattedUserOutput,
                                    passed: passed
                                };
                            } catch (error) {
                                console.error('Error executing test case:', error);
                                return {
                                    input: testCase.input,
                                    expected: testCase.output,
                                    output: `Error: ${error.message}`,
                                    passed: false,
                                    error: error.message
                                };
                            }
                        });
                    }

                    // Calculate score based on passing tests
                    const passedCount = userCodeResults.filter(r => r.passed).length;
                    const totalTests = userCodeResults.length;
                    
                    // Enhance feedback with test results
                    feedbackMessage += `\n\n## Test Results: ${passedCount}/${totalTests} tests passed.\n\n`;
                    
                    // Add specific detail based on results
                    if (passedCount === totalTests) {
                        feedbackMessage += 'Excellent! All test cases passed. Your solution is correct.\n\n';
                    } else if (passedCount > 0) {
                        feedbackMessage += 'Some test cases passed, but others failed. Review the failing test cases to identify issues in your solution.\n\n';
                        
                        // Add details about failing test cases
                        const failingTests = userCodeResults.filter(r => !r.passed);
                        feedbackMessage += '### Failing Test Cases:\n';
                        failingTests.forEach((test, i) => {
                            feedbackMessage += `\nTest ${i+1}:\n`;
                            feedbackMessage += `- Input: ${test.input}\n`;
                            feedbackMessage += `- Expected: ${test.expected}\n`;
                            feedbackMessage += `- Your output: ${test.output}\n`;
                            if (test.error) feedbackMessage += `- Error: ${test.error}\n`;
                        });
                    } else {
                        feedbackMessage += 'No test cases passed. Here are some suggestions to improve your solution:\n\n';
                        feedbackMessage += '- Check if your function name is "solution" as required\n';
                        feedbackMessage += '- Ensure your function accepts the correct parameters\n';
                        feedbackMessage += '- Verify your solution handles all edge cases\n';
                        feedbackMessage += '- Look for logic errors in your implementation\n\n';
                        
                        // Add the first error if available
                        const firstError = userCodeResults.find(r => r.error);
                        if (firstError) {
                            feedbackMessage += `First error encountered: ${firstError.error}\n\n`;
                        }
                    }
                    
                    // Add the model solution if available and not all tests passed
                    if (codingQuestion.solution && passedCount < totalTests) {
                        feedbackMessage += '\n## Model Solution:\n\n';
                        feedbackMessage += codingQuestion.solution;
                        feedbackMessage += '\n\nTry to understand this solution and compare it with your approach.';
                    }
                } catch (execError) {
                    console.error('Error executing user code:', execError);
                    feedbackMessage += `\n\nError evaluating your code: ${execError.message}`;
                }
            }
            
            // Generate a rating based on test results
            const passedCount = userCodeResults.filter(r => r.passed).length;
            const totalTests = userCodeResults.length > 0 ? userCodeResults.length : 1;
            const successRatio = passedCount / totalTests;
            
            // Calculate a rating out of 5 based on test case success
            let rating;
            if (successRatio === 1) rating = "5/5"; // All tests passed
            else if (successRatio >= 0.8) rating = "4/5";
            else if (successRatio >= 0.6) rating = "3/5";
            else if (successRatio >= 0.4) rating = "2/5";
            else if (successRatio > 0) rating = "1/5";
            else rating = "0/5"; // No tests passed
            
            await db.insert(UserAnswer).values({
                mockIdref: mockId,
                question: codingQuestion.question,
                userAns: code,
                correctAns: codingQuestion.solution || 'Solution not available',
                feedback: feedbackMessage,
                userEmail: user.primaryEmailAddress.emailAddress,
                createdAt: new Date().toISOString(),
                isCodingQuestion: true,
                codeLanguage: 'javascript',
                testCases: testCasesStr,
                userCodeResults: JSON.stringify(userCodeResults),
                rating: rating
            });
            
            toast.success('Code saved and evaluated successfully!');
            handleFinishInterview();
        } catch (error) {
            console.error('Error saving code:', error);
            toast.error('Failed to save code');
        }
    */
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

    const isLastQuestion = currentQuestionIndex === questions.length - 1;
    const currentQuestion = questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

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
                    

                    {/* Recording Section */}
                    <Card className="bg-white shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-xl">
                                Record Your Answer
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <RecordAnsSection
                                question={currentQuestion}
                                mockId={mockId}
                                onNext={handleNext}
                            />
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
                        onClick={handleNext}
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
