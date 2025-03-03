import { useState, useRef, useEffect } from 'react'
import './App.css'
import ChartModal from './components/ChartModal'
import ExportDialog from './components/ExportDialog'

function App() {
  const [dataSources, setDataSources] = useState<Array<{id: number, name: string, type: string}>>([])
  const [selectedDataSource, setSelectedDataSource] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isLoadingDataSources, setIsLoadingDataSources] = useState(false)
  const [query, setQuery] = useState('')
  const [sqlQuery, setSqlQuery] = useState('')
  const [queryResults, setQueryResults] = useState<any>(null)
  const [naturalLanguageAnswer, setNaturalLanguageAnswer] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [showChartModal, setShowChartModal] = useState(false)
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar')
  const [chartData, setChartData] = useState<any>(null)
  const [isLoadingChart, setIsLoadingChart] = useState(false)
  const [includeAnswerInChart, setIncludeAnswerInChart] = useState(false)
  const [availableModels, setAvailableModels] = useState<Array<{name: string, provider?: string, requiresApiKey?: boolean}>>([]) 
  const [selectedModel, setSelectedModel] = useState<string>('llama3')
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)
  const [openaiApiKey, setOpenaiApiKey] = useState('')
  const [isSettingApiKey, setIsSettingApiKey] = useState(false)
  const [apiKeyError, setApiKeyError] = useState<string | null>(null)
  const [showExportDialog, setShowExportDialog] = useState(false)
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
      
      // Refresh the data sources list after successful upload
      const sourcesResponse = await fetch('http://localhost:3000/api/data-sources')
      if (!sourcesResponse.ok) {
        throw new Error('Failed to fetch updated data sources')
      }
      const sourcesData = await sourcesResponse.json()
      if (sourcesData.dataSources && Array.isArray(sourcesData.dataSources)) {
        setDataSources(sourcesData.dataSources)
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to upload file')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Add useEffect to log button state conditions whenever they change
  useEffect(() => {
    console.log('Button state conditions updated:', {
      selectedDataSource,
      queryTrimmed: query.trim(),
      isExecuting,
      buttonDisabled: !selectedDataSource || !query.trim() || isExecuting
    })
  }, [selectedDataSource, query, isExecuting])

  // Fetch data sources when component mounts
  useEffect(() => {
    const fetchDataSources = async () => {
      setIsLoadingDataSources(true)
      try {
        const response = await fetch('http://localhost:3000/api/data-sources')
        if (!response.ok) {
          throw new Error('Failed to fetch data sources')
        }
        const data = await response.json()
        if (data.dataSources && Array.isArray(data.dataSources)) {
          setDataSources(data.dataSources)
        }
      } catch (error) {
        console.error('Error fetching data sources:', error)
        setUploadError(error instanceof Error ? error.message : 'Failed to fetch data sources')
      } finally {
        setIsLoadingDataSources(false)
      }
    }

    fetchDataSources()
  }, [])

  // Fetch available models when component mounts
  useEffect(() => {
    const fetchModels = async () => {
      setIsLoadingModels(true)
      try {
        const response = await fetch('http://localhost:3000/api/models')
        if (!response.ok) {
          throw new Error('Failed to fetch models')
        }
        const data = await response.json()
        if (data.models && Array.isArray(data.models)) {
          setAvailableModels(data.models)
          // Set the first model as selected if available
          if (data.models.length > 0) {
            setSelectedModel(data.models[0].name)
          }
        }
      } catch (error) {
        console.error('Error fetching models:', error)
        setUploadError(error instanceof Error ? error.message : 'Failed to fetch available models')
      } finally {
        setIsLoadingModels(false)
      }
    }

    fetchModels()
  }, [])
  
  // Handle model selection change
  const handleModelChange = (modelName: string) => {
    setSelectedModel(modelName)
    
    // Reset executing state when changing models
    setIsExecuting(false)
    
    // Check if the selected model is an OpenAI model that requires an API key
    const selectedModelInfo = availableModels.find(model => model.name === modelName)
    if (selectedModelInfo?.provider === 'openai' && selectedModelInfo?.requiresApiKey) {
      setShowApiKeyModal(true)
    }
  }
  
  // Handle API key submission
  const handleApiKeySubmit = async () => {
    if (!openaiApiKey.trim()) {
      setApiKeyError('API key is required')
      return
    }
    
    setIsSettingApiKey(true)
    setApiKeyError(null)
    setIsExecuting(false)  // Reset executing state
    
    try {
      const response = await fetch('http://localhost:3000/api/set-openai-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: openaiApiKey }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to set API key')
      }
      
      // Close the modal on success
      setShowApiKeyModal(false)
      
      // Clear any previous error messages
      setUploadError(null)
      setApiKeyError(null)
      
      // If there was an error message displayed in the natural language answer area about API key,
      // clear it so the user knows the API key has been successfully set
      if (naturalLanguageAnswer && naturalLanguageAnswer.includes('OpenAI API key is required')) {
        setNaturalLanguageAnswer('')
      }

      // Add debug logging
      console.log('API key set successfully, button state:', {
        selectedDataSource,
        queryTrimmed: query.trim(),
        isExecuting: false
      })
    } catch (error) {
      console.error('Error setting API key:', error)
      setApiKeyError(error instanceof Error ? error.message : 'Failed to set API key')
      // Remove this line that was setting isExecuting to true on error
      // setIsExecuting(true)  
    } finally {
      setIsSettingApiKey(false)
      setIsExecuting(false)  // Always ensure executing state is reset
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
          selectedModel: selectedModel
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
          selectedModel: selectedModel,
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
      
      // Check if the error is related to missing OpenAI API key
      const errorMessage = error instanceof Error ? error.message : 'Failed to execute the query. Please try again.'
      setNaturalLanguageAnswer(errorMessage)
      
      // If the error is about missing OpenAI API key, show the API key modal
      if (errorMessage.includes('OpenAI API key is required')) {
        setShowApiKeyModal(true)
      }
    } finally {
      setShowConfirmation(false)
      setIsExecuting(false)
    }
  }

  const handleChartButtonClick = async (type: 'bar' | 'line' | 'pie') => {
    console.log('Chart button clicked:', { type, queryResults })
    if (!queryResults) {
      console.log('No query results available')
      return
    }
      
    try {
      // Log the query results structure
      console.log('Query results structure:', {
        isArray: Array.isArray(queryResults),
        type: typeof queryResults,
        length: Array.isArray(queryResults) ? queryResults.length : 'N/A',
        sample: queryResults
      })
    
      // Validate query results structure
      if (typeof queryResults !== 'object' || !Array.isArray(queryResults)) {
        throw new Error('Invalid query results format')
      }
        
      setChartType(type)
      setIsLoadingChart(true)
      setChartData(null)
        
      console.log('Preparing chart data request:', {
        question: query,
        includeAnswer: includeAnswerInChart,
        hasNaturalLanguageAnswer: !!naturalLanguageAnswer
      })
    
      const response = await fetch('http://localhost:3000/api/chart-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: query,
          data: naturalLanguageAnswer && includeAnswerInChart ? { results: queryResults, answer: naturalLanguageAnswer } : queryResults,
          chartType: type,
          selectedModel: selectedModel
        }),
      })
    
      if (!response.ok) {
        const errorData = await response.json()
        console.error('Chart data API error:', errorData)
        throw new Error(errorData.message || 'Chart data generation failed')
      }
    
      const data = await response.json()
      console.log('Received chart data:', data)
        
      // Validate received chart data
      if (!data || typeof data !== 'object') {
        console.error('Invalid chart data structure:', data)
        throw new Error('Invalid chart data received')
      }
        
      setChartData(data)
      setShowChartModal(true)
    } catch (error) {
      console.error('Detailed chart error:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
      setUploadError(error instanceof Error ? error.message : 'Failed to generate chart')
      setChartData(null)
      setShowChartModal(false)
    } finally {
      setIsLoadingChart(false)
    }
  }

  return (
    <div className="app-container">
      {/* Left Pane - Data Source Selection */}
      <div className="left-pane">
        <h2>Data Sources</h2>
        <div className="model-selection">
          <h3>LLM Model</h3>
          <select 
            value={selectedModel} 
            onChange={(e) => handleModelChange(e.target.value)}
            disabled={isLoadingModels || isExecuting}
            className="model-dropdown"
          >
            {isLoadingModels ? (
              <option>Loading models...</option>
            ) : availableModels.length === 0 ? (
              <option>No models available</option>
            ) : (
              availableModels.map(model => (
                <option key={model.name} value={model.name}>
                  {model.name}{model.provider === 'openai' ? ' (OpenAI)' : ''}
                </option>
              ))
            )}
          </select>
        </div>
        <div className="data-source-list">
          <div className="data-sources">
            <h3>Available Sources:</h3>
            {isLoadingDataSources ? (
              <p>Loading data sources...</p>
            ) : dataSources.length === 0 ? (
              <p>No data sources available</p>
            ) : (
              <div className="source-list">
                {dataSources.map(source => (
                  <div 
                    key={source.id} 
                    className={`source-item ${selectedDataSource === source.name ? 'selected' : ''}`}
                    onClick={() => setSelectedDataSource(source.name)}
                  >
                    <span className="source-name">{source.name}</span>
                    <span className="source-type">{source.type}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
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
            disabled={!selectedDataSource || !query.trim() || isExecuting}
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
        <h2>Options</h2>
        <div className="visualization-options">
          <button 
            className="viz-button" 
            disabled={!queryResults || isLoadingChart} 
            onClick={() => handleChartButtonClick('bar')}
          >
            {isLoadingChart && chartType === 'bar' ? 'Creating Chart...' : 'Create Chart'}
          </button>
          <button 
            className="viz-button" 
            disabled={!queryResults}
            onClick={() => setShowExportDialog(true)}
          >
            Save Data
          </button>
          <div className="chart-options">
            <label className="include-answer-label">
              <input
                type="checkbox"
                checked={includeAnswerInChart}
                onChange={(e) => setIncludeAnswerInChart(e.target.checked)}
                disabled={!naturalLanguageAnswer}
              />
              Include answer text when creating chart
            </label>
          </div>
        </div>
      </div>
      
      {/* Chart Modal */}
      {showChartModal && (
        <ChartModal
          isOpen={showChartModal}
          onClose={() => {
            setShowChartModal(false);
            setChartData(null);
          }}
          chartType={chartType}
          data={chartData || queryResults}
          question={query}
        />
      )}
      
      {/* Export Dialog */}
      {showExportDialog && (
        <ExportDialog
          isOpen={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          sqlQuery={sqlQuery}
          answer={naturalLanguageAnswer}
          results={queryResults}
        />
      )}
      
      {/* OpenAI API Key Modal */}
      {showApiKeyModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>OpenAI API Key Required</h2>
            <p>Please enter your OpenAI API key to use the GPT-4o model.</p>
            
            <div className="api-key-input">
              <input
                type="password"
                value={openaiApiKey}
                onChange={(e) => setOpenaiApiKey(e.target.value)}
                placeholder="Enter your OpenAI API key"
                disabled={isSettingApiKey}
              />
            </div>
            
            {apiKeyError && <div className="error-message">{apiKeyError}</div>}
            
            <div className="modal-buttons">
              <button 
                onClick={handleApiKeySubmit}
                disabled={isSettingApiKey}
              >
                {isSettingApiKey ? 'Saving...' : 'Save API Key'}
              </button>
              <button 
                onClick={() => {
                  setShowApiKeyModal(false);
                  // Revert to previous model if user cancels
                  const previousModel = availableModels.find(model => !model.requiresApiKey);
                  if (previousModel) {
                    setSelectedModel(previousModel.name);
                  }
                }}
                disabled={isSettingApiKey}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
