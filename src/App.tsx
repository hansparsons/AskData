import { useState, useRef, useEffect } from 'react'
import './App.css'
import ChartModal from './components/ChartModal'
import ExportDialog from './components/ExportDialog'
import DataGridModal from './components/DataGridModal'
import DatabaseWizard from './components/DatabaseWizard';
import ChatMessage from './components/ChatMessage';
import SendIcon from '@mui/icons-material/Send';
import StopIcon from '@mui/icons-material/Stop';

function App() {
  // Add this state variable with your other state declarations
  const [databaseModalVisible, setDatabaseModalVisible] = useState(false);
  
  const [dataSources, setDataSources] = useState<Array<{id: number, name: string, type: string}>>([])
  const [selectedDataSource, setSelectedDataSource] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isLoadingDataSources, setIsLoadingDataSources] = useState(false)
  const [query, setQuery] = useState('')
  const [sqlQuery, setSqlQuery] = useState('')
  const [queryResults, setQueryResults] = useState<any>(null)
  const [naturalLanguageAnswer, setNaturalLanguageAnswer] = useState('')
  const [chatHistory, setChatHistory] = useState<Array<{role: 'user' | 'assistant', content: string}>>([])  
  const [lastSuccessfulQuery, setLastSuccessfulQuery] = useState('')
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
  const [showDataGridModal, setShowDataGridModal] = useState(false)
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
    
    // Add user message to chat history
    setChatHistory(prev => [...prev, { role: 'user', content: query }])

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
      // Don't set isExecuting to false here
      // Instead, let handleQueryConfirmation handle it
      handleQueryConfirmation(true)
    } catch (error) {
      console.error('Error generating SQL query:', error)
      setUploadError(error instanceof Error ? error.message : 'Failed to generate SQL query. Please try again.')
      setShowConfirmation(false)
      setIsExecuting(false) // Only set to false on error
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
      
      // Add assistant response to chat history
      if (data.answer) {
        setChatHistory(prev => [...prev, { role: 'assistant', content: data.answer }])
      }
      
      // Store the last successful query before clearing the input
      setLastSuccessfulQuery(query)
      
      // Clear the query input after sending
      setQuery('')
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
    console.log('Chart button clicked:', { type, queryResults });
    if (!queryResults) {
      console.log('No query results available');
      setUploadError('Missing query results');
      return;
    }
    
    // Use lastSuccessfulQuery instead of the current query input
    const questionText = lastSuccessfulQuery || query.trim();
    if (!questionText) {
      console.log('No question available');
      setUploadError('Missing question');
      return;
    }
      
    try {
      setChartType(type);
      setIsLoadingChart(true);
      setChartData(null);
        
      console.log('Preparing chart data request:', {
        question: query,
        data: queryResults,
        chartType: type
      });
    
      const requestBody = {
        question: questionText,
        data: queryResults,
        chartType: type,
        selectedModel: selectedModel,
        includeAnswer: includeAnswerInChart && naturalLanguageAnswer ? true : false
      };

      if (includeAnswerInChart && naturalLanguageAnswer) {
        requestBody.data = {
          results: queryResults,
          answer: naturalLanguageAnswer
        };
      }
    
      const response = await fetch('http://localhost:3000/api/chart-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
    
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Chart data API error:', errorData);
        throw new Error(errorData.error || 'Chart data generation failed');
      }
    
      const data = await response.json();
      console.log('Received chart data:', data);
        
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid chart data received');
      }
        
      setChartData(data);
      setShowChartModal(true);
    } catch (error) {
      console.error('Detailed chart error:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      setUploadError(error instanceof Error ? error.message : 'Failed to generate chart');
      setChartData(null);
      setShowChartModal(false);
    } finally {
      setIsLoadingChart(false);
    }
  }

  // Handle saving database connection
  const handleSaveDatabaseConnection = async (values: any) => {
    try {
      console.log("[DEBUG] Saving database connection with values:", values);
      const response = await fetch('http://localhost:3000/api/databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          type: values.type,
          host: values.host,
          port: parseInt(values.port),
          database: values.database,
          username: values.username,
          password: values.password,
          schema: values.schema // Add schema data to the request
        }),
      });

      console.log("[DEBUG] Server response status:", response.status);
      const responseData = await response.json();
      console.log("[DEBUG] Server response data:", responseData);

      if (!response.ok) {
        throw new Error(`Failed to save database connection: ${responseData.error || 'Unknown error'}`);
      }

      // Refresh data sources after successful connection
      const sourcesResponse = await fetch('http://localhost:3000/api/data-sources');
      if (!sourcesResponse.ok) {
        throw new Error('Failed to fetch updated data sources');
      }
      const sourcesData = await sourcesResponse.json();
      if (sourcesData.dataSources && Array.isArray(sourcesData.dataSources)) {
        setDataSources(sourcesData.dataSources);
      }

      // Close the modal
      setDatabaseModalVisible(false);
      
      // Show success message
      setUploadError(null);
    } catch (error) {
      console.error('Error saving database connection:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to save database connection');
    }
  };

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
          <button 
            className="source-button"
            onClick={() => {
              console.log('Opening database modal...');
              setDatabaseModalVisible(true);
            }}
          >
            Connect Database
          </button>
        </div>
      </div>

      {/* Main Area - Query Input and Results */}
      <div className="main-area">
        <div className="query-section">
          <h2>Chat with Your Data</h2>
          <div className="chat-messages">
            {chatHistory.map((message, index) => (
              <ChatMessage
                key={index}
                role={message.role}
                content={message.content}
              />
            ))}
            {isExecuting && (
              <ChatMessage
                role="user"
                content={query}
                isLoading={true}
              />
            )}
          </div>
          <div className="chat-input">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question about your data..."
              className="query-input"
            />
            <button 
              className="execute-button"
              onClick={handleQuerySubmit}
              disabled={!selectedDataSource || !query.trim() || isExecuting}
            >
              {isExecuting ? <StopIcon /> : <SendIcon />}
            </button>
          </div>
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
            onClick={() => setShowDataGridModal(true)}
          >
            Show Data
          </button>
          <button 
            className="viz-button" 
            disabled={!queryResults}
            onClick={() => setShowExportDialog(true)}
          >
            Export Data
          </button>
        </div>
        
        {/* Removed the confirmation section with execute/cancel buttons */}
        
        {sqlQuery && (
          <div className="confirmation-section">
            <h3>Generated SQL Query:</h3>
            <pre className="sql-preview">{sqlQuery}</pre>
          </div>
        )}

        {queryResults && (
          <div className="results-container">
            <h3>Results:</h3>
            <pre>{JSON.stringify(queryResults, null, 2)}</pre>
          </div>
        )}
      </div>

      {/* Modals */}
      {showChartModal && chartData && (
        <ChartModal
          isOpen={showChartModal}
          onClose={() => setShowChartModal(false)}
          chartType={chartType}
          data={chartData}
          question={query}
        />
      )}

      {showDataGridModal && queryResults && (
        <DataGridModal
          isOpen={showDataGridModal}
          onClose={() => setShowDataGridModal(false)}
          data={queryResults}
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

      {showExportDialog && (
        <ExportDialog
          isOpen={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          sqlQuery={sqlQuery}
          answer={naturalLanguageAnswer}
          results={queryResults}
        />
      )}
      
      {/* Add the DatabaseConnectionModal */}
      <DatabaseWizard
        visible={databaseModalVisible}
        onClose={() => setDatabaseModalVisible(false)}
        onSave={handleSaveDatabaseConnection}
      />
    </div>
  )
}

export default App
