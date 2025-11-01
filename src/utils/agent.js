import { OpenAIToolSet } from "composio-core";

// EXACT parameter mappings from Composio API documentation
const COMPOSIO_ACTION_PARAMS = {
  // Gmail Actions
  "GMAIL_SEND_EMAIL": {
    required: ["recipient_email", "subject", "body"],
    optional: ["cc", "bcc", "attachment", "is_html", "thread_id", "extra_recipients", "user_id"],
    mappings: {
      "to": "recipient_email",
      "email": "recipient_email",
      "recipient": "recipient_email",
      "message": "body",
      "content": "body",
      "text": "body",
      "message_body": "body"
    }
  },
  "GMAIL_CREATE_EMAIL_DRAFT": {
    required: ["recipient_email"],
    optional: ["subject", "body", "cc", "bcc", "attachment", "is_html", "thread_id", "extra_recipients", "user_id"],
    mappings: {
      "to": "recipient_email",
      "email": "recipient_email",
      "recipient": "recipient_email",
      "message": "body",
      "content": "body",
      "text": "body",
      "message_body": "body"
    }
  },
  "GMAIL_REPLY_TO_THREAD": {
    required: ["thread_id", "message_body", "recipient_email"],
    optional: ["attachment", "user_id"],
    mappings: {
      "to": "recipient_email",
      "email": "recipient_email",
      "recipient": "recipient_email",
      "message": "message_body",
      "body": "message_body",
      "content": "message_body",
      "text": "message_body"
    }
  },
  // GitHub Actions
  "GITHUB_STAR_A_REPOSITORY_FOR_THE_AUTHENTICATED_USER": {
    required: ["owner", "repo"],
    optional: [],
    mappings: {
      "repository": "repo",
      "repository_name": "repo",
      "repo_name": "repo"
    }
  },
  "GITHUB_CREATE_AN_ISSUE": {
    required: ["owner", "repo", "title"],
    optional: ["body", "assignees", "labels", "milestone"],
    mappings: {
      "repository": "repo",
      "issue_title": "title",
      "description": "body",
      "content": "body"
    }
  },
  // Google Docs Actions
  "GOOGLEDOCS_CREATE_DOCUMENT": {
    required: ["title"],
    optional: ["text"],
    mappings: {
      "name": "title",
      "document_name": "title",
      "body": "text",
      "content": "text",
      "message": "text"
    }
  },
  "GOOGLEDOCS_UPDATE_DOCUMENT": {
    required: ["document_id"],
    optional: ["text", "title"],
    mappings: {
      "doc_id": "document_id",
      "id": "document_id",
      "body": "text",
      "content": "text"
    }
  },
  // Google Calendar Actions
  "GOOGLECALENDAR_CREATE_EVENT": {
    required: ["summary", "start_datetime", "end_datetime"],
    optional: ["description", "location", "attendees", "timezone"],
    mappings: {
      "title": "summary",
      "event_title": "summary",
      "start": "start_datetime",
      "end": "end_datetime",
      "body": "description",
      "content": "description"
    }
  },
  // YouTube Actions
  "YOUTUBE_SEARCH_YOUTUBE": {
    required: ["query"],
    optional: ["max_results", "order"],
    mappings: {
      "search_query": "query",
      "search": "query",
      "q": "query"
    }
  },
  "YOUTUBE_SUBSCRIBE_TO_CHANNEL": {
    required: ["channel_id"],
    optional: [],
    mappings: {
      "channel": "channel_id",
      "id": "channel_id"
    }
  }
};

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

// ---- Enhanced action lookup with scoring ----
export async function getActionViaUseCase(app, useCase) {
  console.log("Getting action for:", { app, useCase });
  
  const directAction = getActionFromDirectMapping(app, useCase);
  if (directAction) {
    console.log("Direct mapping found:", directAction);
    return directAction;
  }
  
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

  let bestMatch = null;
  let bestScore = 0;

  for (const [key, config] of Object.entries(actions)) {
    let score = 0;
    
    for (const keyword of config.keywords) {
      if (useCaseLower.includes(keyword)) {
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

// ---- Schema fetch with proper parameter mapping ----
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

  // Get parameter info from our mappings
  const paramInfo = COMPOSIO_ACTION_PARAMS[toolSlug] || {
    required: data.input_schema?.required || [],
    optional: [],
    mappings: {}
  };

  return {
    parameters: data.input_schema?.properties || {},
    required: paramInfo.required,
    optional: paramInfo.optional || [],
    mappings: paramInfo.mappings || {},
    description: data.description || toolSlug,
    actionName: toolSlug
  };
}

// ---- Intelligent field mapping ----
function applyFieldMappings(actionName, params) {
  console.log(`Applying mappings for action: ${actionName}`);
  console.log('Original params:', params);
  
  const actionConfig = COMPOSIO_ACTION_PARAMS[actionName];
  
  if (!actionConfig) {
    console.warn(`No parameter config found for ${actionName}, using params as-is`);
    return params;
  }

  const mappedParams = { ...params };
  const mappings = actionConfig.mappings || {};
  
  // Apply mappings
  for (const [oldField, newField] of Object.entries(mappings)) {
    if (mappedParams[oldField] !== undefined && mappedParams[newField] === undefined) {
      console.log(`✓ Mapping: ${oldField} → ${newField}`);
      mappedParams[newField] = mappedParams[oldField];
      delete mappedParams[oldField];
    }
  }
  
  // Validate required fields
  const missingFields = actionConfig.required.filter(field => !mappedParams[field]);
  if (missingFields.length > 0) {
    console.error(`Missing required fields: ${missingFields.join(', ')}`);
    throw new Error(`Missing required parameters: ${missingFields.join(', ')}`);
  }
  
  console.log('Mapped params:', mappedParams);
  return mappedParams;
}

// ---- Execute action with robust error handling ----
export async function executeAction(entityId, actionName, params) {
  try {
    console.log("Executing action:", { entityId, actionName, params });
    
    // Apply field mappings
    const mappedParams = applyFieldMappings(actionName, params);
    console.log("Final mapped params:", mappedParams);
    
    const toolset = new OpenAIToolSet({
      apiKey: process.env.COMPOSIO_API_KEY,
      entityId,
    });

    const result = await toolset.executeAction({
      action: actionName,
      entityId,
      params: mappedParams,
    });

    console.log("✓ Action executed successfully");
    return result;
  } catch (err) {
    console.error("executeAction error:", err);
    
    // Provide helpful error messages
    if (err.message.includes('Missing required parameters')) {
      throw err; // Already has good message
    } else if (err.message.includes('recipient')) {
      throw new Error(`Email recipient error: Please ensure you've provided a valid email address. ${err.message}`);
    } else if (err.message.includes('authentication') || err.message.includes('unauthorized')) {
      throw new Error(`Authentication error: Please reconnect your ${actionName.split('_')[0]} account.`);
    }
    
    throw new Error(
      `Failed to execute ${actionName}: ${err.message || err}`
    );
  }
}