# Revilio - Youtube Video Fact Checker

A web-based  tool designed to detect AI-generated speech and verify the factual accuracy of YouTube videos. This application cross-references video transcripts with real-time web data via the DuckDuckGo API to ensure content authenticity.

## Features

- **AI Speech Detection**: Identifies synthetic artifacts in audio to detect AI-generated speech.
- **Factual Verification**: Validates statements in video transcripts by cross-referencing them with real-time web data.
- **High Performance**: Features a low-latency extraction system using `yt-dlp` and `FFmpeg` for efficient processing.
- **Structured Analysis**: Supports detailed analysis of videos up to 15 minutes in length with minimal overhead.
- **Smart Reasoning**: Leverages **Gemini 2.5** and **Pydantic** to transform complex multimodal reasoning into actionable insights.
- **Real-time Dashboard**: Built with **React.js** for immediate visualization of forensic results.

## Tech Stack

- **Frontend**: React.js
- **AI & Logic**: Gemini 2.5, Pydantic
- **Media Processing**: yt-dlp, FFmpeg
- **Data Source**: DuckDuckGo API

## Getting Started

This project was bootstrapped with Create React App.

### Prerequisites

Make sure you have Node.js installed on your machine.

### Installation

1. Clone the repository.
2. Navigate to the project directory.
3. Install dependencies:
   ```bash
   npm install
   ```

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open http://localhost:3000 to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about running tests for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.


## Images
<img width="1329" height="841" alt="Screenshot 2026-05-23 080030" src="https://github.com/user-attachments/assets/af0ca15e-588a-4c96-8d99-6fec3f5af05a" />

---

<img width="1598" height="847" alt="Screenshot 2026-05-23 080105" src="https://github.com/user-attachments/assets/3965d9c0-1c7a-43c1-9b6e-ec9d9c287dc5" />

---
<img width="1597" height="856" alt="Screenshot 2026-05-23 080122" src="https://github.com/user-attachments/assets/5e0318f7-6fe1-4d2a-a4ca-66b585f6cfd0" />

