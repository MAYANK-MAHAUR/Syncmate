import { OpenAIToolSet } from "composio-core";

const ACTION_MAP = {
  github: {
    star: "GITHUB_STAR_A_REPOSITORY_FOR_THE_AUTHENTICATED_USER",
    unstar: "GITHUB_UNSTAR_REPO_FOR_AUTHENTICATED_USER",
    fork: "GITHUB_FORK_A_REPOSITORY",
    create_issue: "GITHUB_CREATE_AN_ISSUE",
    create_repo: "GITHUB_CREATE_A_REPOSITORY_FOR_THE_AUTHENTICATED_USER",
    list_repos: "GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER",
  },
  gmail: {
    send: "GMAIL_SEND_EMAIL",
    create_draft: "GMAIL_CREATE_EMAIL_DRAFT",
    list: "GMAIL_LIST_ALL_EMAILS",
    add_label: "GMAIL_ADD_LABEL_TO_EMAIL"
  },
  youtube: {
    search: "YOUTUBE_SEARCH_YOUTUBE",
    subscribe: "YOUTUBE_SUBSCRIBE_TO_CHANNEL",
    unsubscribe: "YOUTUBE_UNSUBSCRIBE_FROM_CHANNEL",
    like: "YOUTUBE_LIKE_VIDEO",
  },
  googledocs: {
    create: "GOOGLEDOCS_CREATE_DOCUMENT",
    update: "GOOGLEDOCS_UPDATE_DOCUMENT",
    get: "GOOGLEDOCS_GET_DOCUMENT",
  },
  googlecalendar: {
    create: "GOOGLECALENDAR_CREATE_EVENT",
    list: "GOOGLECALENDAR_LIST_EVENTS",
    update: "GOOGLECALENDAR_UPDATE_EVENT",
  },
};

// ---- action lookup ----
export async function getActionViaUseCase(app, useCase) {
  console.log("Getting action for:", { app, useCase });
  try {
    return await getActionFromComposioAPI(app, useCase);
  } catch (err) {
    console.warn("Composio API failed, using local map:", err.message);
    return getActionFromDirectMapping(app, useCase);
  }
}

async function getActionFromComposioAPI(app, useCase) {
  const encodedUseCase = encodeURIComponent(useCase);
  const url = `https://backend.composio.dev/api/v2/actions?useCase=${encodedUseCase}&apps=${app}`;
  const res = await fetch(url, {
    headers: { "X-API-Key": process.env.COMPOSIO_API_KEY },
  });

  if (!res.ok) throw new Error(`Composio API error ${res.status}`);
  const data = await res.json();
  const action = data.items?.[0]?.name;
  if (!action) throw new Error("No actions found");
  return action.toUpperCase();
}

function getActionFromDirectMapping(app, useCase) {
  const appLower = app.toLowerCase();
  const useCaseLower = useCase.toLowerCase();
  const actions = ACTION_MAP[appLower];
  if (!actions) throw new Error(`App ${app} not supported`);

  for (const [key, name] of Object.entries(actions)) {
    if (useCaseLower.includes(key.replace("_", " "))) return name;
  }

  if (appLower === "github" && useCaseLower.includes("star"))
    return ACTION_MAP.github.star;
  return Object.values(actions)[0];
}

// ---- schema fetch ----
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
  };
}

// ---- execute ----
export async function executeAction(entityId, actionName, params) {
  try {
    console.log("Executing action:", { entityId, actionName, params });
    const toolset = new OpenAIToolSet({
      apiKey: process.env.COMPOSIO_API_KEY,
      entityId,
    });

    // ✅ this is the correct function signature for your version
    const result = await toolset.executeAction({
      action: actionName, // required string
      entityId,
      params,
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
