import React, { useEffect, useState } from 'react';
import { 
  List, 
  ListItem, 
  ListItemText, 
  Button, 
  IconButton, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Typography, 
  Box, 
  Snackbar, 
  Alert 
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { DataSource } from '../types/database';
import DatabaseConnectionModal from './DatabaseConnectionModal';

interface DatabaseListProps {
  onSelect: (database: DataSource) => void;
}

const DatabaseList: React.FC<DatabaseListProps> = ({ onSelect }) => {
  const [databases, setDatabases] = useState<DataSource[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDatabase, setEditingDatabase] = useState<DataSource | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [databaseToDelete, setDatabaseToDelete] = useState<number | null>(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });

  const fetchDatabases = async () => {
    try {
      const response = await fetch('/api/databases');
      const data = await response.json();
      setDatabases(data);
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to fetch databases',
        severity: 'error'
      });
    }
  };

  useEffect(() => {
    fetchDatabases();
  }, []);

  const handleSave = async (values: any) => {
    try {
      const endpoint = editingDatabase 
        ? `/api/databases/${editingDatabase.id}`
        : '/api/databases';
      
      const method = editingDatabase ? 'PUT' : 'POST';
      
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!response.ok) throw new Error('Failed to save database');
      
      fetchDatabases();
      setModalVisible(false);
      setEditingDatabase(null);
      setSnackbar({
        open: true,
        message: 'Database connection saved successfully',
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to save database connection',
        severity: 'error'
      });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/databases/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete database');
      
      fetchDatabases();
      setSnackbar({
        open: true,
        message: 'Database connection deleted',
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to delete database connection',
        severity: 'error'
      });
    }
    setDeleteDialogOpen(false);
    setDatabaseToDelete(null);
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Button
        variant="contained"
        color="primary"
        onClick={() => {
          console.log('Opening modal...'); 
          setModalVisible(true);
        }}
        sx={{ mb: 2 }}
      >
        Add Database Connection
      </Button>

      <DatabaseConnectionModal
        visible={modalVisible}
        onClose={() => {
          console.log('Closing modal...'); 
          setModalVisible(false);
          setEditingDatabase(null);
        }}
        onSave={handleSave}
        initialValues={editingDatabase}
      />

      <List>
        {databases.map((database) => (
          <ListItem
            key={database.id}
            onClick={() => onSelect(database)}
            sx={{ cursor: 'pointer' }}
            secondaryAction={
              <Box>
                <IconButton
                  edge="end"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingDatabase(database);
                    setModalVisible(true);
                  }}
                >
                  <EditOutlinedIcon />
                </IconButton>
                <IconButton
                  edge="end"
                  color="error"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDatabaseToDelete(database.id);
                    setDeleteDialogOpen(true);
                  }}
                >
                  <DeleteOutlineIcon />
                </IconButton>
              </Box>
            }
          >
            <ListItemText
              primary={database.name}
              secondary={`${database.connectionConfig.databaseType} - ${database.connectionConfig.host}`}
            />
          </ListItem>
        ))}
      </List>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this database connection?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={() => databaseToDelete && handleDelete(databaseToDelete)}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default DatabaseList;