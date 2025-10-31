import { Composio } from "composio-core";
import { NextResponse } from "next/server";

async function checkUserConnection(userId, app) {
    const composio = new Composio({
        apiKey: process.env.COMPOSIO_API_KEY
    });

    try {
        const connectedAccounts = await composio.connectedAccounts.list({
            user_uuid: userId
        });

        console.log(`Checking connection for ${userId} - ${app}`);
        console.log(`Found ${connectedAccounts.items?.length || 0} connected accounts`);

        const connection = connectedAccounts.items?.find(
            account => account.appName?.toLowerCase() === app.toLowerCase() && 
                      account.status === 'ACTIVE'
        );

        return !!connection;

    } catch (error) {
        console.error(`Error checking connection for ${app}:`, error);
        // Return false instead of throwing to prevent UI breaks
        return false;
    }
}

function extractSlugs(url) {
    const parts = url.split('/').filter(Boolean);
    const apiIndex = parts.indexOf('api');

    if (apiIndex !== -1 && parts[apiIndex + 1] === 'check-connect-app') {
        return [parts[apiIndex + 2], parts[apiIndex + 3]];
    }
    return [];
}

export async function GET(request) {
    try {
        const [userId, app] = extractSlugs(request.url);

        if (!userId || !app) {
            return NextResponse.json(
                { error: "Missing parameters", connected: false },
                { status: 400 }
            );
        }

        const connected = await checkUserConnection(userId, app);
        
        return NextResponse.json({ 
            connected,
            app: app.toLowerCase(),
            userId 
        }, { status: 200 });

    } catch (error) {
        console.error("Check connection API error:", error);
        return NextResponse.json(
            {
                error: "Failed to check connection",
                message: error.message,
                connected: false
            },
            { status: 500 }
        );
    }
}