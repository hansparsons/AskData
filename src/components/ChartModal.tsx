import { useState, useEffect } from 'react';
import './ChartModal.css';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface ChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  chartType: 'bar' | 'line' | 'pie';
  data: any; // Changed from any[] to any to handle different data structures
  question: string;
}

const ChartModal = ({ isOpen, onClose, chartType, data, question }: ChartModalProps) => {
  const [chartData, setChartData] = useState<any>(null);
  const [chartOptions, setChartOptions] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [questionContext, setQuestionContext] = useState<string | null>(null);

  useEffect(() => {
    if (!data) {
      setError('No data available for visualization');
      return;
    }
    
    // Extract questionContext if available
    if (data.questionContext) {
      setQuestionContext(data.questionContext);
    } else {
      setQuestionContext(null);
    }

    try {
      // Log the data structure to help with debugging
      console.log('Chart data received:', data);
      
      // Check if data is already in the format returned by the LLM chart data endpoint
      if (data.chartData && data.title) {
        // Data is already processed by LLM
        const chartDataConfig = data.chartData;
        
        // Ensure colors are applied to the datasets
        if (chartDataConfig.datasets && chartDataConfig.datasets.length > 0) {
          // Apply colors to each dataset if they don't already have colors
          chartDataConfig.datasets.forEach((dataset: any, index: number) => {
            if (!dataset.backgroundColor) {
              if (chartType === 'pie' || chartType === 'bar') {
                dataset.backgroundColor = generateColors(chartDataConfig.labels.length, chartType);
              } else {
                dataset.backgroundColor = 'rgba(75, 192, 192, 0.6)';
                dataset.borderColor = 'rgba(75, 192, 192, 1)';
              }
            }
          });
        }
        
        // Create chart options with the LLM-generated title
        const chartOptionsConfig = {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top' as const,
            },
            title: {
              display: true,
              text: data.title,
              font: {
                size: 16,
              },
            },
            tooltip: {
              callbacks: {
                footer: function(tooltipItems: any) {
                  return data.insights ? data.insights : '';
                }
              }
            }
          },
        };

        setChartData(chartDataConfig);
        setChartOptions(chartOptionsConfig);
        setError(null);
        return;
      }
      
      // Check if data contains both results and answer from LLM
      if (data.results && data.answer) {
        console.log('Using data with natural language answer for visualization');
        // We'll process the raw results, but the chart generation has already
        // taken the natural language answer into account on the server side
        const processedData = data.results;
        if (Array.isArray(processedData)) {
          // Continue with normal processing using the results array
        } else {
          setError('Invalid data structure: results is not an array');
          return;
        }
      }
      
      // If not LLM-processed data, handle raw data as before
      let processedData: any[] = [];
      
      // Handle different data structures
      if (Array.isArray(data)) {
        // Direct array
        processedData = data;
      } else if (data.results && Array.isArray(data.results)) {
        // Nested in results property
        processedData = data.results;
      } else if (typeof data === 'object' && data !== null) {
        // Convert object to array if it's not already an array
        processedData = [data];
      }
      
      // Handle case where data might be an array of arrays (e.g., from SQL results)
      if (Array.isArray(processedData) && processedData.length > 0 && Array.isArray(processedData[0])) {
        // Convert array of arrays to array of objects
        const headers = processedData[0];
        processedData = processedData.slice(1).map(row => {
          const obj: Record<string, any> = {};
          headers.forEach((header: string, index: number) => {
            obj[header] = row[index];
          });
          return obj;
        });
      }
      
      // Ensure we have data to work with
      if (processedData.length === 0) {
        setError('No data available for visualization after processing');
        return;
      }
      
      // Extract column names from the first data object
      const columns = Object.keys(processedData[0]);
      
      // For charts, we typically need at least two columns (labels and values)
      if (columns.length < 2) {
        setError('Data must have at least two columns for visualization');
        return;
      }

      // Determine which columns to use for labels and data
      // By default, use the first column for labels and second for data
      const labelColumn = columns[0];
      const dataColumn = columns[1];
      
      // Try to find numeric columns for data if available
      let numericColumn = dataColumn;
      for (let i = 1; i < columns.length; i++) {
        const col = columns[i];
        const sampleValue = processedData[0][col];
        if (typeof sampleValue === 'number' || !isNaN(Number(sampleValue))) {
          numericColumn = col;
          break;
        }
      }

      // Extract labels and data values
      const labels = processedData.map(item => item[labelColumn]);
      const values = processedData.map(item => {
        const val = item[numericColumn];
        return typeof val === 'number' ? val : Number(val) || 0;
      });

      // Generate a title based on the question
      const title = generateChartTitle(question, chartType, labelColumn, numericColumn);

      // Create chart data structure
      const chartDataConfig = {
        labels,
        datasets: [
          {
            label: numericColumn,
            data: values,
            backgroundColor: generateColors(processedData.length, chartType),
            borderColor: chartType !== 'pie' ? 'rgba(75, 192, 192, 1)' : undefined,
            borderWidth: 1,
          },
        ],
      };

      // Create chart options
      const chartOptionsConfig = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top' as const,
          },
          title: {
            display: true,
            text: title,
            font: {
              size: 16,
            },
          },
        },
      };

      setChartData(chartDataConfig);
      setChartOptions(chartOptionsConfig);
      setError(null);
    } catch (err) {
      console.error('Error preparing chart data:', err);
      setError('Failed to prepare chart data: ' + (err instanceof Error ? err.message : String(err)));
    }
  }, [data, chartType, question]);

  // Generate chart title based on the question and data
  const generateChartTitle = (question: string, chartType: string, labelColumn: string, dataColumn: string) => {
    // If the question contains a chart request, use it as the title
    if (question.toLowerCase().includes('chart') || 
        question.toLowerCase().includes('graph') || 
        question.toLowerCase().includes('plot')) {
      return question;
    }
    
    // Otherwise, generate a title based on the chart type and columns
    return `${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart of ${dataColumn} by ${labelColumn}`;
  };

  // Generate colors for chart elements
  const generateColors = (count: number, type: string) => {
    const baseColors = [
      'rgba(75, 192, 192, 0.6)',
      'rgba(255, 99, 132, 0.6)',
      'rgba(54, 162, 235, 0.6)',
      'rgba(255, 206, 86, 0.6)',
      'rgba(153, 102, 255, 0.6)',
      'rgba(255, 159, 64, 0.6)',
      'rgba(199, 199, 199, 0.6)',
      'rgba(83, 102, 255, 0.6)',
      'rgba(78, 129, 188, 0.6)',
      'rgba(225, 99, 99, 0.6)',
    ];

    // For pie charts and bar charts, we need one color per data point
    if (type === 'pie' || type === 'bar') {
      return Array.from({ length: count }, (_, i) => baseColors[i % baseColors.length]);
    }
    
    // For line charts, we use a single color with higher opacity
    return 'rgba(75, 192, 192, 1)';
  };

  if (!isOpen) return null;

  return (
    <div className="chart-modal-overlay">
      <div className="chart-modal">
        <div className="chart-modal-header">
          <h2>Data Visualization</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="chart-modal-content">
          {questionContext && (
            <div className="chart-context">
              <h3>Context</h3>
              <p>{questionContext}</p>
            </div>
          )}
          {error ? (
            <div className="chart-error">{error}</div>
          ) : !chartData ? (
            <div className="chart-loading">Preparing chart...</div>
          ) : (
            <div className="chart-container">
              {chartType === 'bar' && <Bar data={chartData} options={chartOptions} />}
              {chartType === 'line' && <Line data={chartData} options={chartOptions} />}
              {chartType === 'pie' && <Pie data={chartData} options={chartOptions} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChartModal;