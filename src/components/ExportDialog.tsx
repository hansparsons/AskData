import React, { useState } from 'react';
import './ExportDialog.css';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sqlQuery: string;
  answer: string;
  results: any;
}

interface ExportOptions {
  components: {
    answer: boolean;
    sqlQuery: boolean;
    results: boolean;
  };
  formats: {
    answer: {
      txt: boolean;
      pdf: boolean;
      docx: boolean;
    };
    sqlQuery: {
      sql: boolean;
      txt: boolean;
    };
    results: {
      xlsx: boolean;
      csv: boolean;
      tsv: boolean;
      json: boolean;
    };
  };
}

const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  sqlQuery,
  answer,
  results,
}) => {
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    components: {
      answer: false,
      sqlQuery: false,
      results: false,
    },
    formats: {
      answer: {
        txt: false,
        pdf: false,
        docx: false,
      },
      sqlQuery: {
        sql: false,
        txt: false,
      },
      results: {
        xlsx: false,
        csv: false,
        tsv: false,
        json: false,
      },
    },
  });

  const handleComponentChange = (component: keyof typeof exportOptions.components) => {
    setExportOptions(prev => ({
      ...prev,
      components: {
        ...prev.components,
        [component]: !prev.components[component],
      },
    }));
  };

  const handleFormatChange = (
    component: 'answer' | 'sqlQuery' | 'results',
    format: string
  ) => {
    setExportOptions(prev => ({
      ...prev,
      formats: {
        ...prev.formats,
        [component]: {
          ...prev.formats[component],
          [format]: !prev.formats[component][format as keyof typeof prev.formats[typeof component]],
        },
      },
    }));
  };

  const handleExport = async () => {
    try {
      const exportData = {
        components: exportOptions.components,
        formats: exportOptions.formats,
        data: {
          answer: answer,
          sqlQuery: sqlQuery,
          results: results,
        },
      };

      const response = await fetch('http://localhost:3000/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportData),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'export.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      onClose();
    } catch (error) {
      console.error('Export error:', error);
      // Handle error (show error message to user)
    }
  };

  if (!isOpen) return null;

  return (
    <div className="export-dialog-overlay">
      <div className="export-dialog">
        <h2>Export Options</h2>
        
        <div className="export-section">
          <h3>Select Components to Export</h3>
          <div className="component-options">
            <label>
              <input
                type="checkbox"
                checked={exportOptions.components.answer}
                onChange={() => handleComponentChange('answer')}
              />
              Answer
            </label>
            <label>
              <input
                type="checkbox"
                checked={exportOptions.components.sqlQuery}
                onChange={() => handleComponentChange('sqlQuery')}
              />
              SQL Query
            </label>
            <label>
              <input
                type="checkbox"
                checked={exportOptions.components.results}
                onChange={() => handleComponentChange('results')}
              />
              Results
            </label>
          </div>
        </div>

        {exportOptions.components.answer && (
          <div className="format-section">
            <h4>Answer Format</h4>
            <div className="format-options">
              <label>
                <input
                  type="checkbox"
                  checked={exportOptions.formats.answer.txt}
                  onChange={() => handleFormatChange('answer', 'txt')}
                />
                TXT
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={exportOptions.formats.answer.pdf}
                  onChange={() => handleFormatChange('answer', 'pdf')}
                />
                PDF
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={exportOptions.formats.answer.docx}
                  onChange={() => handleFormatChange('answer', 'docx')}
                />
                Microsoft Word
              </label>

            </div>
          </div>
        )}

        {exportOptions.components.sqlQuery && (
          <div className="format-section">
            <h4>SQL Query Format</h4>
            <div className="format-options">
              <label>
                <input
                  type="checkbox"
                  checked={exportOptions.formats.sqlQuery.sql}
                  onChange={() => handleFormatChange('sqlQuery', 'sql')}
                />
                SQL
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={exportOptions.formats.sqlQuery.txt}
                  onChange={() => handleFormatChange('sqlQuery', 'txt')}
                />
                TXT
              </label>
            </div>
          </div>
        )}

        {exportOptions.components.results && (
          <div className="format-section">
            <h4>Results Format</h4>
            <div className="format-options">
              <label>
                <input
                  type="checkbox"
                  checked={exportOptions.formats.results.xlsx}
                  onChange={() => handleFormatChange('results', 'xlsx')}
                />
                Microsoft Excel
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={exportOptions.formats.results.csv}
                  onChange={() => handleFormatChange('results', 'csv')}
                />
                CSV
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={exportOptions.formats.results.tsv}
                  onChange={() => handleFormatChange('results', 'tsv')}
                />
                TSV
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={exportOptions.formats.results.json}
                  onChange={() => handleFormatChange('results', 'json')}
                />
                JSON
              </label>
            </div>
          </div>
        )}

        <div className="dialog-buttons">
          <button onClick={handleExport}>Export</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default ExportDialog;