import { useState, useRef } from 'react'
import './App.css'

function App() {
  const [selectedDataSource, setSelectedDataSource] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sqlQuery, setSqlQuery] = useState('')
  const [queryResults, setQueryResults] = useState<any>(null)
  const [naturalLanguageAnswer, setNaturalLanguageAnswer] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadError(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const data = await response.json()
      setSelectedDataSource(data.filename)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to upload file')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleQuerySubmit = async () => {
    if (!selectedDataSource || !query.trim()) return

    setIsExecuting(true)
    setUploadError(null)
    setNaturalLanguageAnswer('')
    setQueryResults(null)

    try {
      const response = await fetch('http://localhost:3000/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: query,
          selectedSources: [selectedDataSource],
        }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.message || 'Query execution failed')
      }

      setSqlQuery(data.sql)
      setShowConfirmation(true)
    } catch (error) {
      console.error('Error generating SQL query:', error)
      setUploadError(error instanceof Error ? error.message : 'Failed to generate SQL query. Please try again.')
      setShowConfirmation(false)
    } finally {
      setIsExecuting(false)
    }
  }

  const handleQueryConfirmation = async (execute: boolean) => {
    if (!execute) {
      setShowConfirmation(false)
      return
    }

    setIsExecuting(true)
    try {
      const response = await fetch('http://localhost:3000/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: query,
          selectedSources: [selectedDataSource],
          execute: true
        }),
      })

      if (!response.ok) {
        throw new Error('Query execution failed')
      }

      const data = await response.json()
      setQueryResults(data.results)
      setNaturalLanguageAnswer(data.answer)
    } catch (error) {
      console.error('Error executing query:', error)
      setNaturalLanguageAnswer('Failed to execute the query. Please try again.')
    } finally {
      setShowConfirmation(false)
      setIsExecuting(false)
    }
  }

  return (
    <div className="app-container">
      {/* Left Pane - Data Source Selection */}
      <div className="left-pane">
        <h2>Data Sources</h2>
        <div className="data-source-list">
          {selectedDataSource && (
            <div className="selected-source">
              <h3>Selected Source:</h3>
              <p>{selectedDataSource}</p>
            </div>
          )}
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileUpload}
            accept=".xlsx,.xls,.docx,.pdf"
          />
          <button 
            className="source-button" 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : 'Upload File'}
          </button>
          {uploadError && <div className="error-message">{uploadError}</div>}
          <button className="source-button">Connect Database</button>
        </div>
      </div>

      {/* Main Area - Query Input and Results */}
      <div className="main-area">
        <div className="query-section">
          <h2>Natural Language Query</h2>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter your query in natural language..."
            className="query-input"
          />
          <button 
            className="execute-button"
            onClick={handleQuerySubmit}
            disabled={!selectedDataSource || isExecuting}
          >
            {isExecuting ? 'Processing...' : 'Execute Query'}
          </button>
        </div>

        {showConfirmation && (
          <div className="confirmation-section">
            <h3>Generated SQL Query:</h3>
            <pre className="sql-preview">{sqlQuery}</pre>
            <div className="confirmation-buttons">
              <button onClick={() => handleQueryConfirmation(true)}>Execute</button>
              <button onClick={() => handleQueryConfirmation(false)}>Cancel</button>
            </div>
          </div>
        )}

        <div className="results-section">
          {naturalLanguageAnswer && (
            <div className="answer-container">
              <h3>Answer:</h3>
              <p>{naturalLanguageAnswer}</p>
            </div>
          )}
          {queryResults && (
            <div className="results-container">
              <h3>Results:</h3>
              <pre>{JSON.stringify(queryResults, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>

      {/* Right Pane - Visualization Options */}
      <div className="right-pane">
        <h2>Visualization</h2>
        <div className="visualization-options">
          <button className="viz-button" disabled={!queryResults}>Bar Chart</button>
          <button className="viz-button" disabled={!queryResults}>Line Chart</button>
          <button className="viz-button" disabled={!queryResults}>Pie Chart</button>
          <button className="viz-button" disabled={!queryResults}>Export</button>
        </div>
      </div>
    </div>
  )
}

export default App
