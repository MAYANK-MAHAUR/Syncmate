# 🤖 Syncmate

> **Transform natural language into powerful actions across your favorite apps**

Syncmate is an intelligent AI agent that bridges the gap between human intent and digital action. Simply tell it what you want to do in plain English, and watch as it executes complex tasks across GitHub, Gmail, YouTube, Google Docs, and Google Calendar.

[![Powered by Dobby](https://img.shields.io/badge/Powered%20by-DOBBY-orange?style=for-the-badge)](https://www.sentient.xyz)
[![Fireworks AI](https://img.shields.io/badge/Fireworks-AI-red?style=for-the-badge)](https://fireworks.ai)
[![Composio](https://img.shields.io/badge/Composio-Platform-blue?style=for-the-badge)](https://composio.dev)

---

## ✨ What Makes Syncmate Special

**Natural Language Understanding**: No more remembering API endpoints or complex commands. Just say what you want:
- "Send an email to [email protected] about the project update"
- "Star the facebook/react repository on GitHub"
- "Create a Google Doc called 'Meeting Notes' and write the agenda"
- "Schedule a meeting tomorrow at 2 PM with the team"

**Intelligent Action Mapping**: Syncmate uses advanced AI to:
- Understand your intent from conversational language
- Automatically select the right action to perform
- Extract parameters intelligently from context
- Handle edge cases and ambiguity gracefully

**Multi-App Integration**: Currently supports:
- 📧 **Gmail** - Send emails, create drafts, manage labels
- 🐙 **GitHub** - Star repos, create issues, manage repositories
- 📺 **YouTube** - Search videos, subscribe to channels, like content
- 📝 **Google Docs** - Create and edit documents
- 📅 **Google Calendar** - Schedule and manage events

---

## 🚀 Quick Start

### Prerequisites

- Node.js v20.16.0 or higher
- [Composio API Key](https://docs.composio.dev/patterns/howtos/get_api_key)
- [Fireworks AI API Key](https://fireworks.ai)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/MAYANK-MAHAUR/Syncmate.git
cd syncmate
```

2. **Run the setup script**
```bash
chmod +x setup.sh
./setup.sh
```

3. **Configure environment variables**

Edit `.env.local` and add your API keys:
```env
COMPOSIO_API_KEY=your_composio_key_here
FIREWORKS_API_KEY=your_fireworks_key_here
NEXT_PUBLIC_APP_URL=
```

4. **Start the development server**
```bash
npm run dev
```

5. **Open your browser**

Navigate to `http://localhost:3000`

---

## 🎯 How It Works

### The Intelligence Layer

Syncmate uses **Dobby** (a fine-tuned LLaMA 3.3 70B model from Sentient) to power its decision-making:

1. **Intent Recognition**: Analyzes your natural language input to understand what action you want
2. **Action Selection**: Maps your intent to the appropriate API action across supported apps
3. **Parameter Extraction**: Intelligently extracts required information (emails, repo names, dates, etc.)
4. **Execution**: Connects to your apps via Composio and performs the action
5. **Response Generation**: Provides a friendly, human-like confirmation of what was done

### Architecture

```
User Input (Natural Language)
          ↓
    Dobby LLM Analysis
          ↓
    Action Identification
          ↓
    Parameter Extraction
          ↓
    Composio API Integration
          ↓
    Execute on Target App
          ↓
    Friendly Response
```

---

## 💡 Example Use Cases

### For Developers
```
"Star the sentient-agi/ROMA repository"
"Create an issue in my project repo about the login bug"
"Fork the tensorflow/tensorflow repository"
```

### For Professionals
```
"Send an email to my team about tomorrow's standup"
"Schedule a client call for Friday at 3 PM"
"Create a document called 'Q4 Strategy' and outline our goals"
```

### For Content Creators
```
"Search for AI tutorials on YouTube"
"Subscribe to the Fireship channel"
"Find videos about Next.js best practices"
```

---

## 🛠️ Technology Stack

- **Frontend**: Next.js 14, React, Tailwind CSS
- **AI/LLM**: Dobby (LLaMA 3.3 70B) via Fireworks AI
- **Integration Platform**: Composio
- **UI Components**: shadcn/ui, Radix UI, Framer Motion
- **State Management**: React Hooks

---

## 📁 Project Structure

```
syncmate/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── run-agent/          # Main agent execution endpoint
│   │   │   ├── connect-app/        # App connection handler
│   │   │   └── check-connect-app/  # Connection status checker
│   │   └── page.jsx                # Main UI
│   ├── components/
│   │   ├── common/                 # Reusable components
│   │   ├── section/                # Page sections
│   │   └── ui/                     # UI primitives
│   ├── utils/
│   │   ├── agent.js                # Agent logic & action mapping
│   │   ├── llm.js                  # LLM integration
│   │   └── common.js               # Utility functions
│   └── helpers/
│       └── common.js               # Helper functions
├── setup.sh                        # Automated setup script
└── README.md
```

---

## 🔐 Privacy & Security

- **Local Storage**: Your entity ID is stored locally in your browser
- **API Keys**: Never exposed to the client, only used server-side
- **OAuth Flow**: App connections use secure OAuth 2.0 flow via Composio
- **No Data Retention**: We don't store your messages or action history

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Write clean, readable code
- Follow the existing code style
- Test your changes thoroughly
- Update documentation as needed

---

## 🐛 Troubleshooting

### Common Issues

**"Entity ID not found"**
- Clear your browser's localStorage and refresh the page

**"Failed to connect app"**
- Verify your Composio API key is correct
- Check that the app is enabled in your Composio dashboard

**"Invalid API key"**
- Ensure both COMPOSIO_API_KEY and FIREWORKS_API_KEY are set in `.env.local`
- Verify the keys are valid and have proper permissions

**Connection popup blocked**
- Allow popups for localhost in your browser settings
- Try connecting again after allowing popups

---

## 🙏 Acknowledgments

This project wouldn't exist without:

- **[Sentient Foundation](https://www.sentient.xyz)** - For creating Dobby, the brain behind Syncmate
- **[Fireworks AI](https://fireworks.ai)** - For providing blazing-fast LLM inference
- **[Composio](https://composio.dev)** - For their powerful integration platform

---

## 🌟 Star History

If you find Syncmate useful, please consider giving it a star! ⭐

---



<div align="center">

**Built with ❤️ using Dobby, Fireworks AI, and Composio**

</div>