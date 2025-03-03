import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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

// Add color theme types and themes
interface ColorTheme {
  name: string;
  colors: string[];
}

const colorThemes: ColorTheme[] = [
  {
    name: 'Default',
    colors: [
      'rgba(75, 192, 192, 0.6)',
      'rgba(255, 99, 132, 0.6)',
      'rgba(54, 162, 235, 0.6)',
      'rgba(255, 206, 86, 0.6)',
      'rgba(153, 102, 255, 0.6)',
      'rgba(255, 159, 64, 0.6)',
      'rgba(199, 199, 199, 0.6)',
      'rgba(83, 102, 255, 0.6)',
      'rgba(78, 129, 188, 0.6)',
      'rgba(225, 99, 99, 0.6)'
    ]
  },
  {
    name: 'Material',
    colors: [
      'rgba(63, 81, 181, 0.6)',
      'rgba(233, 30, 99, 0.6)',
      'rgba(0, 150, 136, 0.6)',
      'rgba(255, 152, 0, 0.6)',
      'rgba(156, 39, 176, 0.6)',
      'rgba(33, 150, 243, 0.6)',
      'rgba(244, 67, 54, 0.6)',
      'rgba(0, 188, 212, 0.6)',
      'rgba(139, 195, 74, 0.6)',
      'rgba(121, 85, 72, 0.6)',
    ]
  },
  {
    name: 'Pastel',
    colors: [
      'rgba(172, 209, 233, 0.6)',
      'rgba(247, 201, 208, 0.6)',
      'rgba(207, 233, 172, 0.6)',
      'rgba(233, 172, 209, 0.6)',
      'rgba(172, 233, 207, 0.6)',
      'rgba(209, 172, 233, 0.6)',
      'rgba(233, 207, 172, 0.6)',
      'rgba(172, 233, 233, 0.6)',
      'rgba(233, 233, 172, 0.6)',
      'rgba(233, 172, 172, 0.6)',
    ]
  },
  {
    name: 'Monochromatic Blue',
    colors: [
      'rgba(31, 119, 180, 0.6)',
      'rgba(54, 144, 192, 0.6)',
      'rgba(103, 169, 207, 0.6)',
      'rgba(153, 201, 226, 0.6)',
      'rgba(204, 229, 255, 0.6)',
      'rgba(153, 201, 226, 0.6)',
      'rgba(103, 169, 207, 0.6)',
      'rgba(54, 144, 192, 0.6)',
      'rgba(31, 119, 180, 0.6)',
      'rgba(17, 94, 147, 0.6)',
    ]
  },
  {
    name: 'Colorblind Safe',
    colors: [
      'rgba(0, 107, 164, 0.6)',
      'rgba(255, 128, 14, 0.6)',
      'rgba(171, 171, 171, 0.6)',
      'rgba(89, 89, 89, 0.6)',
      'rgba(95, 158, 209, 0.6)',
      'rgba(200, 82, 0, 0.6)',
      'rgba(137, 137, 137, 0.6)',
      'rgba(162, 200, 236, 0.6)',
      'rgba(255, 188, 121, 0.6)',
      'rgba(207, 207, 207, 0.6)',
    ]
  },
  {
    name: 'Material Design',
    colors: [
      'rgba(98, 0, 238, 0.6)',
      'rgba(3, 218, 198, 0.6)',
      'rgba(255, 2, 102, 0.6)',
      'rgba(55, 0, 179, 0.6)',
      'rgba(1, 135, 134, 0.6)',
      'rgba(176, 0, 32, 0.6)',
      'rgba(255, 222, 3, 0.6)',
      'rgba(3, 169, 244, 0.6)',
      'rgba(76, 175, 80, 0.6)',
      'rgba(255, 152, 0, 0.6)',
    ]
  },
  {
    name: 'Professional and Balanced',
    colors: [
      'rgba(78, 121, 167, 0.6)',
      'rgba(242, 142, 43, 0.6)',
      'rgba(225, 87, 89, 0.6)',
      'rgba(118, 183, 178, 0.6)',
      'rgba(89, 161, 79, 0.6)',
      'rgba(237, 201, 73, 0.6)',
      'rgba(175, 122, 161, 0.6)',
      'rgba(255, 157, 167, 0.6)',
      'rgba(156, 117, 95, 0.6)',
      'rgba(186, 176, 172, 0.6)',
    ]
  },
  {
    name: 'Classic and Distinct',
    colors: [
      'rgba(31, 119, 180, 0.6)',
      'rgba(255, 127, 14, 0.6)',
      'rgba(44, 160, 44, 0.6)',
      'rgba(214, 39, 40, 0.6)',
      'rgba(148, 103, 189, 0.6)',
      'rgba(140, 86, 75, 0.6)',
      'rgba(227, 119, 194, 0.6)',
      'rgba(127, 127, 127, 0.6)',
      'rgba(188, 189, 34, 0.6)',
      'rgba(23, 190, 207, 0.6)',
    ]
  },
  {
    name: 'Elegant and Calm',
    colors: [
      'rgba(0, 63, 92, 0.6)',
      'rgba(68, 78, 134, 0.6)',
      'rgba(149, 81, 150, 0.6)',
      'rgba(221, 81, 130, 0.6)',
      'rgba(255, 110, 84, 0.6)',
      'rgba(255, 166, 0, 0.6)',
      'rgba(122, 81, 149, 0.6)',
      'rgba(239, 86, 117, 0.6)',
      'rgba(255, 118, 74, 0.6)',
      'rgba(188, 80, 144, 0.6)',
    ]
  },
  {
    name: 'Soft and Easy on the Eyes',
    colors: [
      'rgba(161, 195, 209, 0.6)',
      'rgba(179, 155, 200, 0.6)',
      'rgba(218, 184, 148, 0.6)',
      'rgba(255, 219, 168, 0.6)',
      'rgba(243, 166, 131, 0.6)',
      'rgba(247, 215, 148, 0.6)',
      'rgba(119, 139, 235, 0.6)',
      'rgba(231, 127, 103, 0.6)',
      'rgba(207, 106, 135, 0.6)',
      'rgba(89, 98, 117, 0.6)',
    ]
  },
  {
    name: 'Futuristic and High Contrast',
    colors: [
      'rgba(255, 107, 107, 0.6)',
      'rgba(255, 180, 0, 0.6)',
      'rgba(38, 166, 154, 0.6)',
      'rgba(41, 182, 246, 0.6)',
      'rgba(171, 71, 188, 0.6)',
      'rgba(236, 64, 122, 0.6)',
      'rgba(126, 87, 194, 0.6)',
      'rgba(66, 165, 245, 0.6)',
      'rgba(102, 187, 106, 0.6)',
      'rgba(255, 167, 38, 0.6)',
    ]
  },
  {
    name: 'Earthy and Organic',
    colors: [
      'rgba(53, 94, 59, 0.6)',
      'rgba(109, 163, 77, 0.6)',
      'rgba(164, 222, 2, 0.6)',
      'rgba(241, 196, 15, 0.6)',
      'rgba(230, 126, 34, 0.6)',
      'rgba(211, 84, 0, 0.6)',
      'rgba(192, 57, 43, 0.6)',
      'rgba(142, 68, 173, 0.6)',
      'rgba(44, 62, 80, 0.6)',
      'rgba(22, 160, 133, 0.6)',
    ]
  },
  {
    name: 'Grayscale & Muted Tones',
    colors: [
      'rgba(75, 75, 75, 0.6)',
      'rgba(109, 109, 109, 0.6)',
      'rgba(143, 143, 143, 0.6)',
      'rgba(177, 177, 177, 0.6)',
      'rgba(211, 211, 211, 0.6)',
      'rgba(245, 245, 245, 0.6)',
      'rgba(160, 160, 160, 0.6)',
      'rgba(120, 120, 120, 0.6)',
      'rgba(90, 90, 90, 0.6)',
      'rgba(61, 61, 61, 0.6)',
    ]
  },
  {
    name: 'Gradients and Heatmaps',
    colors: [
      'rgba(255, 69, 0, 0.6)',
      'rgba(255, 99, 71, 0.6)',
      'rgba(255, 127, 80, 0.6)',
      'rgba(255, 160, 122, 0.6)',
      'rgba(255, 215, 0, 0.6)',
      'rgba(218, 165, 32, 0.6)',
      'rgba(205, 92, 92, 0.6)',
      'rgba(233, 150, 122, 0.6)',
      'rgba(250, 128, 114, 0.6)',
      'rgba(255, 140, 0, 0.6)',
    ]
  },
  {
    name: 'Dark Mode Colors',
    colors: [
      'rgba(13, 115, 119, 0.6)',
      'rgba(20, 255, 236, 0.6)',
      'rgba(31, 64, 104, 0.6)',
      'rgba(27, 27, 47, 0.6)',
      'rgba(233, 69, 96, 0.6)',
      'rgba(90, 24, 154, 0.6)',
      'rgba(60, 9, 108, 0.6)',
      'rgba(157, 78, 221, 0.6)',
      'rgba(247, 37, 133, 0.6)',
      'rgba(114, 9, 183, 0.6)',
    ]
  }
];

class ChartErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Chart Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="chart-error-boundary">
          <h3>Something went wrong with the chart.</h3>
          <p>Please try refreshing the page or contact support if the problem persists.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

const ChartModal = ({ isOpen, onClose, chartType: initialChartType, data, question }: ChartModalProps) => {
  // State for chart data and options
  const [chartData, setChartData] = useState<any>(null);
  const [chartOptions, setChartOptions] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [questionContext, setQuestionContext] = useState<string | null>(null);
  
  // Chart appearance and behavior state
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
  
  // Chart customization state
  const [selectedTheme, setSelectedTheme] = useState<string>('Default');
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

  // Function to generate colors for chart elements
  const generateColors = useCallback((count: number, chartType: 'bar' | 'line' | 'pie'): string[] => {
    // Default color palette
    const defaultColors = [
      'rgba(75, 192, 192, 0.6)',
      'rgba(255, 99, 132, 0.6)',
      'rgba(54, 162, 235, 0.6)',
      'rgba(255, 206, 86, 0.6)',
      'rgba(153, 102, 255, 0.6)',
      'rgba(255, 159, 64, 0.6)',
      'rgba(199, 199, 199, 0.6)',
      'rgba(83, 102, 255, 0.6)',
      'rgba(78, 129, 188, 0.6)',
      'rgba(225, 99, 99, 0.6)'
    ];
    
    // Always return an array of colors for all chart types
    return Array.from({ length: count }, (_, i) => defaultColors[i % defaultColors.length]);
  
  }, []);

  // Chart options configuration
  const chartOptionsConfig = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    transitions: {
      active: {
        animation: {
          duration: 0
        }
      }
    },
    plugins: {
      title: {
        display: true,
        text: '',
        font: { size: 16 }
      },
      datalabels: {
        display: true,
        align: 'end',
        anchor: 'end',
        color: '#666',
        font: { size: 12, weight: 'bold' },
        formatter: (value: any) => value?.toString() || ''
      },
      legend: {
        position: legendPosition,
        display: legendPosition !== 'none',
        labels: {
          font: { size: 12 },
          generateLabels: (chart: any) => {
            const datasets = chart.data.datasets;
            const labels = chart.data.labels;
            if (!datasets.length) return [];
            const dataset = datasets[0];
            return labels.map((label: string, i: number) => ({
              text: label,
              fillStyle: Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor[i] : dataset.backgroundColor,
              hidden: false,
              lineCap: dataset.borderCapStyle,
              lineDash: dataset.borderDash,
              lineDashOffset: dataset.borderDashOffset,
              lineJoin: dataset.borderJoinStyle,
              lineWidth: dataset.borderWidth,
              strokeStyle: Array.isArray(dataset.borderColor) ? dataset.borderColor[i] : dataset.borderColor,
              pointStyle: dataset.pointStyle,
              rotation: 0
            }));
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: '',
          font: { size: 14 }
        }
      },
      y: {
        title: {
          display: true,
          text: '',
          font: { size: 14 }
        }
      }
    }
  }), [legendPosition]);

  // Color change handler
  const handleColorChange = useCallback((color: string) => {
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
  }, [selectedColorIndex, chartData, chartType]);
  
  // Memoize the theme selector component to prevent unnecessary re-renders
  const renderThemeSelector = useCallback(() => {
    return (
      <div className="theme-selection">
        <label htmlFor="theme-select">Color Theme:</label>
        <select
          id="theme-select"
          className="theme-dropdown"
          value={selectedTheme}
          onChange={(e) => setSelectedTheme(e.target.value)}
        >
          {colorThemes.map((theme) => (
            <option key={theme.name} value={theme.name}>
              {theme.name}
            </option>
          ))}
        </select>
      </div>
    );
  }, [selectedTheme]);

  // Render the appropriate chart based on chartType
  const renderChart = useMemo(() => {
    if (!filteredData || !chartOptions) {
      return <div className="chart-error">No chart data available</div>;
    }
  
    try {
      // Validate chart data structure before rendering
      if (!filteredData.datasets || !Array.isArray(filteredData.datasets) || filteredData.datasets.length === 0) {
        console.error('Invalid chart data structure: missing or empty datasets');
        return <div className="chart-error">Invalid chart data structure</div>;
      }
  
      if (!filteredData.labels || !Array.isArray(filteredData.labels)) {
        console.error('Invalid chart data structure: missing or invalid labels');
        return <div className="chart-error">Invalid chart data structure</div>;
      }
  
      // Skip detailed validation in render cycle for performance
      // Just check the first dataset to ensure basic structure
      if (!filteredData.datasets[0].data || !Array.isArray(filteredData.datasets[0].data)) {
        console.error('Invalid dataset structure: data is not an array');
        return <div className="chart-error">Invalid dataset structure</div>;
      }
  
      // Use React.memo or lazy initialization for chart components if needed
      const chartProps = {
        data: filteredData,
        options: {
          ...chartOptions,
          animation: false,
          responsive: true,
          maintainAspectRatio: false
        }
      };
  
      // Render the appropriate chart based on chartType
      switch (chartType) {
        case 'bar':
          return <Bar {...chartProps} />;
        case 'line':
          return <Line {...chartProps} />;
        case 'pie':
          return <Pie {...chartProps} />;
        default:
          console.error('Unsupported chart type:', chartType);
          return <div className="chart-error">Unsupported chart type</div>;
      }
    } catch (error) {
      console.error('Error rendering chart:', error);
      return <div className="chart-error">Failed to render chart: {error instanceof Error ? error.message : 'Unknown error'}</div>;
    }
  }, [filteredData, chartOptions, chartType]);

  // Effect to update chart options when customization values change
  useEffect(() => {
    if (chartOptions) {
      setChartOptions(prevOptions => ({
        ...prevOptions,
        plugins: {
          ...prevOptions.plugins,
          title: {
            ...prevOptions.plugins.title,
            display: true,
            text: chartTitle
          },
          legend: {
            ...prevOptions.plugins.legend,
            display: legendPosition !== 'none',
            position: legendPosition
          },
          datalabels: {
            ...prevOptions.plugins.datalabels,
            display: showDataLabels
          }
        },
        scales: {
          x: {
            ...prevOptions.scales.x,
            title: {
              ...prevOptions.scales.x.title,
              display: true,
              text: xAxisLabel
            }
          },
          y: {
            ...prevOptions.scales.y,
            title: {
              ...prevOptions.scales.y.title,
              display: true,
              text: yAxisLabel
            }
          }
        }
      }));
    }
  }, [chartTitle, xAxisLabel, yAxisLabel, legendPosition, showDataLabels]);

  useEffect(() => {
    if (!data) {
      console.log('ChartModal: No data provided');
      setError('No data available for visualization');
      return;
    }
    
    try {
      // Extract questionContext if available
      if (data.questionContext) {
        setQuestionContext(data.questionContext);
      } else {
        setQuestionContext(null);
      }

      // Validate and process the chart data
      const chartDataConfig = data.chartData || data;
      
      // Ensure the chart data has the required structure
      if (!chartDataConfig.datasets || !Array.isArray(chartDataConfig.datasets)) {
        throw new Error('Invalid chart data: missing or invalid datasets');
      }

      if (!chartDataConfig.labels || !Array.isArray(chartDataConfig.labels)) {
        throw new Error('Invalid chart data: missing or invalid labels');
      }

      // Optimize dataset processing - avoid unnecessary operations
      let needsNewDatasets = false;
      const validatedDatasets = chartDataConfig.datasets.map((dataset, index) => {
        if (!Array.isArray(dataset.data)) {
          throw new Error(`Invalid dataset at index ${index}: data is not an array`);
        }

        // Only apply colors if needed - avoid unnecessary object creation
        if (!dataset.backgroundColor || (chartType === 'line' && !dataset.borderColor)) {
          needsNewDatasets = true;
          const colors = generateColors(chartDataConfig.labels.length, chartType);
          return {
            ...dataset,
            backgroundColor: chartType === 'line' ? colors.map(color => color.replace('0.6)', '0.2)')) : colors,
            ...(chartType === 'line' && { borderColor: colors })
          };
        }
        
        return dataset;
      });

      // Create a new object only if needed - avoid unnecessary re-renders
      const processedChartData = needsNewDatasets 
        ? { ...chartDataConfig, datasets: validatedDatasets }
        : chartDataConfig;

      // Batch state updates to reduce renders
      setChartData(processedChartData);
      setChartOptions({
        ...chartOptionsConfig,
        animation: false,
        transitions: {
          active: {
            animation: {
              duration: 0
            }
          }
        }
      });
      setFilteredData(processedChartData);
      setError(null);
    } catch (err) {
      console.error('Error processing chart data:', err);
      setError(err instanceof Error ? err.message : 'Failed to process chart data');
      setChartData(null);
      setChartOptions(null);
      setFilteredData(null);
    }
  }, [data, chartType, generateColors, chartOptionsConfig, legendPosition]);

  // Function to handle export
  const handleExport = useCallback(() => {
    setShowExportOptions(true);
  }, []);

  // Function to toggle advanced options
  const toggleAdvancedOptions = useCallback(() => {
    setShowAdvancedOptions(!showAdvancedOptions);
  }, [showAdvancedOptions]);

  // Effect to update chart colors when theme changes
  useEffect(() => {
    if (chartData && filteredData) {
      const selectedThemeColors = colorThemes.find(theme => theme.name === selectedTheme)?.colors || [];
      
      const newChartData = { ...chartData };
      newChartData.datasets = newChartData.datasets.map((dataset: any) => {
        // For all chart types, use the color array
        const colors = Array.isArray(dataset.data)
          ? dataset.data.map((_: any, i: number) => selectedThemeColors[i % selectedThemeColors.length])
          : [selectedThemeColors[0]];

        if (chartType === 'line') {
          return {
            ...dataset,
            borderColor: colors,
            backgroundColor: colors.map(color => color.replace('0.6)', '0.2)')),
            pointBackgroundColor: colors,
            pointBorderColor: colors,
            borderWidth: 2
          };
        } else {
          return {
            ...dataset,
            backgroundColor: colors
          };
        }
      });

      setChartData(newChartData);
      setFilteredData(newChartData);
    }
  }, [selectedTheme, chartType]);

  // Function to handle export confirmation
  const handleExportConfirm = useCallback(async () => {
    if (!chartRef.current) return;

    try {
      // Wait for next frame to ensure chart is rendered
      await new Promise(resolve => requestAnimationFrame(resolve));

      let exportFunction;
      const scale = exportOptions.resolution === 'high' ? 2 : exportOptions.resolution === 'print' ? 3 : 1;
      const backgroundColor = exportOptions.transparent ? 'transparent' : 'white';

      switch (exportOptions.format) {
        case 'png':
          exportFunction = htmlToImage.toPng;
          break;
        case 'jpeg':
          exportFunction = htmlToImage.toJpeg;
          break;
        case 'svg':
          exportFunction = htmlToImage.toSvg;
          break;
        case 'pdf':
          exportFunction = htmlToImage.toPng;
          break;
        default:
          exportFunction = htmlToImage.toPng;
      }

      const dataUrl = await exportFunction(chartRef.current, {
        cacheBust: true,
        pixelRatio: scale,
        quality: exportOptions.compression,
        backgroundColor,
        style: {
          transform: `scale(${exportOptions.scale})`,
          transformOrigin: 'top left',
        },
        canvasWidth: chartRef.current.offsetWidth * scale,
        canvasHeight: chartRef.current.offsetHeight * scale
      });

      // Create download link
      const link = document.createElement('a');
      link.download = `chart-export.${exportOptions.format}`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setShowExportOptions(false);
    } catch (error) {
      console.error('Error exporting chart:', error);
      setError('Failed to export chart. Please try again.');
    }
  }, [exportOptions, chartRef]);

  // Add the export options modal JSX
  const renderExportOptions = useCallback(() => {
    if (!showExportOptions) return null;

    return (
      <div className="export-options-overlay" onClick={() => setShowExportOptions(false)}>
        <div className="export-options-popup" onClick={e => e.stopPropagation()}>
          <h3>Export Options</h3>
          <div className="export-option">
            <label>Resolution:</label>
            <select
              value={exportOptions.resolution}
              onChange={e => setExportOptions(prev => ({ ...prev, resolution: e.target.value as 'standard' | 'high' | 'print' }))}
            >
              <option value="standard">Standard</option>
              <option value="high">High</option>
              <option value="print">Print</option>
            </select>
          </div>
          <div className="export-option">
            <label>Format:</label>
            <select
              value={exportOptions.format}
              onChange={e => setExportOptions(prev => ({ ...prev, format: e.target.value as 'png' | 'jpeg' | 'svg' | 'pdf' }))}
            >
              <option value="png">PNG</option>
              <option value="jpeg">JPEG</option>
              <option value="svg">SVG</option>
              <option value="pdf">PDF</option>
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
              onChange={e => setExportOptions(prev => ({ ...prev, compression: parseFloat(e.target.value) }))}
            />
          </div>
          <div className="export-option checkbox">
            <label>
              <input
                type="checkbox"
                checked={exportOptions.transparent}
                onChange={e => setExportOptions(prev => ({ ...prev, transparent: e.target.checked }))}
              />
              Transparent background
            </label>
          </div>
          <div className="export-buttons">
            <button onClick={() => setShowExportOptions(false)}>Cancel</button>
            <button onClick={handleExportConfirm}>Export</button>
          </div>
        </div>
      </div>
    );
  }, [showExportOptions, exportOptions, handleExportConfirm]);

  // Return the component JSX
  return (
    <div className="chart-modal-overlay" onClick={onClose}>
      <div className="chart-modal" onClick={e => e.stopPropagation()}>
        <div className="chart-modal-header">
          <h2>Chart Visualization</h2>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>
        <div className="chart-modal-content">
          {error && <div className="chart-error">{error}</div>}
          {questionContext && (
            <div className="chart-context">
              <h3>Context:</h3>
              <p>{questionContext}</p>
            </div>
          )}
          <ChartErrorBoundary>
            <div className="chart-controls">
              <div className="chart-type-selector">
                <span>Chart Type:</span>
                <div className="chart-type-buttons">
                  <button
                    className={chartType === 'bar' ? 'active' : ''}
                    onClick={() => setChartType('bar')}
                  >
                    Bar
                  </button>
                  <button
                    className={chartType === 'line' ? 'active' : ''}
                    onClick={() => setChartType('line')}
                  >
                    Line
                  </button>
                  <button
                    className={chartType === 'pie' ? 'active' : ''}
                    onClick={() => setChartType('pie')}
                  >
                    Pie
                  </button>
                </div>
              </div>
              <div className="chart-actions">
                <button onClick={toggleAdvancedOptions}>
                  {showAdvancedOptions ? 'Hide Options' : 'Show Options'}
                </button>
                <button onClick={handleExport}>Export</button>
              </div>
            </div>

            {showAdvancedOptions && (
              <div className="advanced-options">
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
                      <option value="none">None</option>
                    </select>
                  </div>
                  <div className="option-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={showDataLabels}
                        onChange={(e) => setShowDataLabels(e.target.checked)}
                      />
                      Show Data Labels
                    </label>
                  </div>
                </div>

                <div className="chart-size-controls">
                  <label>Chart Height:</label>
                  <input
                    type="range"
                    min="200"
                    max="1000"
                    value={chartHeight}
                    onChange={(e) => setChartHeight(Number(e.target.value))}
                  />
                  <span>{chartHeight}px</span>
                </div>

                <div className="chart-size-controls">
                  <label>Chart Width:</label>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    value={chartWidth}
                    onChange={(e) => setChartWidth(Number(e.target.value))}
                  />
                  <span>{chartWidth}%</span>
                </div>

                {renderThemeSelector()}
              </div>
            )}

            <div
              ref={chartRef}
              className="chart-container"
              style={{
                '--chart-height': `${chartHeight}px`,
                '--chart-width': `${chartWidth}%`
              } as React.CSSProperties}
            >
              {renderChart}
            </div>
          </ChartErrorBoundary>
          {renderExportOptions()}
        </div>
      </div>
    </div>
  );
};

export default ChartModal;