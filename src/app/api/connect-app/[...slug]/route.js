import { Composio } from "composio-core";
import { NextResponse } from "next/server";


function extractSlugs(url) {
    const parts = url.split('/').filter(Boolean);
    const apiIndex = parts.indexOf('api');
    if (apiIndex !== -1 && parts[apiIndex + 1] === 'connect-app') {
        return [parts[apiIndex + 2], parts[apiIndex + 3]];
    }
    return [];
}

export async function GET(request) {
    try {
        const [userId, app] = extractSlugs(request.url);

        if (!userId || !app) {
            return NextResponse.json(
                { error: "Missing userId or app parameter", connected: false },
                { status: 400 }
            );
        }

        console.log(`Initiating connection for user: ${userId}, app: ${app}`);

        const composio = new Composio({
            apiKey: process.env.COMPOSIO_API_KEY
        });

        const connectedAccounts = await composio.connectedAccounts.list({
            user_uuid: userId
        });

        const existingConnection = connectedAccounts.items?.find(
            account => account.appName?.toLowerCase() === app.toLowerCase() && 
                      account.status === 'ACTIVE'
        );

        if (existingConnection) {
            console.log(`Already connected: ${app}`);
            return NextResponse.json({ 
                connected: true,
                message: "App already connected",
                connectionId: existingConnection.id 
            }, { status: 200 });
        }

        const entity = await composio.getEntity(userId);

        const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/connection-success`;
        
        const connection = await entity.initiateConnection({
            appName: app.toUpperCase(),
            redirectUrl: redirectUrl
        });

        console.log(`Connection initiated for ${app}:`, connection);

        return NextResponse.json({
            connected: false,
            redirectUrl: connection.redirectUrl,
            connectionId: connection.connectionId,
            message: "Please complete authentication in the opened window"
        }, { status: 200 });

    } catch (error) {
        console.error("Connect app API error:", error);
        
        let errorMessage = "Failed to connect app";
        if (error.message?.includes("not found")) {
            errorMessage = "App not found. Please ensure the app is enabled in your Composio dashboard.";
        } else if (error.message?.includes("unauthorized")) {
            errorMessage = "Invalid API key. Please check your Composio API key.";
        } else if (error.message) {
            errorMessage = error.message;
        }

        return NextResponse.json(
            {
                error: errorMessage,
                details: error.message,
                connected: false
            },
            { status: 500 }
        );
    }
}