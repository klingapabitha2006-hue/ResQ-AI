# 🚨 ResQ-AI
### AI-Powered Disaster Response and Rescue Prioritization System

## 📌 About the Project

ResQ-AI is a web-based disaster response system designed to help manage emergency reports and support rescue prioritization.

During disasters, multiple emergencies may occur simultaneously. Identifying critical incidents and coordinating rescue activities can be challenging. ResQ-AI provides a centralized platform to help users report emergencies and enable administrators to review reports and prioritize response activities.

## 🎯 Objectives

- To collect and manage emergency reports.
- To support emergency prioritization.
- To provide a centralized Command Center.
- To help administrators monitor reported incidents.
- To support informed disaster-response decisions.
- To improve emergency information management.

## ✨ Key Features

### 1. Emergency Reporting
Allows the public to submit emergency reports with incident details.

### 2. Command Center
Provides a centralized dashboard for administrators to view and monitor emergency reports.

### 3. Rescue Prioritization
Supports the identification of high-priority emergencies based on available incident information.

### 4. Emergency Monitoring
Helps administrators review submitted reports and track reported incidents.

### 5. Database Management
Stores and manages application information through the configured database.

### 6. AI-Assisted Support
Supports disaster-response activities through AI-assisted analysis, where implemented.

## 👥 User Roles

**Public**
- Submit emergency reports.
- Provide incident details.

**Administrator**
- View and manage emergency reports.
- Monitor reported incidents.
- Review emergency priorities.

**Rescue Teams**
- Review relevant emergency information.
- Use available priority information to support rescue planning.

## 🏗️ System Architecture

The system consists of the following components:

1. **Frontend:** User interface built with web technologies.
2. **Backend:** Handles application logic and requests.
3. **Database:** Stores application data.
4. **Command Center:** Displays emergency information for administrators.

### Workflow

```text
Public User
     |
     v
Submit Emergency Report
     |
     v
Frontend Interface
     |
     v
Backend Processing
     |
     v
Database
     |
     v
Admin Command Center
     |
     v
Review and Prioritize
     |
     v
Rescue Response
```

## 🛠️ Technologies Used

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Python
- **Database:** Configured application database
- **Version Control:** Git and GitHub
- **Deployment:** Render

## 🌐 Live Application

https://resq-ai-1-oytq.onrender.com/

## 💻 GitHub Repository

https://github.com/klingapabitha2006-hue/ResQ-AI

## 🚀 Installation and Setup

### Prerequisites

- Python
- Git
- Visual Studio Code or another code editor

### Step 1: Clone the Repository

```bash
git clone https://github.com/klingapabitha2006-hue/ResQ-AI.git
```

### Step 2: Open the Project

```bash
cd ResQ-AI
```

### Step 3: Set Up the Backend

```bash
cd backend
python -m venv venv
```

Activate the virtual environment on Windows:

```powershell
.\venv\Scripts\Activate.ps1
```

Install the dependencies:

```bash
pip install -r requirements.txt
```

Configure the required environment variables in a local `.env` file.

### Step 4: Run the Backend

Start the backend using the command appropriate for the framework and entry point configured in the project.

For example, if the project uses FastAPI with `main.py`:

```bash
uvicorn main:app --reload
```

### Step 5: Open the Frontend

Open the frontend using the project's configured local development server and ensure it connects to the correct backend URL.

## 🔐 Security

- Keep database credentials and API keys private.
- Do not upload secret `.env` files to GitHub.
- Do not expose private certificates or sensitive configuration files.
- Store production secrets securely in the hosting environment.

## 🔮 Future Enhancements

- Improved emergency prioritization.
- Real-time emergency updates.
- Map-based incident visualization.
- Enhanced rescue team coordination.
- Additional disaster-response integrations.

## 🎓 Project Information

- **Project Title:** ResQ-AI
- **Project Type:** Final-Year Academic Project
- **Department:** Computer Science and Engineering

## 📄 Disclaimer

ResQ-AI is intended to support emergency information management and rescue planning. It does not replace professional emergency services or decisions made by qualified rescue personnel.
