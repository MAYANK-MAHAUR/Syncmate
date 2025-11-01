"use client";

import { Input } from "@/components/ui/input";
import { PaperPlaneIcon } from "@radix-ui/react-icons";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useEffect, useState } from "react";

export function InputWithButton({ setResponse, setLoading, setOpen }) {
    const [app, setApp] = useState("github");
    const [instruction, setInstruction] = useState("");
    const [entityId, setEntityId] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        if (!instruction.trim()) {
            setResponse("Please enter an instruction.");
            setOpen(true);
            return;
        }

        if (!entityId) {
            setResponse("Entity ID not found. Please refresh the page.");
            setOpen(true);
            return;
        }

        setLoading(true);

        try {
            // CRITICAL FIX: Ensure proper JSON formatting
            const requestBody = {
                instruction: instruction.trim(),
                app: app.toLowerCase(),
                entityId: entityId
            };

            console.log('Sending request:', requestBody);

            const response = await fetch('/api/run-agent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            console.log('Response status:', response.status);
            
            // Check if response is OK
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Response error:', errorText);
                throw new Error(`Server error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            console.log('Response data:', data);

            setOpen(true);
            setResponse(data.response || "No response from server.");

            // Clear input on success
            if (data.success) {
                setInstruction("");
            }

        } catch (error) {
            console.error('Request error:', error);
            setOpen(true);
            setResponse(`Error: ${error.message || 'Failed to process request. Please try again.'}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const storedEntityId = localStorage.getItem("entityId");
        if (storedEntityId) {
            setEntityId(storedEntityId);
        } else {
            console.warn("No entityId found in localStorage");
        }
    }, []);

    return (
        <div className="flex w-full max-w-xl items-center space-x-4 my-5">
            <Select onValueChange={(value) => setApp(value)} defaultValue={app}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select a app" />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        <SelectLabel>Apps</SelectLabel>
                        <SelectItem value="github">Github</SelectItem>
                        <SelectItem value="gmail">Gmail</SelectItem>
                        <SelectItem value="youtube">Youtube</SelectItem>
                        <SelectItem value="googledocs">Google Docs</SelectItem>
                        <SelectItem value="googlecalendar">Google Calendar</SelectItem>
                    </SelectGroup>
                </SelectContent>
            </Select>
            <Input 
                type="text" 
                placeholder="Ask a question..." 
                className="h-12 w-full" 
                value={instruction} 
                onChange={(e) => setInstruction(e.target.value)}
                onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        handleSubmit(e);
                    }
                }}
            />
            <button 
                type="submit" 
                className="inline-flex animate-shimmer items-center justify-center rounded-md border border-slate-800 bg-[linear-gradient(110deg,#000103,45%,#1e2631,55%,#000103)] bg-[length:200%_100%] py-3.5 px-4 font-medium text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50 group/ask-btn disabled:opacity-50 disabled:cursor-not-allowed" 
                onClick={handleSubmit}
                disabled={!instruction.trim() || !entityId}
            >
                <PaperPlaneIcon className="h-4 w-4 group-hover/ask-btn:-rotate-45 transition duration-500" />
            </button>
        </div>
    );
}