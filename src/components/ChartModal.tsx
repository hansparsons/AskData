import { useState, useEffect, useRef } from 'react';
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
  Zoom,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { HexColorPicker } from 'react-colorful';
import * as htmlToImage from 'html-to-image';

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
  Legend,
  ChartDataLabels
);

interface ChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  chartType: 'bar' | 'line' | 'pie';
  data: any; // Changed from any[] to any to handle different data structures
  question: string;
}

interface ExportOptions {
  resolution: 'standard' | 'high' | 'print';
  format: 'png' | 'jpeg' | 'svg' | 'pdf';
  compression: number;
  transparent: boolean;
  scale: number;
}

const ChartModal = ({ isOpen, onClose, chartType: initialChartType, data, question }: ChartModalProps) => {
  const [chartData, setChartData] = useState<any>(null);
  const [chartOptions, setChartOptions] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [questionContext, setQuestionContext] = useState<string | null>(null);
  
  // New state variables for enhanced features
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>(initialChartType);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedColorIndex, setSelectedColorIndex] = useState<number | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>('#4BC0C0');
  const [colorPickerPosition, setColorPickerPosition] = useState<{top: number; left: number}>({top: 0, left: 0});
  const [chartHeight, setChartHeight] = useState<number>(600); // height in pixels
  const [chartWidth, setChartWidth] = useState<number>(100); // percentage
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [dataFilter, setDataFilter] = useState<string>('');
  const [filteredData, setFilteredData] = useState<any>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  
  // Add new state variables for chart customization
  const [showDataLabels, setShowDataLabels] = useState<boolean>(true);
  const [chartTitle, setChartTitle] = useState<string>('');
  const [xAxisLabel, setXAxisLabel] = useState<string>('');
  const [yAxisLabel, setYAxisLabel] = useState<string>('');
  const [legendPosition, setLegendPosition] = useState<'top' | 'bottom' | 'left' | 'right' | 'none'>('top');
  
  // Export options state
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    resolution: 'standard',
    format: 'png',
    compression: 0.8,
    transparent: false,
    scale: 1
  });

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
              position: legendPosition as const,
              display: true,
              labels: {
                font: {
                  size: 12
                },
                generateLabels: function(chart: any) {
                  const dataset = chart.data.datasets[0];
                  if (chartType === 'pie' || chartType === 'bar') {
                    return chart.data.labels.map((label: string, index: number) => ({
                      text: label,
                      fillStyle: Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor[index] : dataset.backgroundColor,
                      hidden: false,
                      index: index
                    }));
                  } else {
                    return chart.data.labels.map((label: string, index: number) => ({
                      text: label,
                      fillStyle: Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor[index] : dataset.backgroundColor,
                      strokeStyle: Array.isArray(dataset.borderColor) ? dataset.borderColor[index] : dataset.borderColor,
                      lineWidth: dataset.borderWidth,
                      hidden: false
                    }));
                  }
                }
              }
            },
            title: {
              display: true,
              text: chartTitle || data.title,
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
            },
            datalabels: {
              display: showDataLabels,
              align: chartType === 'pie' ? 'center' : 'end',
              anchor: chartType === 'pie' ? 'center' : 'end',
              color: function(context: any) {
                return chartType === 'pie' ? 'white' : '#666';
              },
              font: {
                size: 12,
                weight: 'bold'
              },
              formatter: function(value: any) {
                return value.toString();
              },
              padding: 6
            }
          },
          scales: chartType !== 'pie' ? {
            x: {
              title: {
                display: true,
                text: xAxisLabel,
                font: {
                  size: 14,
                },
              },
            },
            y: {
              title: {
                display: true,
                text: yAxisLabel,
                font: {
                  size: 14,
                },
              },
            },
          } : undefined,
        };

        setChartData(chartDataConfig);
        setChartOptions(chartOptionsConfig);
        setFilteredData(chartDataConfig);
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
      const colors = generateColors(processedData.length, chartType);
      const chartDataConfig = {
        labels,
        datasets: [
          {
            label: numericColumn,
            data: values,
            backgroundColor: chartType === 'line' ? colors.map(color => color.replace('0.6)', '0.2)')) : colors,
            borderColor: chartType === 'line' ? colors : undefined,
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
            position: legendPosition as const,
            display: true,
            labels: {
              font: {
                size: 12
              },
              generateLabels: function(chart: any) {
                const dataset = chart.data.datasets[0];
                if (chartType === 'pie' || chartType === 'bar') {
                  return chart.data.labels.map((label: string, index: number) => ({
                    text: label,
                    fillStyle: Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor[index] : dataset.backgroundColor,
                    hidden: false,
                    index: index
                  }));
                } else {
                  return chart.data.labels.map((label: string, index: number) => ({
                    text: label,
                    fillStyle: Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor[index] : dataset.backgroundColor,
                    strokeStyle: Array.isArray(dataset.borderColor) ? dataset.borderColor[index] : dataset.borderColor,
                    lineWidth: dataset.borderWidth,
                    hidden: false
                  }));
                }
              }
            }
          },
          title: {
            display: true,
            text: chartTitle || title,
            font: {
              size: 16,
            },
          },
        },
        scales: chartType !== 'pie' ? {
          x: {
            title: {
              display: true,
              text: xAxisLabel,
              font: {
                size: 14,
              },
            },
          },
          y: {
            title: {
              display: true,
              text: yAxisLabel,
              font: {
                size: 14,
              },
            },
          },
        } : undefined,
      };

      setChartData(chartDataConfig);
      setChartOptions(chartOptionsConfig);
      setFilteredData(chartDataConfig);
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

    // For all chart types, we need one color per data point
    // This ensures consistent legend colors across all chart types
    return Array.from({ length: count }, (_, i) => baseColors[i % baseColors.length]);
  };

  // Handle color change for a specific dataset or data point
  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    
    if (selectedColorIndex !== null && chartData) {
      const newChartData = { ...chartData };
      
      if (chartType === 'pie' || chartType === 'bar') {
        if (Array.isArray(newChartData.datasets[0].backgroundColor)) {
          // Update specific color in array for pie/bar charts
          newChartData.datasets = newChartData.datasets.map((dataset: any) => ({
            ...dataset,
            backgroundColor: dataset.backgroundColor.map((bgColor: string, i: number) =>
              i === selectedColorIndex ? color : bgColor
            )
          }));
        } else {
          // Single color for the dataset
          newChartData.datasets = newChartData.datasets.map((dataset: any) => ({
            ...dataset,
            backgroundColor: color
          }));
        }
      } else if (chartType === 'line') {
        // For line charts, update the specific point color
        newChartData.datasets = newChartData.datasets.map((dataset: any) => {
          const newBorderColor = Array.isArray(dataset.borderColor) 
            ? dataset.borderColor.map((c: string, i: number) => i === selectedColorIndex ? color : c)
            : color;
          const newBackgroundColor = Array.isArray(dataset.backgroundColor)
            ? dataset.backgroundColor.map((c: string, i: number) => i === selectedColorIndex ? color.replace(')', ', 0.2)') : c)
            : color.replace(')', ', 0.2)');
          
          return {
            ...dataset,
            borderColor: newBorderColor,
            backgroundColor: newBackgroundColor
          };
        });
      }
      
      setChartData(newChartData);
      setFilteredData(newChartData);
    }
  };
  
  // Handle color button click
  const handleColorButtonClick = (index: number, event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setColorPickerPosition({
      top: rect.bottom + window.scrollY + 5,
      left: rect.left + window.scrollX
    });
    setSelectedColorIndex(index);
    setSelectedColor(
      Array.isArray(chartData.datasets[0].backgroundColor) 
        ? chartData.datasets[0].backgroundColor[index] 
        : chartData.datasets[0].backgroundColor
    );
    setShowColorPicker(true);
  };

  // Handle chart type change
  const handleChartTypeChange = (newType: 'bar' | 'line' | 'pie') => {
    setChartType(newType);
  };

  // Handle exporting chart as image
  const handleExportChart = () => {
    setShowExportOptions(true);
  };
  
  // Update chart options when customization settings change
  useEffect(() => {
    if (chartData) {
      // Update CSS custom properties when chart dimensions change
      if (chartRef.current) {
        chartRef.current.style.setProperty('--chart-height', `${chartHeight}px`);
        chartRef.current.style.setProperty('--chart-width', `${chartWidth}%`);
      }

      const chartOptionsConfig = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: legendPosition !== 'none' ? (legendPosition as const) : 'top',
            display: legendPosition !== 'none',
            labels: {
              font: {
                size: 12
              },
              generateLabels: function(chart: any) {
                const dataset = chart.data.datasets[0];
                if (chartType === 'pie' || chartType === 'bar') {
                  return chart.data.labels.map((label: string, index: number) => ({
                    text: label,
                    fillStyle: Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor[index] : dataset.backgroundColor,
                    hidden: false,
                    index: index
                  }));
                } else {
                  return chart.data.labels.map((label: string, index: number) => ({
                    text: label,
                    fillStyle: Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor[index] : dataset.backgroundColor,
                    strokeStyle: Array.isArray(dataset.borderColor) ? dataset.borderColor[index] : dataset.borderColor,
                    lineWidth: dataset.borderWidth,
                    hidden: false
                  }));
                }
              }
            }
          },
          title: {
            display: true,
            text: chartTitle || (data.title || generateChartTitle(question, chartType, '', '')),
            font: {
              size: 16,
            },
          },
          tooltip: {
            callbacks: {
              footer: function(tooltipItems: any) {
                return data.insights ? data.insights : '';
              },
              label: function(context: any) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  label += context.parsed.y;
                }
                return label;
              }
            }
          },
          datalabels: {
            display: showDataLabels,
            align: chartType === 'pie' ? 'center' : 'end',
            anchor: chartType === 'pie' ? 'center' : 'end',
            color: function(context: any) {
              return chartType === 'pie' ? 'white' : '#666';
            },
            font: {
              size: 12,
              weight: 'bold'
            },
            formatter: function(value: any) {
              return value.toString();
            },
            padding: 6
          }
        },
        scales: chartType !== 'pie' ? {
          x: {
            title: {
              display: true,
              text: xAxisLabel,
              font: {
                size: 14,
              },
            },
          },
          y: {
            title: {
              display: true,
              text: yAxisLabel,
              font: {
                size: 14,
              },
            },
          },
        } : undefined,
      };

      setChartOptions(chartOptionsConfig);
    }
  }, [chartTitle, xAxisLabel, yAxisLabel, legendPosition, chartType, data, question, showDataLabels, chartHeight, chartWidth]);
  
  // Add fileName state
  const [fileName, setFileName] = useState<string>('');
  const [fileTags, setFileTags] = useState<string>('');
  const [saveLocation, setSaveLocation] = useState<string>('Downloads');

  useEffect(() => {
    // Set default filename when export options change
    setFileName(`chart-${new Date().toISOString().replace(/:/g, '_')}`);
  }, [exportOptions.format]);

  const executeExport = async () => {
    if (!chartRef.current) return;

    // Set background color based on transparency option
    const originalStyle = chartRef.current.style.backgroundColor;
    chartRef.current.style.backgroundColor = exportOptions.transparent ? 'transparent' : 'white';
    
    try {
      // Determine scale factor based on resolution
      let scaleFactor = exportOptions.scale;
      if (exportOptions.resolution === 'high') {
        scaleFactor = 2;
      } else if (exportOptions.resolution === 'print') {
        scaleFactor = 3;
      }
      
      // Choose export method based on format
      let exportPromise;
      const imageOptions = {
        quality: exportOptions.compression,
        pixelRatio: scaleFactor
      };
      
      switch (exportOptions.format) {
        case 'jpeg':
          exportPromise = htmlToImage.toJpeg(chartRef.current, imageOptions);
          break;
        case 'svg':
          exportPromise = htmlToImage.toSvg(chartRef.current);
          break;
        case 'pdf':
          exportPromise = htmlToImage.toPng(chartRef.current, imageOptions);
          break;
        case 'png':
        default:
          exportPromise = htmlToImage.toPng(chartRef.current, imageOptions);
          break;
      }

      const dataUrl = await exportPromise;
      
      // Try to use the File System Access API if available
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: `${fileName || 'chart'}.${exportOptions.format}`,
            types: [{
              description: 'Chart Image',
              accept: {
                'image/png': ['.png'],
                'image/jpeg': ['.jpg', '.jpeg'],
                'image/svg+xml': ['.svg'],
                'application/pdf': ['.pdf']
              }
            }]
          });
          
          // Convert data URL to Blob
          const response = await fetch(dataUrl);
          const blob = await response.blob();
          
          // Write the file
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.error('Error using File System Access API:', err);
            // Fall back to traditional download
            const link = document.createElement('a');
            link.download = `${fileName || 'chart'}.${exportOptions.format}`;
            link.href = dataUrl;
            link.click();
          }
        }
      } else {
        // Fall back to traditional download for unsupported browsers
        const link = document.createElement('a');
        link.download = `${fileName || 'chart'}.${exportOptions.format}`;
        link.href = dataUrl;
        link.click();
      }
    } catch (error) {
      console.error('Error exporting chart:', error);
    } finally {
      // Restore original background color
      if (chartRef.current) {
        chartRef.current.style.backgroundColor = originalStyle;
      }
      setShowExportOptions(false);
    }
  };
  
  const handleExportOptionChange = (option: keyof ExportOptions, value: any) => {
    setExportOptions(prev => ({
      ...prev,
      [option]: value
    }));
  };

  // Handle data filtering
  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDataFilter(e.target.value);
    
    if (!chartData) return;
    
    const filterValue = e.target.value.toLowerCase();
    if (!filterValue) {
      setFilteredData(chartData);
      return;
    }
    
    // Create a filtered version of the chart data
    const newFilteredData = { ...chartData };
    const filteredLabels = chartData.labels.filter((label: string, index: number) => 
      label.toString().toLowerCase().includes(filterValue)
    );
    
    const filteredIndices = chartData.labels.map((label: string, index: number) => 
      label.toString().toLowerCase().includes(filterValue) ? index : -1
    ).filter((index: number) => index !== -1);
    
    newFilteredData.labels = filteredLabels;
    
    // Filter each dataset's data based on the filtered indices
    newFilteredData.datasets = chartData.datasets.map((dataset: any) => ({
      ...dataset,
      data: filteredIndices.map((index: number) => dataset.data[index]),
      backgroundColor: Array.isArray(dataset.backgroundColor) 
        ? filteredIndices.map((index: number) => dataset.backgroundColor[index])
        : dataset.backgroundColor
    }));
    
    setFilteredData(newFilteredData);
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
            <>
              <div className="chart-controls">
                <div className="chart-type-selector">
                  <label>Chart Type:</label>
                  <div className="chart-type-buttons">
                    <button 
                      className={chartType === 'bar' ? 'active' : ''}
                      onClick={() => handleChartTypeChange('bar')}
                    >
                      Bar
                    </button>
                    <button 
                      className={chartType === 'line' ? 'active' : ''}
                      onClick={() => handleChartTypeChange('line')}
                    >
                      Line
                    </button>
                    <button 
                      className={chartType === 'pie' ? 'active' : ''}
                      onClick={() => handleChartTypeChange('pie')}
                    >
                      Pie
                    </button>
                  </div>
                </div>
                

                
                <div className="chart-actions">
                  <button onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}>
                    {showAdvancedOptions ? 'Hide Options' : 'Show Options'}
                  </button>
                  <button onClick={handleExportChart}>Export as Image</button>
                </div>
              </div>
              
              {/* Export Options Popup */}
              {showExportOptions && (
                <div className="export-options-overlay">
                  <div className="export-options-popup">
                    <h3>Save As:</h3>
                    
                    <div className="export-option">
                      <input 
                        type="text" 
                        value={fileName}
                        onChange={(e) => setFileName(e.target.value)}
                        placeholder="Enter filename"
                        className="filename-input"
                      />
                    </div>
                    
                    <div className="export-option">
                      <label>Tags:</label>
                      <input 
                        type="text" 
                        value={fileTags}
                        onChange={(e) => setFileTags(e.target.value)}
                        placeholder="Add tags (optional)"
                        className="tags-input"
                      />
                    </div>
                    
                    <div className="export-option">
                      <label>Where:</label>
                      <div className="location-selector">
                        <span className="folder-icon">📁</span>
                        <select 
                          value={saveLocation}
                          onChange={(e) => setSaveLocation(e.target.value)}
                          className="location-dropdown"
                        >
                          <option value="Downloads">Downloads</option>
                          <option value="Documents">Documents</option>
                          <option value="Desktop">Desktop</option>
                          <option value="Pictures">Pictures</option>
                        </select>
                        <button className="dropdown-button">▼</button>
                      </div>
                    </div>
                    
                    <div className="export-option">
                      <label>Format</label>
                      <select 
                        value={exportOptions.format}
                        onChange={(e) => handleExportOptionChange('format', e.target.value)}
                      >
                        <option value="png">PNG Image</option>
                        <option value="jpeg">JPEG Image</option>
                        <option value="svg">SVG Vector</option>
                        <option value="pdf">PDF Document</option>
                      </select>
                    </div>
                    
                    <div className="export-option">
                      <label>Resolution</label>
                      <select
                        value={exportOptions.resolution}
                        onChange={(e) => handleExportOptionChange('resolution', e.target.value)}
                      >
                        <option value="standard">Standard (1x)</option>
                        <option value="high">High (2x)</option>
                        <option value="print">Print Quality (3x)</option>
                      </select>
                    </div>
                    
                    <div className="export-option">
                      <label>Quality: {Math.round(exportOptions.compression * 100)}%</label>
                      <input 
                        type="range" 
                        min="0.1" 
                        max="1" 
                        step="0.1"
                        value={exportOptions.compression}
                        onChange={(e) => handleExportOptionChange('compression', parseFloat(e.target.value))}
                      />
                    </div>
                    
                    <div className="export-option checkbox">
                      <label>
                        <input 
                          type="checkbox"
                          checked={exportOptions.transparent}
                          onChange={(e) => handleExportOptionChange('transparent', e.target.checked)}
                        />
                        Transparent background
                      </label>
                    </div>
                    
                    <div className="export-buttons">
                      <button onClick={() => setShowExportOptions(false)}>Cancel</button>
                      <button onClick={() => {
                        if (!fileName.trim()) {
                          alert('Please enter a file name');
                          return;
                        }
                        executeExport();
                      }}>Save</button>
                    </div>
                  </div>
                </div>
              )}
              
              {showAdvancedOptions && (
                <div className="advanced-options">
                  <div className="filter-section">
                    <label htmlFor="data-filter">Filter Data:</label>
                    <input 
                      id="data-filter"
                      type="text" 
                      value={dataFilter} 
                      onChange={handleFilterChange} 
                      placeholder="Type to filter data points..."
                    />
                  </div>
                  
                  <div className="chart-customization-section">
                    <h4>Chart Customization</h4>
                    
                    <div className="option-group">
                      <label>Chart Title:</label>
                      <input
                        type="text"
                        value={chartTitle}
                        onChange={(e) => setChartTitle(e.target.value)}
                        placeholder="Enter chart title"
                      />
                    </div>

                    {chartType !== 'pie' && (
                      <>
                        <div className="option-group">
                          <label>X-Axis Label:</label>
                          <input
                            type="text"
                            value={xAxisLabel}
                            onChange={(e) => setXAxisLabel(e.target.value)}
                            placeholder="Enter x-axis label"
                          />
                        </div>

                        <div className="option-group">
                          <label>Y-Axis Label:</label>
                          <input
                            type="text"
                            value={yAxisLabel}
                            onChange={(e) => setYAxisLabel(e.target.value)}
                            placeholder="Enter y-axis label"
                          />
                        </div>
                      </>
                    )}

                    <div className="option-group">
                      <label>Legend Position:</label>
                      <select
                        value={legendPosition}
                        onChange={(e) => setLegendPosition(e.target.value as 'top' | 'bottom' | 'left' | 'right' | 'none')}
                      >
                        <option value="top">Top</option>
                        <option value="bottom">Bottom</option>
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                        <option value="none">No Legend</option>
                      </select>
                    </div>

                    <div className="option-group">
                      <label>
                        <input
                          type="checkbox"
                          checked={showDataLabels}
                          onChange={(e) => setShowDataLabels(e.target.checked)}
                        />
                        Show Data Values
                      </label>
                    </div>
                  </div>
                  
                  <div className="appearance-section">
                    <div className="chart-size-controls">
                      <label>Chart Height:</label>
                      <input 
                        type="range" 
                        min="200" 
                        max="1600" 
                        value={chartHeight} 
                        onChange={(e) => {
                          const newHeight = Number(e.target.value);
                          setChartHeight(newHeight);
                          // Update CSS custom property immediately
                          if (chartRef.current) {
                            chartRef.current.style.setProperty('--chart-height', `${newHeight}px`);
                          }
                        }} 
                      />
                      <span>{chartHeight}px</span>
                    </div>
                    
                    <div className="chart-size-controls">
                      <label>Chart Width:</label>
                      <input 
                        type="range" 
                        min="50" 
                        max="100" 
                        value={chartWidth} 
                        onChange={(e) => {
                          const newWidth = Number(e.target.value);
                          setChartWidth(newWidth);
                          // Update CSS custom property immediately
                          if (chartRef.current) {
                            chartRef.current.style.setProperty('--chart-width', `${newWidth}%`);
                          }
                        }} 
                      />
                      <span>{chartWidth}%</span>
                    </div>
                  </div>
                  
                  <div className="color-section">
                    <label>Color Customization:</label>
                    <div className="color-chips">
                      {chartData.datasets[0].backgroundColor.map((color: string, index: number) => (
                        <div
                          key={index}
                          className="color-chip"
                          style={{ backgroundColor: color }}
                          onClick={(event) => handleColorButtonClick(index, event)}
                        >
                          <span>{chartData.labels[index]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {showColorPicker && (
                    <div className="color-picker-container" style={{ top: colorPickerPosition.top, left: colorPickerPosition.left }}>
                      <HexColorPicker color={selectedColor} onChange={handleColorChange} />
                      <button onClick={() => setShowColorPicker(false)}>Close</button>
                    </div>
                  )}
                </div>
              )}
              
              <div 
                ref={chartRef}
                className="chart-container">
                {chartType === 'bar' && (
                  <Bar data={filteredData} options={chartOptions} />
                )}
                {chartType === 'line' && (
                  <Line data={filteredData} options={chartOptions} />
                )}
                {chartType === 'pie' && (
                  <Pie data={filteredData} options={chartOptions} />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChartModal;