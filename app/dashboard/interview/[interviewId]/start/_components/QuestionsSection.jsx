"use client"
import { Lightbulb, Volume2, PlayCircle, PauseCircle } from 'lucide-react';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function QuestionsSection({ questions, activeQuestionIndex, onNext, onPrev }) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const textToSpeech = (text) => {
    if ('speechSynthesis' in window) {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
      } else {
        const speech = new SpeechSynthesisUtterance(text);
        speech.onend = () => setIsSpeaking(false);
        setIsSpeaking(true);
        window.speechSynthesis.speak(speech);
      }
    } else {
      alert('Sorry, your browser does not support text to speech');
    }
  };

  return (
    <div className="space-y-6">
      

      {/* Current Question */}
      <Card className="bg-white">
        <CardContent className="p-6 space-y-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-gray-900">
                {questions[activeQuestionIndex]?.question || 'Select a question'}
              </h2>
              <p className="text-sm text-gray-500">
                Question {activeQuestionIndex + 1} of {questions.length}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => textToSpeech(questions[activeQuestionIndex]?.question)}
              className="text-gray-600 hover:text-gray-900"
            >
              {isSpeaking ? (
                <PauseCircle className="h-5 w-5" />
              ) : (
                <PlayCircle className="h-5 w-5" />
              )}
            </Button>
          </div>

          {/* Tips Section */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="p-1 bg-yellow-100 rounded-lg">
                <Lightbulb className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-yellow-900 mb-1">Tips for Answering</h3>
                <p className="text-sm text-yellow-800">Take your time to understand the question and structure your answer clearly. Provide specific examples and stay focused on the topic.</p>
              </div>
            </div>
          </div>

          
        </CardContent>
      </Card>
    </div>
  );
}

export default QuestionsSection;
