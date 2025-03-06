import React, { useState } from 'react';
import { Button, TextField, FormControl, InputLabel, Select, MenuItem, Box, Typography } from '@mui/material';

const DatabaseConnection: React.FC = () => {
  // Add state variables for form fields
  const [connectionName, setConnectionName] = useState('');
  const [databaseType, setDatabaseType] = useState('postgres');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [databaseName, setDatabaseName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Your existing handler
  const handleConnectDatabase = async () => {
    try {
      const response = await fetch('/api/database/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: connectionName,
          type: databaseType,
          host: host,
          port: parseInt(port),
          database: databaseName,
          username: username,
          password: password
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        // Handle successful connection
        console.log('Database connected successfully', data.dataSource);
        // Update UI or navigate to another page
      } else {
        // Handle connection failure
        console.error('Failed to connect to database:', data.error);
        // Show error message to user
      }
    } catch (error) {
      console.error('Error connecting to database:', error);
      // Show error message to user
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>Connect to Database</Typography>
      
      <TextField
        fullWidth
        margin="normal"
        label="Connection Name"
        value={connectionName}
        onChange={(e) => setConnectionName(e.target.value)}
      />
      
      <FormControl fullWidth margin="normal">
        <InputLabel>Database Type</InputLabel>
        <Select
          value={databaseType}
          onChange={(e) => setDatabaseType(e.target.value)}
        >
          <MenuItem value="postgres">PostgreSQL</MenuItem>
          <MenuItem value="mysql">MySQL</MenuItem>
          <MenuItem value="mssql">SQL Server</MenuItem>
          <MenuItem value="sqlite">SQLite</MenuItem>
        </Select>
      </FormControl>
      
      <TextField
        fullWidth
        margin="normal"
        label="Host"
        value={host}
        onChange={(e) => setHost(e.target.value)}
      />
      
      <TextField
        fullWidth
        margin="normal"
        label="Port"
        value={port}
        onChange={(e) => setPort(e.target.value)}
      />
      
      <TextField
        fullWidth
        margin="normal"
        label="Database Name"
        value={databaseName}
        onChange={(e) => setDatabaseName(e.target.value)}
      />
      
      <TextField
        fullWidth
        margin="normal"
        label="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      
      <TextField
        fullWidth
        margin="normal"
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      
      <Button 
        variant="contained" 
        color="primary" 
        sx={{ mt: 2 }}
        onClick={handleConnectDatabase}
      >
        Connect Database
      </Button>
    </Box>
  );
};

export default DatabaseConnection;