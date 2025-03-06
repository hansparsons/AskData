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

## Database Connection Guide

### 1. MySQL

#### Installation
```bash
npm install mysql2
```

#### Connection Pooling
```javascript
const mysql = require('mysql2');
const pool = mysql.createPool({
    host: 'your_host',
    user: 'your_user',
    password: 'your_password',
    database: 'your_database',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool.promise();
```

#### Query Execution
```javascript
async function getUsers() {
    try {
        const pool = require('./db');
        const [rows] = await pool.query('SELECT * FROM users WHERE status = ?', ['active']);
        console.log(rows);
    } catch (err) {
        console.error('MySQL Query Error:', err);
    }
}
```

### 2. PostgreSQL

#### Installation
```bash
npm install pg
```

#### Connection Pooling
```javascript
const { Pool } = require('pg');
const pool = new Pool({
    host: 'your_host',
    user: 'your_user',
    password: 'your_password',
    database: 'your_database',
    port: 5432,
    max: 10,
    idleTimeoutMillis: 30000
});

module.exports = pool;
```

#### Query Execution
```javascript
async function getUsers() {
    try {
        const pool = require('./db');
        const { rows } = await pool.query('SELECT * FROM users WHERE status = $1', ['active']);
        console.log(rows);
    } catch (err) {
        console.error('PostgreSQL Query Error:', err);
    }
}
```

### 3. Microsoft SQL Server

#### Installation
```bash
npm install mssql
```

#### Connection Pooling
```javascript
const sql = require('mssql');
const poolPromise = new sql.ConnectionPool({
    user: 'your_user',
    password: 'your_password',
    server: 'your_host',
    database: 'your_database',
    options: { encrypt: true, trustServerCertificate: true },
    pool: {
        max: 10,
        min: 2,
        idleTimeoutMillis: 30000
    }
}).connect();

module.exports = poolPromise;
```

#### Query Execution
```javascript
async function getUsers() {
    try {
        const pool = await require('./db');
        const result = await pool.request()
            .input('status', sql.VarChar, 'active')
            .query('SELECT * FROM users WHERE status = @status');
        console.log(result.recordset);
    } catch (err) {
        console.error('SQL Server Query Error:', err);
    }
}
```

### 4. Oracle Database

#### Installation
```bash
npm install oracledb
```

#### Connection Pooling
```javascript
const oracledb = require('oracledb');

async function init() {
    try {
        await oracledb.createPool({
            user: 'your_user',
            password: 'your_password',
            connectString: 'your_host:1521/your_service_name',
            poolMax: 10,
            poolMin: 2,
            poolTimeout: 60
        });
        console.log('Oracle Connection Pool Initialized');
    } catch (err) {
        console.error('Oracle Connection Pool Error:', err);
    }
}
```

#### Query Execution
```javascript
async function getUsers() {
    try {
        const connection = await oracledb.getConnection();
        const result = await connection.execute(
            'SELECT * FROM users WHERE status = :status',
            ['active']
        );
        console.log(result.rows);
        await connection.close();
    } catch (err) {
        console.error('Oracle Query Error:', err);
    }
}
```

### 5. SQLite

#### Installation
```bash
npm install sqlite3
```

#### Connection Setup
```javascript
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('your_database.db', (err) => {
    if (err) console.error('SQLite Connection Error:', err);
    else console.log('Connected to SQLite');
});

module.exports = db;
```

#### Query Execution
```javascript
function getUsers() {
    db.all('SELECT * FROM users WHERE status = ?', ['active'], (err, rows) => {
        if (err) console.error('SQLite Query Error:', err);
        else console.log(rows);
    });
}
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.
