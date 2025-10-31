"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ConnectionSuccess() {
    const router = useRouter();

    useEffect(() => {
        const timeout = setTimeout(() => {
            router.push("/");
        }, 3000);

        return () => clearTimeout(timeout);
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center">
                <h1 className="text-4xl font-bold mb-4">✅ Connection Successful!</h1>
                <p className="text-muted-foreground mb-4">
                    Your account has been connected successfully.
                </p>
                <p className="text-sm text-muted-foreground">
                    Redirecting you back to the app...
                </p>
            </div>
        </div>
    );
}