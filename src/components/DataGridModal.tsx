import React from 'react';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import './DataGridModal.css';

interface DataGridModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any[];
}

const DataGridModal: React.FC<DataGridModalProps> = ({ isOpen, onClose, data }) => {
  if (!isOpen) return null;

  // Generate column definitions from the first data item
  const columns: GridColDef[] = data.length > 0
    ? Object.keys(data[0]).map(key => ({
        field: key,
        headerName: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
        sortable: true,
        filterable: true,
        flex: 1,
        minWidth: 100
      }))
    : [];

  // Add id field if not present in data
  const rowsWithId = data.map((row, index) => ({
    id: row.id || index,
    ...row
  }));

  return (
    <div className="modal-overlay">
      <div className="modal-content data-grid-modal">
        <div className="modal-header">
          <h2>Data View</h2>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>
        <div style={{ height: '600px', width: '100%' }}>
          <DataGrid
            rows={rowsWithId}
            columns={columns}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 100 },
              },
            }}
            pageSizeOptions={[25, 50, 100]}
            checkboxSelection={false}
            disableRowSelectionOnClick
            disableColumnMenu={false}
            density="standard"
          />
        </div>
      </div>
    </div>
  );
};

export default DataGridModal;