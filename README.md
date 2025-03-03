# AskData - Data Analysis Application

## Overview

AskData is a powerful data analysis application that enables data analysts to query multiple data sources using natural language. The application leverages a locally running Large Language Model (Mixtral via Ollama) to translate natural language questions into SQL queries, execute them, and provide human-readable answers with optional visualizations.

### Key Features

- **Multiple Data Source Support**: Import and query data from Excel files, Google Spreadsheets, Word documents, PDFs, and external SQL databases.
- **Natural Language Querying**: Ask questions about your data in plain English.
- **SQL Generation**: Automatically generates SQL queries based on your questions.
- **Data Visualization**: Create bar charts, line charts, and pie charts from your query results.
- **Data Grid View**: View and analyze your query results in a structured, interactive grid format.
- **Advanced Export Options**: Export your data, queries, and answers in multiple formats:
  - Results: Excel, CSV, TSV, JSON
  - SQL Queries: SQL, TXT
  - Answers: TXT, PDF, Microsoft Word
- **Unified Data Interface**: All data sources are converted to a SQL-like format for consistent querying.
- **Modern UI**: Clean, intuitive interface with a chat-like experience for data interaction.

## Prerequisites

- Node.js (v16 or higher)
- MySQL database server
- Ollama framework with Mixtral model installed

## Installation

### Setting up the Frontend

1. Clone the repository and navigate to the AskData directory:

```bash
cd AskData
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

### Setting up the Backend

1. Navigate to the server directory:

```bash
cd server
```

2. Install dependencies:

```bash
npm install
```

3. Make sure MySQL is running with the following configuration:
   - Username: root
   - Password: password
   - Database: dataask (will be created automatically if it doesn't exist)

4. Start the server:

```bash
npm run dev
```

### Setting up Ollama

1. Install Ollama from [https://ollama.ai/](https://ollama.ai/)

2. Pull the Mixtral model:

```bash
ollama pull mixtral
```

3. Ensure Ollama is running in the background before starting the application.

## Usage

1. Open the application in your browser (typically at http://localhost:5174)

2. Upload data sources:
   - Use the upload button to add Excel files, Word documents, or PDFs
   - Connect to external SQL databases using the connection form
   - Connect to Google Spreadsheets using the provided interface

3. Select one or more data sources from the left panel

4. Type your question in the chat interface

5. Review the generated SQL query and confirm execution

6. View and interact with your results:
   - Read the natural language answer
   - Examine the raw data in the results section
   - View the data in the interactive grid view
   - Create visualizations (bar, line, or pie charts)
   - Export results in your preferred format

## Building for Production

To build the application for production:

1. Build the frontend:
```bash
cd AskData
npm run build
```

2. Build the backend:
```bash
cd server
npm run build
```

3. Deploy the built files to your production server

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
