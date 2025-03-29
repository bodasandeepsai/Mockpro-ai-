"use client"
import React, { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, MicOff, LoaderCircle, AlertCircle, StopCircle, Lightbulb } from 'lucide-react'
import { toast } from 'sonner'
import { chatSession } from '@/utils/GemeniAIModal'
import { db } from '@/utils/db'
import { UserAnswer } from '@/utils/schema'
import { useUser } from '@clerk/nextjs'
import moment from 'moment'
import { Card, CardContent } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

function RecordAnsSection({ question, mockId, onNext }) {
    const [userAnswer, setUserAnswer] = useState('');
    const { user } = useUser();
    const [loading, setLoading] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [showPermissionDialog, setShowPermissionDialog] = useState(false);
    const [permissionError, setPermissionError] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const timerRef = useRef(null);
    const [recordedChunks, setRecordedChunks] = useState([]);
    const mediaRecorderRef = useRef(null);
    const recognitionRef = useRef(null);

    // Add logging for props
    useEffect(() => {
        console.log('RecordAnsSection mounted with props:', { 
            question, 
            mockId,
            hasUser: !!user,
            userEmail: user?.primaryEmailAddress?.emailAddress 
        });
    }, [question, mockId, user]);

    useEffect(() => {
        // Initialize speech recognition
        if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
            recognitionRef.current = new window.webkitSpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event) => {
                const transcript = Array.from(event.results)
                    .map(result => result[0].transcript)
                    .join('');
                setUserAnswer(transcript);
            };

            recognitionRef.current.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                setPermissionError(event.error);
                setShowPermissionDialog(true);
            };

            recognitionRef.current.onend = () => {
                if (isRecording) {
                    recognitionRef.current.start();
                }
            };
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [isRecording]);

    useEffect(() => {
        if (isRecording) {
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                setRecordingTime(0);
            }
        }
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [isRecording]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const checkMicrophonePermission = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (error) {
            setPermissionError(error.message);
            setShowPermissionDialog(true);
            return false;
        }
    };

    const StartStopRecording = async () => {
        if (isRecording) {
            stopRecording();
        } else {
            const hasPermission = await checkMicrophonePermission();
            if (hasPermission) {
                startRecording();
            }
        }
    };

    const startRecording = async () => {
        try {
            if (recognitionRef.current) {
                recognitionRef.current.start();
                setIsRecording(true);
                toast.success("Recording started");
            } else {
                toast.error("Speech recognition is not supported in your browser");
            }
        } catch (err) {
            console.error("Error starting recording:", err);
            setShowPermissionDialog(true);
        }
    };

    const stopRecording = async () => {
        if (recognitionRef.current && isRecording) {
            recognitionRef.current.stop();
            setIsRecording(false);
            toast.success("Recording stopped");
            
            // Save the answer immediately after stopping
            if (userAnswer.length > 10) {
                console.log('Attempting to save answer:', {
                    question,
                    mockId,
                    userAnswerLength: userAnswer.length,
                    userEmail: user?.primaryEmailAddress?.emailAddress
                });
                await UpdateUserAnswer();
            } else {
                console.log('Answer too short to save:', userAnswer.length);
                toast.info('Answer is too short to save. Please record a longer answer.');
            }
        }
    };

    const UpdateUserAnswer = async () => {
        // Add detailed logging
        console.log('UpdateUserAnswer called with:', {
            question,
            mockId,
            userAnswerLength: userAnswer.length,
            userEmail: user?.primaryEmailAddress?.emailAddress,
            isAuthenticated: !!user
        });

        if (!question?.question) {
            console.error('Question is missing');
            toast.error('Question data is missing. Please try again.');
            return;
        }

        if (!mockId) {
            console.error('MockId is missing. Current URL params:', window.location.search);
            toast.error('Interview ID is missing. Please try again.');
            return;
        }

        if (!user?.primaryEmailAddress?.emailAddress) {
            console.error('User email is missing. User state:', user);
            toast.error('User information is missing. Please try again.');
            return;
        }

        setLoading(true);
        const feedbackPrompt = "Question:" + question.question +
            ",UserAnswer:" + userAnswer + ", Depending on question and user Answer for given interview question" +
            "please give the rating for answer and feedback as area of improvement if any" +
            "to improve the answer in real interview in 5 to 6 lines in JSON format with rating field and feedback feild";

        try {
            console.log('Sending feedback prompt to AI...');
            const result = await chatSession.sendMessage(feedbackPrompt);
            const mockJsonResp = result.response.text().replace('```json', '').replace('```', '');
            const JsonFeedbackResp = JSON.parse(mockJsonResp);

            console.log('Received AI feedback:', JsonFeedbackResp);

            console.log('Attempting to save answer to database...');
            const resp = await db.insert(UserAnswer)
                .values({
                    mockIdref: mockId,
                    question: question.question,
                    userAns: userAnswer,
                    correctAns: question.answer,
                    feedback: JsonFeedbackResp?.feedback,
                    rating: JsonFeedbackResp?.rating,
                    userEmail: user.primaryEmailAddress.emailAddress,
                    createdAt: moment().format('DD-MM-YYYY')
                });

            if (resp) {
                console.log('Answer saved successfully');
                toast.success('Answer recorded successfully');
                setUserAnswer('');
                onNext?.(); // Call onNext if provided
            } else {
                console.error('No response from database insert');
                toast.error('Failed to save answer. Please try again.');
            }
        } catch (error) {
            console.error('Error in UpdateUserAnswer:', error);
            toast.error('Failed to record answer. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (!question?.question) {
        return (
            <Card className="p-6">
                <div className="text-center text-gray-500">
                    No question available for recording.
                </div>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Question Display */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <h3 className="text-lg font-medium text-gray-900">Current Question</h3>
                            {isRecording && (
                                <div className="flex items-center gap-2">
                                    <span className="animate-pulse h-2 w-2 bg-red-500 rounded-full"></span>
                                    <span className="text-sm font-medium text-gray-600">
                                        Recording... {formatTime(recordingTime)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-gray-700">{question.question}</p>
                    </div>
                </div>
            </div>

            {/* Recording Controls */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium text-gray-900">Record Your Answer</h3>
                        <div className="flex items-center gap-2">
                            {isRecording && (
                                <div className="flex items-center gap-2">
                                    <span className="animate-pulse h-2 w-2 bg-red-500 rounded-full"></span>
                                    <span className="text-sm text-gray-600">Recording...</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-center">
                        <Button
                            onClick={StartStopRecording}
                            className={`flex items-center gap-2 ${
                                isRecording 
                                    ? 'bg-red-600 hover:bg-red-700' 
                                    : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <LoaderCircle className="h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    {isRecording ? (
                                        <>
                                            <StopCircle className="h-4 w-4" />
                                            Stop Recording
                                        </>
                                    ) : (
                                        <>
                                            <Mic className="h-4 w-4" />
                                            Start Recording
                                        </>
                                    )}
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Transcription Preview */}
                    {userAnswer && (
                        <div className="bg-gray-50 rounded-lg p-4">
                            <h3 className="text-sm font-medium text-gray-900 mb-2">Your Answer</h3>
                            <p className="text-sm text-gray-600">{userAnswer}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Tips Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                        <Lightbulb className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-blue-900 mb-2">Tips for Recording</h3>
                        <ul className="text-sm text-blue-800 space-y-2">
                            <li className="flex items-start gap-2">
                                <span className="text-blue-600">•</span>
                                Speak clearly and at a moderate pace
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-blue-600">•</span>
                                Find a quiet environment
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-blue-600">•</span>
                                Take a moment to think before answering
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-blue-600">•</span>
                                You can re-record if you're not satisfied
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Permission Dialog */}
            <AlertDialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-red-500" />
                            Microphone Permission Required
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {permissionError || 'Please allow microphone access to record your answer.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => setShowPermissionDialog(false)}>
                            Try Again
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

export default RecordAnsSection;
