"use client"

import { useEffect, useRef, useState } from 'react'
import * as monaco from '@monaco-editor/react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function CodeEditor({ question, onSave, language = 'javascript' }) {
    const [code, setCode] = useState('')
    const editorRef = useRef(null)

    const handleEditorDidMount = (editor) => {
        editorRef.current = editor
    }

    const handleSave = () => {
        if (!code.trim()) {
            toast.error('Please write some code before saving')
            return
        }
        onSave(code)
    }

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Coding Question</h3>
                <p className="text-gray-600">{question}</p>
            </div>

            <div className="border rounded-lg overflow-hidden">
                <monaco.Editor
                    height="400px"
                    defaultLanguage={language}
                    defaultValue=""
                    theme="vs-dark"
                    onChange={(value) => setCode(value)}
                    onMount={handleEditorDidMount}
                    options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        lineNumbers: 'on',
                        scrollBeyond: false,
                        automaticLayout: true,
                    }}
                />
            </div>

            <div className="flex justify-end">
                <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                    Save Code
                </Button>
            </div>
        </div>
    )
} 