# IsThisPhishy

A sophisticated browser extension that provides real-time phishing detection and trust scoring for web pages using multi-factor analysis, AI-powered content evaluation, and comprehensive domain intelligence.

## Short Description

IsThisPhishy is a Chrome/Chromium browser extension that automatically analyzes web pages for phishing indicators, combining domain intelligence, SSL verification, blacklist checks, and AI-powered text analysis to generate a comprehensive trust score (0-100) with detailed explanations.

## Key Features

- **Real-Time Phishing Detection**: Automatically analyzes web pages as you browse, providing instant trust scores
- **Multi-Factor Trust Scoring**: Calculates trust scores based on 8+ security indicators including domain age, SSL certificates, DNS records, blacklist status, and AI analysis
- **AI-Powered Content Analysis**: Leverages machine learning models to analyze both URL structure and page content for phishing patterns
- **Proactive Content Extraction**: Uses Mozilla Readability to intelligently extract and chunk page content for analysis
- **Intelligent Caching System**: Implements a 5-minute cache to optimize performance and reduce API calls
- **Visual Trust Indicators**: Color-coded badge system (green/yellow/red) on the extension icon for quick risk assessment
- **Detailed Score Explanations**: Provides expandable explanations for each scoring factor with impact indicators
- **Automated Testing Framework**: Built-in test runner for batch analysis of phishing and legitimate sites
- **Modern React UI**: Beautiful, responsive popup interface built with React, TypeScript, and Tailwind CSS

## Architecture & Tech Stack

### Frontend Architecture
- **UI Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with custom design system
- **Component Library**: Radix UI primitives (Label, Progress, Switch, Tooltip)
- **Icons**: Lucide React
- **State Management**: React Hooks with custom hooks for data fetching

### Extension Architecture
- **Manifest Version**: Chrome Extension Manifest V3
- **Background Service Worker**: TypeScript-based service worker handling API communication and data processing
- **Content Script**: Proactive content extraction using Mozilla Readability API
- **Popup Interface**: React-based popup for displaying analysis results

### Build & Development Tools
- **Build System**: Vite with `vite-plugin-web-extension`
- **Type Safety**: TypeScript with strict mode enabled
- **Code Quality**: ESLint with React hooks and TypeScript plugins
- **CSS Processing**: PostCSS with Autoprefixer

### Key Technologies
- **TypeScript** - Type-safe development
- **React 18** - Modern UI framework
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Chrome Extension APIs** - Browser extension functionality
- **Mozilla Readability** - Content extraction and cleaning
- **Radix UI** - Accessible component primitives

### Backend Integration
- **API Communication**: RESTful API integration (localhost:8000)
- **Endpoints**:
  - `/api/v1/analyze_domain_details` - Domain intelligence analysis
  - `/api/v1/check_phishing_text` - AI-powered text analysis

## Technical Challenges

### 1. Proactive Content Extraction and Chunking
One of the most complex challenges was implementing a system that automatically extracts meaningful content from web pages without user interaction. The solution involved:
- Using Mozilla Readability to strip navigation, ads, and boilerplate content
- Implementing intelligent text chunking (2000 characters per chunk, max 5 chunks)
- Handling edge cases where pages have minimal or no readable content
- Ensuring content extraction works across diverse website structures

The content script proactively sends extracted content to the background service worker, which then performs parallel AI analysis on multiple chunks, significantly improving detection accuracy for sophisticated phishing attempts.

### 2. Multi-Context Communication and State Synchronization
The extension operates across three distinct execution contexts (content script, background service worker, and popup), each with isolated memory spaces. Implementing reliable real-time communication required:
- Designing a message-passing architecture with proper error handling
- Implementing a caching layer in Chrome storage with cache invalidation logic
- Handling race conditions when multiple tabs trigger simultaneous analyses
- Synchronizing UI state across popup opens/closes and tab switches

The solution uses Chrome's message passing API with async/await patterns, implements a 5-minute cache with domain-based keys, and uses React hooks to manage complex state transitions between loading, cached, and fresh data states.

## Setup & Installation

### Prerequisites
- Node.js 18+ and npm
- Chrome or Chromium-based browser
- Backend API server running on `http://127.0.0.1:8000` (for full functionality)

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/ziebamikolaj/IsThisPhishy-addon.git
   cd IsThisPhishy-addon
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the extension**
   ```bash
   npm run build
   ```
   This will compile TypeScript, bundle React components, and generate the extension in the `dist/` directory.

4. **Load the extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in the top right)
   - Click "Load unpacked"
   - Select the `dist/` directory from the project root

5. **Development Mode** (optional)
   ```bash
   npm run dev
   ```
   This starts the Vite dev server with hot module replacement. The extension will reload automatically on code changes.

### Running Tests

The extension includes an automated testing framework. To run tests:

1. Open the browser console (F12)
2. In the background service worker console, run:
   ```javascript
   runExtensionTests()
   ```
   This will analyze a curated set of phishing and legitimate URLs and generate a comprehensive test report.

### Configuration

The extension connects to a backend API at `http://127.0.0.1:8000/api/v1` by default. To change this, modify the `API_BASE_URL` constant in `src/background/background.ts`.

## Project Structure

```
IsThisPhishy-addon/
├── src/
│   ├── background/          # Service worker (API calls, data processing)
│   ├── content/             # Content script (page content extraction)
│   ├── popup/               # React popup UI
│   │   ├── components/      # UI components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── services/        # Business logic (score calculation)
│   │   └── consts/          # Constants (scoring points)
│   ├── components/          # Shared UI components
│   ├── types/               # TypeScript type definitions
│   └── styles/              # Global CSS
├── dist/                    # Built extension (generated)
├── public/                  # Static assets
└── vite.config.ts           # Vite configuration
```

## License

This project is private and proprietary.

