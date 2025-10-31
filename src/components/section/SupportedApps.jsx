"use client";

import Image from "next/image";
import React, { useEffect, useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useOutsideClick } from "@/hooks/use-outside-click";
import Loader from "../common/Loader";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { ExclamationTriangleIcon, CheckCircledIcon } from "@radix-ui/react-icons";

export function SupportedApps() {
    const ref = useRef(null);
    const id = useId();
    const [loaderLoading, setLoaderLoading] = useState(false);
    const [alert, setAlert] = useState({ show: false, type: 'info', message: '' });

    useOutsideClick(ref, () => setActive(null));

    return (
        <>
            <ul className="max-w-2xl mx-auto w-full gap-4">
                {alert.show && (
                    <Alert className="mb-5">
                        {alert.type === 'success' ? (
                            <CheckCircledIcon className="h-4 w-4" />
                        ) : (
                            <ExclamationTriangleIcon className="h-4 w-4" />
                        )}
                        <AlertTitle>{alert.type === 'success' ? 'Success' : 'Note'}</AlertTitle>
                        <AlertDescription>
                            {alert.message}
                        </AlertDescription>
                    </Alert>
                )}
                <Loader loading={loaderLoading} />
                {cards.map((card, index) => (
                    <ConnectApp
                        key={index}
                        card={card}
                        setLoaderLoading={setLoaderLoading}
                        setAlert={setAlert}
                        id={index}
                    />
                ))}
            </ul>
        </>
    );
}

const cards = [
    {
        id: "github",
        description: "Dev-Tools | Version Control | Collaboration",
        title: "Github",
        src: "https://github.githubassets.com/assets/GitHub-Mark-ea2971cee799.png",
    },
    {
        id: "gmail",
        description: "Send and manage emails.",
        title: "Gmail",
        src: "https://raw.githubusercontent.com/SamparkAI/open-logos/d9b539471e551d6c14ffd442d172e476edd44b33/gmail.svg",
    },
    {
        id: "youtube",
        description: "Youtube actions to interact with youtube app",
        title: "Youtube",
        src: "https://img.freepik.com/premium-vector/red-youtube-logo-social-media-logo_197792-1803.jpg",
    },
    {
        id: "googledocs",
        description: "Perform various document-related actions.",
        title: "Google Docs",
        src: "https://raw.githubusercontent.com/SamparkAI/open-logos/853011bff173624654a8f7b64b2399cf2d9e84b3/google-docs.svg",
    },
    {
        id: "googlecalendar",
        description: "Perform various calendar-related actions.",
        title: "Google Calendar",
        src: "https://raw.githubusercontent.com/SamparkAI/open-logos/d9b539471e551d6c14ffd442d172e476edd44b33/google-calendar.svg",
    },
];

const ConnectApp = ({ card, id, setLoaderLoading, setAlert }) => {
    const [alreadyConnected, setAlreadyConnected] = useState(false);
    const [error, setError] = useState(null);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        checkConnectionStatus();
    }, [card.id]);

    async function checkConnectionStatus() {
        setChecking(true);
        setError(null);

        try {
            const entityId = localStorage.getItem("entityId");
            
            if (!entityId) {
                throw new Error("Entity ID not found");
            }

            const response = await fetch(`/api/check-connect-app/${entityId}/${card.id}`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            setAlreadyConnected(data.connected);
            
        } catch (error) {
            console.error("Error checking connection:", error);
            setError(error.message);
            setAlreadyConnected(false);
        } finally {
            setChecking(false);
        }
    }

    const handleConnect = async () => {
        setLoaderLoading(true);
        setError(null);

        try {
            const entityId = localStorage.getItem("entityId");
            
            if (!entityId) {
                throw new Error("Entity ID not found. Please refresh the page.");
            }

            const response = await fetch(`/api/connect-app/${entityId}/${card.id}`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.connected) {
                setAlreadyConnected(true);
                setAlert({ 
                    show: true, 
                    type: 'success', 
                    message: `${card.title} is already connected!` 
                });
            } else if (data.redirectUrl) {
                setAlert({ 
                    show: true, 
                    type: 'info', 
                    message: 'Complete authentication in the popup window. The page will refresh once done.' 
                });
                
                // Open in popup window
                const width = 600;
                const height = 700;
                const left = (window.screen.width - width) / 2;
                const top = (window.screen.height - height) / 2;
                
                const popup = window.open(
                    data.redirectUrl,
                    'oauth',
                    `width=${width},height=${height},left=${left},top=${top}`
                );

              
                const pollTimer = setInterval(() => {
                    if (popup && popup.closed) {
                        clearInterval(pollTimer);
                        setTimeout(() => {
                            checkConnectionStatus();
                            setAlert({ 
                                show: true, 
                                type: 'success', 
                                message: 'Connection completed! Checking status...' 
                            });
                        }, 1000);
                    }
                }, 500);
            }
        } catch (error) {
            console.error("Error connecting app:", error);
            setError(error.message);
            setAlert({ 
                show: true, 
                type: 'error', 
                message: `Failed to connect ${card.title}: ${error.message}` 
            });
        } finally {
            setLoaderLoading(false);
        }
    };

    return (
        <motion.div
            layoutId={`card-${card.title}-${id}`}
            key={`card-${card.title}-${id}`}
            className="p-4 flex flex-col md:flex-row justify-between items-center hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl"
        >
            <div className="flex gap-4 flex-col md:flex-row ">
                <motion.div layoutId={`image-${card.title}-${id}`}>
                    <Image
                        width={100}
                        height={100}
                        src={card.src}
                        alt={card.title}
                        className="h-40 w-40 md:h-14 md:w-14 rounded-lg object-cover object-top"
                    />
                </motion.div>
                <div className="">
                    <motion.h3
                        layoutId={`title-${card.title}-${id}`}
                        className="font-medium text-neutral-800 dark:text-neutral-200 text-center md:text-left"
                    >
                        {card.title}
                    </motion.h3>
                    <motion.p
                        layoutId={`description-${card.description}-${id}`}
                        className="text-neutral-600 dark:text-neutral-400 text-center md:text-left"
                    >
                        {card.description}
                    </motion.p>
                    {error && (
                        <p className="text-red-500 text-xs mt-1">Error: {error}</p>
                    )}
                </div>
            </div>
            {checking ? (
                <motion.button
                    layoutId={`button-${card.title}-${id}`}
                    className="px-4 py-2 text-sm rounded-full font-bold bg-gray-100 text-black mt-4 md:mt-0"
                    disabled
                >
                    Checking...
                </motion.button>
            ) : alreadyConnected ? (
                <motion.button
                    layoutId={`button-${card.title}-${id}`}
                    className="px-4 py-2 text-sm rounded-full font-bold bg-green-500 text-white mt-4 md:mt-0"
                    disabled
                >
                    ✓ Connected
                </motion.button>
            ) : (
                <motion.button
                    layoutId={`button-${card.title}-${id}`}
                    className="px-4 py-2 text-sm rounded-full font-bold bg-gray-100 hover:bg-green-500 hover:text-white text-black mt-4 md:mt-0"
                    onClick={handleConnect}
                >
                    Connect
                </motion.button>
            )}
        </motion.div>
    );
};