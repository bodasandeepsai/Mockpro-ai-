import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import React from 'react'
import { Clock, MessageSquare, Play } from 'lucide-react'
import moment from 'moment'

function InterviewItemCard({interview}) {
    const router = useRouter();

    // Helper function to parse DD-MM-YYYY format dates
    const parseCustomDate = (dateString) => {
        if (!dateString) return null;
        
        try {
            // Handle DD-MM-YYYY format
            if (dateString.includes('-')) {
                const parts = dateString.split('-');
                if (parts.length === 3) {
                    const [day, month, year] = parts;
                    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                }
            }
            
            // Fallback to standard date parsing
            const date = new Date(dateString);
            return isNaN(date.getTime()) ? null : date;
        } catch (error) {
            console.error('Error parsing date:', dateString, error);
            return null;
        }
    };

    // Helper function to format date for display
    const formatDateForDisplay = (dateString) => {
        const date = parseCustomDate(dateString);
        if (!date) return 'Invalid Date';
        return moment(date).format('MMM DD, YYYY');
    };

    const onStart=()=>{
        router.push('/dashboard/interview/'+interview?.mockId)
    }

    const onFeedback=()=>{
        router.push('/dashboard/interview/'+interview?.mockId+'/feedback?mockId='+interview?.mockId)
    }

    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow hover:shadow-lg transition-shadow duration-200 p-0 flex flex-col h-full">
            <div className="p-5 flex-1 flex flex-col justify-between">
                <div className="flex items-start justify-between mb-2">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 mb-1 truncate max-w-xs">{interview?.jobPosition}</h2>
                        <div className="flex items-center text-xs text-gray-500 mb-1">
                            <Clock className="h-4 w-4 mr-1" />
                            {interview.jobExperience} years experience
                        </div>

                        <p className="text-xs text-gray-400 mb-1">Created {formatDateForDisplay(interview.createdAt)}</p>
                        {interview.status && (
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mt-1 mb-1 ${interview.status === 'completed' ? 'bg-green-100 text-green-700' : interview.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>{interview.status.replace('_', ' ').toUpperCase()}</span>
                        )}
                        {interview.averageRating > 0 && (
                            <div className="flex items-center gap-1 text-xs text-yellow-600 mt-1">
                                <span className="font-semibold">{interview.averageRating}</span>
                                <span>/5</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex flex-col gap-2 mt-4">
                    <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex items-center gap-2"
                        onClick={onFeedback}
                    >
                        <MessageSquare className="h-4 w-4" />
                        Feedback
                    </Button>
                    <Button 
                        size="sm" 
                        className="flex items-center gap-2"
                        onClick={onStart}
                    >
                        <Play className="h-4 w-4" />
                        Start
                    </Button>
                </div>
            </div>
        </div>
    )
}

export default InterviewItemCard
