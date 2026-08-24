<div align="center">
  
  # 🎙️ Meeting Summarizer
  
  **Turn the room into the record.**
  
  An AI-powered web application that instantly transforms your meeting audio into structured summaries, key decisions, and actionable tasks, all wrapped in a stunning, high-performance UI.

  [![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
  [![Google Gemini](https://img.shields.io/badge/Google_Gemini-8E75B2?style=for-the-badge&logo=googlebard&logoColor=white)](https://deepmind.google/technologies/gemini/)
  [![OpenAI Whisper](https://img.shields.io/badge/OpenAI_Whisper-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com/research/whisper)
  [![Vanilla JS](https://img.shields.io/badge/Vanilla_JS-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)]()

</div>

<br/>

## ✨ Features

- **🚀 Instant Processing**: Upload `.mp3`, `.wav`, or `.m4a` files and watch the AI process them in real-time.
- **📡 Server-Sent Events (SSE)**: Live progress updates streamed directly to the frontend, so you're never left guessing.
- **🧠 Gemini AI Intelligence**: Leverages Google's Gemini Flash model to extract precise summaries, highlight key decisions, and assign action items with deadlines and priorities.
- **💬 Context-Aware Chatbot**: Ask follow-up questions about the meeting right inside the app. The floating chatbot widget knows exactly what was discussed.
- **🎨 "Astra" Premium UI**: A highly polished, dark-mode aesthetic featuring:
  - Interactive, physics-based particle backgrounds.
  - Smooth, staggered reveal animations.
  - CSS-only scanline hover effects and pulsing interactive elements.
- **📋 Export Options**: One-click copy for Slack or download the entire summary as a beautifully formatted Markdown file.

<br/>

## 🛠️ Tech Stack

### Backend
- **Python 3.9+** & **FastAPI**: For a blazing fast, async backend architecture.
- **Google GenAI SDK**: Powering the advanced summarization and chatbot context.
- **OpenAI Whisper (Local/API)**: Handling state-of-the-art audio transcription.
- **Pydantic**: Ensuring strict data validation for all AI outputs.

### Frontend
- **Vanilla HTML5, CSS3, & JavaScript**: Zero-dependency, ultra-lightweight frontend.
- **Custom Design System**: CSS variables, flexbox/grid layouts, and native keyframe animations for a fluid user experience.

<br/>

## 🚀 Getting Started

### Prerequisites
- Python 3.9 or higher
- An active [Google Gemini API Key](https://aistudio.google.com/)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Devika101/meeting-summarizer.git
   cd meeting-summarizer
   ```

2. **Set up a virtual environment:**
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r backend/requirements.txt
   ```

4. **Configure Environment Variables:**
   Create a `.env` file in the root directory (you can use `.env.example` as a template) and add your API keys:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

### Running the Application

Start the FastAPI backend server using Uvicorn:

```bash
python -m uvicorn backend.main:app --reload --port 8000
```

Open your browser and navigate to: **[http://127.0.0.1:8000](http://127.0.0.1:8000)**

<br/>

## 🎯 How It Works

1. **Upload**: Drag and drop your meeting audio file into the glowing drop zone.
2. **Process**: The backend transcribes the audio using Whisper and streams the progress back to the UI.
3. **Analyze**: The transcription is fed into Gemini, instructed by a rigorous system prompt to extract structured JSON data.
4. **Review**: View the summary, decisions, and action items in the beautifully styled results panels.
5. **Chat**: Click the chat widget in the bottom right to ask the AI specific questions about the meeting.

<br/>

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/Devika101/meeting-summarizer/issues).

---
<div align="center">
  <i>Built to turn noise into knowledge.</i>
</div>
