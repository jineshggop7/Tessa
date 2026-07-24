# Tessa AI Test Automation (TestSmart)

Tessa is an AI-powered end-to-end test automation platform that automatically generates, writes, and executes test scripts based on screenshots and application configurations, providing real-time log feedback and a context-aware chatbot assistant.

---

## 🏗️ Project Architecture

The project consists of three main parts:
1. **Frontend (`/Frontend/test-smart`)**: An Angular 20 web application that serves as the control dashboard to trigger test runs, view execution history, and converse with the Tessa chatbot.
2. **Backend (`/Backend`)**: A FastAPI Python service that coordinates the AI agents (using Gemini and OpenAI models), manages the test script execution cycle, and streams log updates via WebSockets.
3. **Database (`/db`)**: Local MongoDB instance that stores execution histories, scenarios, test outcomes, and conversation contexts.

---

## 🛠️ Prerequisites

Ensure you have the following installed on your system:
- **Python**: version 3.10 or higher
- **Node.js**: version 18.x or higher (LTS recommended)
- **MongoDB**: A running instance on `mongodb://localhost:27017`

---

## 🚀 Getting Started

### 1. Database Setup
Start your local MongoDB instance. If you are using the pre-packaged MongoDB binaries in the project folder:
1. Open a terminal/command prompt.
2. Run the MongoDB daemon pointing to the `db` directory:
   ```bash
   ./mongodb-win32-x86_64-windows-8.2.1/bin/mongod --dbpath ./db
   ```
   *Otherwise, ensure your system-wide MongoDB service is running on its default port (`27017`).*

### 2. Backend Setup
1. Navigate to the `Backend` directory:
   ```bash
   cd Backend
   ```
2. Create a virtual environment:
   ```bash
   python -m venv venv
   ```
3. Activate the virtual environment:
   * **Windows (PowerShell)**:
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   * **macOS/Linux**:
     ```bash
     source venv/bin/activate
     ```
4. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```
5. Configure environment variables. Copy `.env.example` to `.env` and fill in your API keys:
   ```bash
   # In Backend directory
   copy .env.example .env   # Windows Command Prompt
   # OR
   cp .env.example .env     # Linux / macOS / PowerShell
   ```
   Inside `.env`, configure:
   ```env
   MONGODB_URL=mongodb://localhost:27017
   GEMINI_API_KEY=your_gemini_api_key_here
   OPENAI_API_KEY=your_openai_api_key_here
   ```
6. Start the FastAPI server:
   ```bash
   python app/main.py
   ```
   The backend server will run on `http://localhost:8000`. You can access the API docs at `http://localhost:8000/docs`.

### 3. Frontend Setup
1. Navigate to the frontend app directory:
   ```bash
   cd Frontend/test-smart
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm start
   # or
   ng serve
   ```
4. Open your browser and navigate to `http://localhost:4200/`.

---

## 📡 API Endpoints

* **`POST /api/start-execution`**: Initiate a test run using one or more application screenshots.
* **`POST /api/ask-tessa`**: Interact with Tessa, the context-aware chatbot helper.
* **`GET /api/execution-history`**: Fetch all previous test runs and executions.
* **`POST /api/rerun-execution`**: Rerun a past execution with modifications.
* **`ws://localhost:8000/ws/{execution_id}`**: WebSocket endpoint to receive real-time updates and console logs.

---

## 📦 How to Push to GitHub

To push this codebase to your public GitHub repository:

1. **Initialize Git** in the project root:
   ```bash
   git init
   ```
2. **Add Remote** (replace with your repository URL):
   ```bash
   git remote add origin https://github.com/your-username/your-repo-name.git
   ```
3. **Stage all files**:
   ```bash
   git add .
   ```
   *(Note: The root `.gitignore` will automatically exclude large database files, local MongoDB binaries, virtual environments, node_modules, and secret credentials).*
4. **Commit your changes**:
   ```bash
   git commit -m "Initial commit: Tessa AI Test Automation project"
   ```
5. **Rename default branch to main and Push**:
   ```bash
   git branch -M main
   git push -u origin main
   ```
"# Tessa" 
