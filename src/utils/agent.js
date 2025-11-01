import { OpenAIToolSet } from "composio-core";

// Enhanced action mappings with priority keywords
const ACTION_MAP = {
  github: {
    star: {
      action: "GITHUB_STAR_A_REPOSITORY_FOR_THE_AUTHENTICATED_USER",
      keywords: ["star", "favourite", "bookmark repository"]
    },
    unstar: {
      action: "GITHUB_UNSTAR_REPO_FOR_AUTHENTICATED_USER",
      keywords: ["unstar", "remove star", "unfavourite"]
    },
    fork: {
      action: "GITHUB_FORK_A_REPOSITORY",
      keywords: ["fork", "copy repository"]
    },
    create_issue: {
      action: "GITHUB_CREATE_AN_ISSUE",
      keywords: ["create issue", "open issue", "new issue", "report bug"]
    },
    create_repo: {
      action: "GITHUB_CREATE_A_REPOSITORY_FOR_THE_AUTHENTICATED_USER",
      keywords: ["create repo", "new repo", "create repository", "new repository"]
    },
    list_repos: {
      action: "GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER",
      keywords: ["list repo", "show repo", "my repositories"]
    },
  },
  gmail: {
    send: {
      action: "GMAIL_SEND_EMAIL",
      keywords: ["send email", "send mail", "email to", "mail to", "compose and send", "write email"]
    },
    create_draft: {
      action: "GMAIL_CREATE_EMAIL_DRAFT",
      keywords: ["create draft", "draft email", "save draft", "prepare email"]
    },
    list: {
      action: "GMAIL_LIST_ALL_EMAILS",
      keywords: ["list email", "show email", "get email", "check inbox", "my emails"]
    },
    add_label: {
      action: "GMAIL_ADD_LABEL_TO_EMAIL",
      keywords: ["add label", "label email", "tag email", "categorize email"]
    }
  },
  youtube: {
    search: {
      action: "YOUTUBE_SEARCH_YOUTUBE",
      keywords: ["search", "find video", "look for", "search youtube"]
    },
    subscribe: {
      action: "YOUTUBE_SUBSCRIBE_TO_CHANNEL",
      keywords: ["subscribe", "follow channel"]
    },
    unsubscribe: {
      action: "YOUTUBE_UNSUBSCRIBE_FROM_CHANNEL",
      keywords: ["unsubscribe", "unfollow channel"]
    },
    like: {
      action: "YOUTUBE_LIKE_VIDEO",
      keywords: ["like video", "thumbs up"]
    },
  },
  googledocs: {
    create: {
      action: "GOOGLEDOCS_CREATE_DOCUMENT",
      keywords: ["create doc", "new doc", "create document", "new document", "write doc"]
    },
    update: {
      action: "GOOGLEDOCS_UPDATE_DOCUMENT",
      keywords: ["update doc", "edit doc", "modify doc", "change doc"]
    },
    get: {
      action: "GOOGLEDOCS_GET_DOCUMENT",
      keywords: ["get doc", "read doc", "show doc", "open doc"]
    },
  },
  googlecalendar: {
    create: {
      action: "GOOGLECALENDAR_CREATE_EVENT",
      keywords: ["create event", "schedule", "new event", "add event", "book"]
    },
    list: {
      action: "GOOGLECALENDAR_LIST_EVENTS",
      keywords: ["list event", "show event", "my events", "calendar"]
    },
    update: {
      action: "GOOGLECALENDAR_UPDATE_EVENT",
      keywords: ["update event", "change event", "modify event", "reschedule"]
    },
  },
};

// Field name mappings for different actions
const FIELD_MAPPINGS = {
  "GMAIL_SEND_EMAIL": {
    "to": "recipient_email",
    "email": "recipient_email",
    "recipient": "recipient_email",
    "message": "body",
    "content": "body",
    "text": "body"
  },
  "GMAIL_CREATE_EMAIL_DRAFT": {
    "to": "recipient_email", 
    "email": "recipient_email",
    "recipient": "recipient_email",
    "message": "body",
    "content": "body",
    "text": "body"
  },
  "GOOGLEDOCS_CREATE_DOCUMENT": {
    "body": "text",
    "content": "text",
    "message": "text"
  },
  "GOOGLEDOCS_UPDATE_DOCUMENT": {
    "body": "text",
    "content": "text",
    "message": "text"
  }
};

// ---- Enhanced action lookup with scoring ----
export async function getActionViaUseCase(app, useCase) {
  console.log("Getting action for:", { app, useCase });
  
  // Try direct mapping first (more reliable)
  const directAction = getActionFromDirectMapping(app, useCase);
  if (directAction) {
    console.log("Direct mapping found:", directAction);
    return directAction;
  }
  
  // Fallback to Composio API
  console.log("No direct mapping found, trying Composio API...");
  try {
    const apiAction = await getActionFromComposioAPI(app, useCase);
    console.log("Composio API found action:", apiAction);
    return apiAction;
  } catch (err) {
    console.error("Composio API failed:", err);
    throw new Error(`Could not find appropriate action for: ${useCase}. Please try rephrasing your request.`);
  }
}

function getActionFromDirectMapping(app, useCase) {
  const appLower = app.toLowerCase();
  const useCaseLower = useCase.toLowerCase();
  const actions = ACTION_MAP[appLower];
  
  if (!actions) {
    console.warn(`App ${app} not found in local mapping`);
    return null;
  }

  // Score each action based on keyword matches
  let bestMatch = null;
  let bestScore = 0;

  for (const [key, config] of Object.entries(actions)) {
    let score = 0;
    
    for (const keyword of config.keywords) {
      if (useCaseLower.includes(keyword)) {
        // Longer keyword matches get higher scores
        score += keyword.split(" ").length * 10;
      }
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = config.action;
    }
  }

  if (bestScore > 0) {
    console.log(`Best match score: ${bestScore}`);
    return bestMatch;
  }

  // No good match found
  console.warn("No keyword match found in direct mapping");
  return null;
}

async function getActionFromComposioAPI(app, useCase) {
  const encodedUseCase = encodeURIComponent(useCase);
  const url = `https://backend.composio.dev/api/v2/actions?useCase=${encodedUseCase}&apps=${app}`;
  
  console.log("Calling Composio API:", url);
  
  const res = await fetch(url, {
    headers: { "X-API-Key": process.env.COMPOSIO_API_KEY },
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Composio API error response:", errorText);
    throw new Error(`Composio API error ${res.status}: ${errorText}`);
  }
  
  const data = await res.json();
  console.log("Composio API response:", JSON.stringify(data, null, 2));
  
  const action = data.items?.[0]?.name;
  if (!action) {
    throw new Error("No actions found from Composio API");
  }
  
  return action.toUpperCase();
}

// ---- Schema fetch with field mapping hints ----
export async function getInputSchema(toolSlug, entityId) {
  const url = `https://backend.composio.dev/api/v3/tools/execute/${toolSlug}`;
  console.log("Fetching schema from Composio v3:", url);

  const body = {
    entity_id: entityId,
    arguments: {},
    allow_tracing: false,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-api-key": process.env.COMPOSIO_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Schema fetch error:", data);
    throw new Error(`Failed schema: ${res.status}`);
  }

  return {
    parameters: data.input_schema?.properties || {},
    required: data.input_schema?.required || [],
    description: data.description || toolSlug,
    actionName: toolSlug
  };
}

// ---- Apply field mappings before execution ----
function applyFieldMappings(actionName, params) {
  const mappings = FIELD_MAPPINGS[actionName];
  if (!mappings) return params;

  const mappedParams = { ...params };
  
  for (const [oldField, newField] of Object.entries(mappings)) {
    if (mappedParams[oldField] !== undefined) {
      console.log(`Mapping field: ${oldField} → ${newField}`);
      mappedParams[newField] = mappedParams[oldField];
      delete mappedParams[oldField];
    }
  }
  
  return mappedParams;
}

// ---- Execute action with field mapping ----
export async function executeAction(entityId, actionName, params) {
  try {
    console.log("Executing action:", { entityId, actionName, params });
    
    // Apply field mappings
    const mappedParams = applyFieldMappings(actionName, params);
    console.log("Mapped params:", mappedParams);
    
    const toolset = new OpenAIToolSet({
      apiKey: process.env.COMPOSIO_API_KEY,
      entityId,
    });

    const result = await toolset.executeAction({
      action: actionName,
      entityId,
      params: mappedParams,
    });

    console.log("Action executed successfully");
    return result;
  } catch (err) {
    console.error("executeAction error:", err);
    throw new Error(
      `Failed to execute action ${actionName}: ${err.message || err}`
    );
  }
}