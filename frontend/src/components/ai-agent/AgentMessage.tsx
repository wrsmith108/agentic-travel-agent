import { useState } from 'react';

// Simple markdown to HTML formatter with strong visual emphasis
const formatMarkdownToHTML = (text: string): string => {
  return text
    // Bold text with very visible styling
    .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: 700; color: #2563eb; background-color: #eff6ff; padding: 2px 6px; border-radius: 4px; border: 1px solid #bfdbfe; text-shadow: 0 1px 2px rgba(37, 99, 235, 0.1);">$1</strong>')
    // Bullet points with enhanced styling
    .replace(/^- (.+)$/gm, '<div style="display: flex; align-items: flex-start; gap: 8px; margin: 8px 0;"><span style="color: #3b82f6; font-weight: 700; margin-top: 2px; text-shadow: 0 1px 2px rgba(59, 130, 246, 0.3);">•</span><span>$1</span></div>')
    // Paragraphs (split by double newlines)
    .split('\n\n')
    .map(paragraph => {
      const trimmed = paragraph.trim();
      if (!trimmed) return '';
      
      // If it's already a div (bullet point), return as is
      if (trimmed.includes('<div style="display: flex')) {
        return trimmed;
      }
      
      // Otherwise wrap in paragraph with enhanced styling
      return `<p style="margin-bottom: 12px; color: #374151; line-height: 1.6;">${trimmed.replace(/\n/g, '<br>')}</p>`;
    })
    .filter(p => p.length > 0)
    .join('');
};

interface AgentMessageProps {
  content: string;
  timestamp: string;
  isLoading?: boolean;
}

export const AgentMessage = ({ content, timestamp, isLoading = false }: AgentMessageProps) => {
  const [showFullContent, setShowFullContent] = useState(false);

  // Parse the formatted content to separate main content from questions
  const parseContent = (text: string) => {
    const parts = text.split('---');
    const mainContent = parts[0]?.trim() || '';
    const questionsSection = parts[1]?.trim() || '';
    
    // Extract questions if they exist - improved parsing
    const questions: string[] = [];
    if (questionsSection) {
      // Remove the heading first
      const cleanSection = questionsSection.replace(/^###\s*Questions for you:\s*\n*/i, '');
      
      // Split by numbered lines and clean up
      const lines = cleanSection.split('\n').filter(line => line.trim());
      
      lines.forEach(line => {
        const match = line.match(/^\d+\.\s*(.+)/);
        if (match && match[1]) {
          let question = match[1].trim();
          // Clean up any remaining bullet points or dashes
          question = question.replace(/^\s*[-•]\s*/, '');
          if (question.length > 0) {
            questions.push(question);
          }
        }
      });
    }
    
    return { mainContent, questions };
  };

  const { mainContent, questions } = parseContent(content);

  if (isLoading) {
    return (
      <div className="flex gap-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium text-blue-700">AI Travel Assistant</span>
            <span className="text-xs text-blue-500">thinking...</span>
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-blue-200 rounded animate-pulse w-3/4"></div>
            <div className="h-3 bg-blue-200 rounded animate-pulse w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  const shouldTruncate = mainContent.length > 300;
  const displayContent = shouldTruncate && !showFullContent 
    ? mainContent.substring(0, 300) + '...' 
    : mainContent;

  return (
    <div className="flex gap-3 p-4 bg-blue-50 rounded-lg border border-blue-100 hover:bg-blue-60 transition-colors">
      {/* Avatar */}
      <div className="flex-shrink-0">
        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
      </div>

      {/* Message Content */}
      <div className="flex-1 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium text-blue-700">AI Travel Assistant</span>
            <span className="text-xs text-blue-500">
              {new Date(timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-none">
          <div 
            className="text-gray-700 leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: formatMarkdownToHTML(displayContent)
            }}
          />
          
          {/* Show More/Less Button */}
          {shouldTruncate && (
            <button
              onClick={() => setShowFullContent(!showFullContent)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium mt-2 inline-block"
            >
              {showFullContent ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>

        {/* Questions Section */}
        {questions.length > 0 && (showFullContent || !shouldTruncate) && (
          <div className="mt-4 p-4 bg-white rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium text-blue-700">Questions for you:</span>
            </div>
            <div className="space-y-2">
              {questions.map((question, index) => (
                <div key={index} className="flex items-start gap-3 p-2 hover:bg-blue-50 rounded">
                  <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-600 rounded-full text-xs font-medium flex items-center justify-center mt-0.5">
                    {index + 1}
                  </span>
                  <span className="text-gray-700 text-sm">{question}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};